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
    /// @notice Delay required between proposing and executing a threshold change.
    ///         Prevents flash-lowering the gate to let a malicious token through.
    uint256 public constant THRESHOLD_UPDATE_DELAY = 1 days;

    /// @notice Routers authorized to supply a per-user address in hookData.
    ///         Prevents arbitrary callers from spoofing a high-reputation feeTarget.
    mapping(address => bool) public allowedRouters;

    /// @notice Pending threshold value (0 = no pending update)
    uint256 public pendingThreshold;
    /// @notice Timestamp after which pendingThreshold can be executed
    uint256 public pendingThresholdTime;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted when a token passes the trust gate (swap allowed)
    event TrustGateChecked(address indexed token, uint256 score, bool passed);
    /// @notice Emitted when a threshold update is applied
    event ThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    event ThresholdProposed(uint256 newThreshold, uint256 executeAfter);
    /// @notice Emitted when a dynamic fee is applied to a swap
    event DynamicFeeApplied(address indexed router, uint256 feeBps);
    /// @notice Emitted when a router's hookData allowance is changed
    event RouterAllowanceUpdated(address indexed router, bool allowed);

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error TrustScoreTooLow(address token, uint256 score, uint256 threshold);
    error TrustGateHook__ZeroAddress();
    error TrustGateHook__InvalidThreshold(uint256 threshold);
    error TrustGateHook__ThresholdTooLow(uint256 threshold);
    /// @notice Reverts when a token's score originates from unverified seed/baseline data
    error TrustGateHook__SeedScoreRejected(address token);
    error TrustGateHook__ZeroAddressRouter();
    error TrustGateHook__NoThresholdPending();
    error TrustGateHook__ThresholdTimelockNotExpired(uint256 executeAfter);

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(TrustScoreOracle _oracle, IPoolManager _poolManager, address initialOwner)
        BaseHook(_poolManager)
        Ownable(initialOwner)
    {
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
            beforeSwapReturnDelta: false, // DANGER: not needed, keeps NoOp risk off
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    /*//////////////////////////////////////////////////////////////
                        USER-FACING STATE-CHANGING FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Allow or revoke a router's ability to supply per-user addresses in hookData.
    ///         Only routers on this list can override the fee target via hookData.
    function setRouterAllowance(address router, bool allowed) external onlyOwner {
        if (router == address(0)) revert TrustGateHook__ZeroAddressRouter();
        allowedRouters[router] = allowed;
        emit RouterAllowanceUpdated(router, allowed);
    }

    /// @notice Propose a new trust threshold. Executes after THRESHOLD_UPDATE_DELAY (1 day).
    ///         Prevents flash-lowering the gate: an attacker cannot drop the threshold
    ///         in the same block as a malicious swap.
    /// @param newThreshold Must be between MIN_THRESHOLD (1) and 100 inclusive
    function proposeThreshold(uint256 newThreshold) external onlyOwner {
        if (newThreshold > 100) revert TrustGateHook__InvalidThreshold(newThreshold);
        if (newThreshold < MIN_THRESHOLD) revert TrustGateHook__ThresholdTooLow(newThreshold);
        pendingThreshold = newThreshold;
        pendingThresholdTime = block.timestamp + THRESHOLD_UPDATE_DELAY;
        emit ThresholdProposed(newThreshold, pendingThresholdTime);
    }

    /// @notice Execute a previously proposed threshold change after the timelock expires.
    function executeThresholdUpdate() external onlyOwner {
        if (pendingThreshold == 0) revert TrustGateHook__NoThresholdPending();
        if (block.timestamp < pendingThresholdTime) {
            revert TrustGateHook__ThresholdTimelockNotExpired(pendingThresholdTime);
        }
        uint256 old = trustThreshold;
        trustThreshold = pendingThreshold;
        pendingThreshold = 0;
        pendingThresholdTime = 0;
        emit ThresholdUpdated(old, trustThreshold);
    }

    /// @notice beforeSwap: trust-gate tokens + apply reputation-based dynamic fee
    /// @dev The pool MUST be initialized with a dynamic fee (0x800000) for the
    ///      fee override to take effect. We set LPFeeLibrary.OVERRIDE_FEE_FLAG (0x400000)
    ///      so V4 actually applies the returned fee value.
    ///
    ///      `sender` is the router address, not the end user.
    ///      For per-user fees, encode the user address in hookData as abi.encode(userAddress).
    ///      If hookData is empty or <32 bytes, fee is based on the router (`sender`).
    ///
    /// @dev SEED SCORES: Tokens with DataSource.SEED (unverified baseline) are rejected.
    ///      The updater must submit a verified score before the token can be swapped.
    ///
    /// @dev STALE SCORES: If oracle.getScore() reverts with StaleScore, the swap is BLOCKED.
    ///      This is conservative by design — a stale score cannot be trusted. The updater
    ///      service should refresh scores within SCORE_MAX_AGE (7 days).
    ///
    /// @dev NOTE on events + revert: SwapBlocked is NOT emitted on blocked swaps because
    ///      EVM reverts roll back all event logs. TrustScoreTooLow / StaleScore / SeedScoreRejected
    ///      errors carry full context for off-chain monitoring via revert data.
    function beforeSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata,
        bytes calldata hookData
    ) external override onlyPoolManager returns (bytes4, BeforeSwapDelta, uint24) {
        // Check currency0 trust score (stale score revert bubbles up → blocks swap)
        address token0 = Currency.unwrap(key.currency0);
        if (token0 != address(0)) {
            uint256 score0 = oracle.getScore(token0);
            if (score0 < trustThreshold) {
                revert TrustScoreTooLow(token0, score0, trustThreshold);
            }
            // Reject scores derived from seed/baseline data (not verified on-chain)
            if (oracle.getDataSource(token0) == TrustScoreOracle.DataSource.SEED) {
                revert TrustGateHook__SeedScoreRejected(token0);
            }
            emit TrustGateChecked(token0, score0, true);
        }

        // Check currency1 trust score (stale score revert bubbles up → blocks swap)
        address token1 = Currency.unwrap(key.currency1);
        if (token1 != address(0)) {
            uint256 score1 = oracle.getScore(token1);
            if (score1 < trustThreshold) {
                revert TrustScoreTooLow(token1, score1, trustThreshold);
            }
            // Reject scores derived from seed/baseline data (not verified on-chain)
            if (oracle.getDataSource(token1) == TrustScoreOracle.DataSource.SEED) {
                revert TrustGateHook__SeedScoreRejected(token1);
            }
            emit TrustGateChecked(token1, score1, true);
        }

        // Per-user fee: decode user address from hookData ONLY if the calling router
        // is on the allowedRouters whitelist. Unallowed routers always pay their own
        // router-level fee — they cannot spoof a high-reputation feeTarget.
        address feeTarget = sender;
        if (hookData.length >= 32 && allowedRouters[sender]) {
            feeTarget = abi.decode(hookData, (address));
        }

        uint256 feeBps = oracle.getUserFee(feeTarget);
        emit DynamicFeeApplied(feeTarget, feeBps);

        // V4 requires: fee (in pips = feeBps * 100) | OVERRIDE_FEE_FLAG (0x400000)
        // Without the flag, the returned value is silently ignored by the PoolManager.
        uint24 lpFeeOverride = uint24(feeBps * 100) | LPFeeLibrary.OVERRIDE_FEE_FLAG;

        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, lpFeeOverride);
    }
}
