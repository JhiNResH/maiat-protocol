// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @custom:security-contact security@maiat.xyz
 */

import {BaseTestHooks} from "v4-core/test/BaseTestHooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/types/BeforeSwapDelta.sol";
import {LPFeeLibrary} from "v4-core/libraries/LPFeeLibrary.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {SwapParams} from "v4-core/types/PoolOperation.sol";
import {TrustScoreOracle} from "./TrustScoreOracle.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

/// @title TrustGateHook
/// @notice Uniswap V4 hook: trust-gated swaps + reputation-based dynamic fees
/// @dev Queries TrustScoreOracle for token scores AND user reputation fees
///
/// How it works:
/// 1. beforeSwap: Check token trust scores → block low-trust tokens
/// 2. Dynamic fee: User reputation score → lower fees for trusted reviewers
/// 3. Community reviews feed the oracle → reviews = lower fees = real economic value
///
/// Fee tiers (from TrustScoreOracle):
///   Guardian (200+ rep): 0% fee
///   Verified (50+ rep):  0.1% fee
///   Trusted (10+ rep):   0.3% fee
///   New (0-9 rep):       0.5% fee
///
/// @dev NOTE: For production, replace BaseTestHooks with a production-grade base hook.
///      BaseTestHooks is a test utility from v4-core and should not be used in mainnet deployments.
contract TrustGateHook is BaseTestHooks, Ownable {
    using BeforeSwapDeltaLibrary for BeforeSwapDelta;
    using LPFeeLibrary for uint24;

    TrustScoreOracle public immutable oracle;
    IPoolManager public immutable poolManager;
    uint256 public trustThreshold;

    event TrustGateChecked(address indexed token, uint256 score, bool passed);
    event SwapBlocked(address indexed token, uint256 score, uint256 threshold);
    event ThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    event DynamicFeeApplied(address indexed swapper, uint256 feeBps);

    error TrustScoreTooLow(address token, uint256 score, uint256 threshold);
    error TrustGateHook__ZeroAddress();
    error TrustGateHook__NotPoolManager(address caller);
    error TrustGateHook__InvalidThreshold(uint256 threshold);

    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert TrustGateHook__NotPoolManager(msg.sender);
        _;
    }

    constructor(
        TrustScoreOracle _oracle,
        IPoolManager _poolManager,
        address initialOwner
    ) Ownable(initialOwner) {
        if (address(_oracle) == address(0)) revert TrustGateHook__ZeroAddress();
        if (address(_poolManager) == address(0)) revert TrustGateHook__ZeroAddress();
        if (initialOwner == address(0)) revert TrustGateHook__ZeroAddress();

        oracle = _oracle;
        poolManager = _poolManager;
        trustThreshold = 30; // Block tokens with score < 30
    }

    function updateThreshold(uint256 newThreshold) external onlyOwner {
        if (newThreshold > 100) revert TrustGateHook__InvalidThreshold(newThreshold);
        uint256 old = trustThreshold;
        trustThreshold = newThreshold;
        emit ThresholdUpdated(old, newThreshold);
    }

    /// @notice beforeSwap: trust-gate tokens + apply reputation-based dynamic fee
    /// @dev The pool MUST be initialized with a dynamic fee (0x800000) for the
    ///      fee override to take effect. We set LPFeeLibrary.OVERRIDE_FEE_FLAG (0x400000)
    ///      so V4 actually applies the returned fee value.
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
                emit SwapBlocked(token0, score0, trustThreshold);
                revert TrustScoreTooLow(token0, score0, trustThreshold);
            }
            emit TrustGateChecked(token0, score0, true);
        }

        // Check currency1 trust score
        address token1 = Currency.unwrap(key.currency1);
        if (token1 != address(0)) {
            uint256 score1 = oracle.getScore(token1);
            if (score1 < trustThreshold) {
                emit SwapBlocked(token1, score1, trustThreshold);
                revert TrustScoreTooLow(token1, score1, trustThreshold);
            }
            emit TrustGateChecked(token1, score1, true);
        }

        // Dynamic fee based on user reputation
        uint256 feeBps = oracle.getUserFee(sender);
        emit DynamicFeeApplied(sender, feeBps);

        // V4 requires: fee (in pips = feeBps * 100) | OVERRIDE_FEE_FLAG (0x400000)
        // Without the flag, the returned value is silently ignored by the PoolManager.
        uint24 lpFeeOverride = uint24(feeBps * 100) | LPFeeLibrary.OVERRIDE_FEE_FLAG;

        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, lpFeeOverride);
    }
}
