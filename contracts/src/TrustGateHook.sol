// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @custom:security-contact security@maiat.xyz
 */

import {BaseHook} from "./base/BaseHook.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/types/BeforeSwapDelta.sol";
import {LPFeeLibrary} from "v4-core/libraries/LPFeeLibrary.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {SwapParams} from "v4-core/types/PoolOperation.sol";
import {TrustScoreOracle} from "./TrustScoreOracle.sol";
import {Ownable2Step, Ownable} from "openzeppelin-contracts/contracts/access/Ownable2Step.sol";

/// @title TrustGateHook
/// @notice Uniswap V4 hook: trust-gated swaps + reputation-based dynamic fees
/// @dev Queries TrustScoreOracle for token scores AND user/router reputation fees
///
/// How it works:
/// 1. beforeSwap: Check token trust scores → block low-trust tokens
/// 2. Dynamic fee: Router/user reputation score → lower fees for trusted participants
/// 3. Community reviews feed the oracle → reviews = lower fees = real economic value
///
/// Fee tiers (from TrustScoreOracle):
///   Guardian (200+ rep): 0% fee
///   Verified (50+ rep):  0.1% fee
///   Trusted (10+ rep):   0.3% fee
///   New (0-9 rep):       0.5% fee
///
/// @dev SENDER NOTE: In Uniswap V4, the `sender` parameter in hook callbacks is
///      the ROUTER (e.g. UniversalRouter), NOT the end user. Fee discounts based on
///      `sender` apply per-router, not per-user. To apply per-user discounts, encode
///      the user address in `hookData` via a trusted router.
contract TrustGateHook is BaseHook, Ownable2Step {
    using BeforeSwapDeltaLibrary for BeforeSwapDelta;
    using LPFeeLibrary for uint24;

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    TrustScoreOracle public immutable oracle;
    uint256 public trustThreshold;

    /// @notice Minimum allowed trust threshold — prevents silently disabling the gate
    uint256 public constant MIN_THRESHOLD = 1;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted when a token passes the trust gate (swap allowed)
    event TrustGateChecked(address indexed token, uint256 score, bool passed);
    /// @notice Emitted when a threshold update is applied
    event ThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    /// @notice Emitted when a dynamic fee is applied to a swap
    event DynamicFeeApplied(address indexed router, uint256 feeBps);

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error TrustScoreTooLow(address token, uint256 score, uint256 threshold);
    error TrustGateHook__ZeroAddress();
    error TrustGateHook__InvalidThreshold(uint256 threshold);
    error TrustGateHook__ThresholdTooLow(uint256 threshold);

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(
        TrustScoreOracle _oracle,
        IPoolManager _poolManager,
        address initialOwner
    ) BaseHook(_poolManager) Ownable(initialOwner) {
        if (address(_oracle) == address(0)) revert TrustGateHook__ZeroAddress();
        if (address(_poolManager) == address(0)) revert TrustGateHook__ZeroAddress();
        if (initialOwner == address(0)) revert TrustGateHook__ZeroAddress();

        oracle = _oracle;
        trustThreshold = 30; // Block tokens with score < 30
    }

    /*//////////////////////////////////////////////////////////////
                        HOOK PERMISSIONS
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc BaseHook
    /// @dev Only beforeSwap is enabled. All other permissions are false.
    ///      The hook address MUST be mined so that bit 7 (beforeSwap) is set.
    ///      Use HookMiner (foundry script) to find a valid CREATE2 salt.
    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: false,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,      // DANGER: not needed, keeps NoOp risk off
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    /*//////////////////////////////////////////////////////////////
                        USER-FACING STATE-CHANGING FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Update the minimum trust score required for swaps
    /// @param newThreshold Must be between MIN_THRESHOLD (1) and 100 inclusive
    function updateThreshold(uint256 newThreshold) external onlyOwner {
        if (newThreshold > 100) revert TrustGateHook__InvalidThreshold(newThreshold);
        if (newThreshold < MIN_THRESHOLD) revert TrustGateHook__ThresholdTooLow(newThreshold);
        uint256 old = trustThreshold;
        trustThreshold = newThreshold;
        emit ThresholdUpdated(old, newThreshold);
    }

    /// @notice beforeSwap: trust-gate tokens + apply reputation-based dynamic fee
    /// @dev The pool MUST be initialized with a dynamic fee (0x800000) for the
    ///      fee override to take effect. We set LPFeeLibrary.OVERRIDE_FEE_FLAG (0x400000)
    ///      so V4 actually applies the returned fee value.
    ///
    ///      `sender` is the router address, not the end user.
    ///      Fee tier is determined by the router's registered reputation.
    ///      For per-user fees, encode user address in `hookData` and use a trusted router.
    ///
    /// @dev NOTE on events + revert: SwapBlocked is NOT emitted on blocked swaps because
    ///      EVM reverts roll back all event logs. TrustScoreTooLow error carries the
    ///      full context (token, score, threshold) for off-chain monitoring via revert data.
    function beforeSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata,
        bytes calldata
    ) external override onlyPoolManager returns (bytes4, BeforeSwapDelta, uint24) {
        // Check currency0 trust score
        address token0 = Currency.unwrap(key.currency0);
        if (token0 != address(0)) {
            uint256 score0 = oracle.getScore(token0);
            if (score0 < trustThreshold) {
                // NOTE: No emit here — revert rolls back events. Use revert data for monitoring.
                revert TrustScoreTooLow(token0, score0, trustThreshold);
            }
            emit TrustGateChecked(token0, score0, true);
        }

        // Check currency1 trust score
        address token1 = Currency.unwrap(key.currency1);
        if (token1 != address(0)) {
            uint256 score1 = oracle.getScore(token1);
            if (score1 < trustThreshold) {
                // NOTE: No emit here — revert rolls back events. Use revert data for monitoring.
                revert TrustScoreTooLow(token1, score1, trustThreshold);
            }
            emit TrustGateChecked(token1, score1, true);
        }

        // Dynamic fee based on router/user reputation
        // NOTE: `sender` = router. Register router reputation in oracle for fee discounts.
        uint256 feeBps = oracle.getUserFee(sender);
        emit DynamicFeeApplied(sender, feeBps);

        // V4 requires: fee (in pips = feeBps * 100) | OVERRIDE_FEE_FLAG (0x400000)
        // Without the flag, the returned value is silently ignored by the PoolManager.
        uint24 lpFeeOverride = uint24(feeBps * 100) | LPFeeLibrary.OVERRIDE_FEE_FLAG;

        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, lpFeeOverride);
    }
}
