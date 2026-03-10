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
///      the user address in `hookData` via a TRUSTED router (MAIAT-004).
///
/// @dev MAIAT-004: hookData user address is only decoded if `msg.sender` (the router)
///      is registered in `trustedRouters`. Untrusted routers have hookData ignored.
///
/// @dev MAIAT-005: trustThreshold changes are timelocked (24h delay via propose → execute).
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

    // MAIAT-004: Trusted router registry
    /// @notice Routers registered here may pass user addresses via hookData for per-user fees.
    ///         Untrusted routers: hookData is ignored, fee applied based on sender directly.
    mapping(address => bool) public trustedRouters;

    // MAIAT-005: Threshold change timelock (24h delay)
    uint256 public constant THRESHOLD_TIMELOCK_DELAY = 24 hours;
    /// @notice Pending new threshold value (0 if no pending change)
    uint256 public pendingThreshold;
    /// @notice Timestamp when the threshold was proposed (0 if no pending change)
    uint256 public pendingThresholdTimestamp;
    /// @notice True if a threshold change is pending and awaiting execution
    bool public hasThresholdPending;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted when a token passes the trust gate (swap allowed)
    event TrustGateChecked(address indexed token, uint256 score, bool passed);
    /// @notice Emitted when a threshold change is applied (MAIAT-005)
    event ThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    /// @notice Emitted when a threshold change is proposed (MAIAT-005)
    event ThresholdProposed(uint256 newThreshold, uint256 executeAfter);
    /// @notice Emitted when a pending threshold change is cancelled (MAIAT-005)
    event ThresholdCancelled(uint256 proposedThreshold);
    /// @notice Emitted when a dynamic fee is applied to a swap
    event DynamicFeeApplied(address indexed feeTarget, uint256 feeBps);
    /// @notice Emitted when a trusted router is added or removed (MAIAT-004)
    event TrustedRouterUpdated(address indexed router, bool trusted);

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error TrustScoreTooLow(address token, uint256 score, uint256 threshold);
    error TrustGateHook__ZeroAddress();
    error TrustGateHook__InvalidThreshold(uint256 threshold);
    error TrustGateHook__ThresholdTooLow(uint256 threshold);
    /// @notice Reverts when a token's score originates from unverified seed/baseline data
    error TrustGateHook__SeedScoreRejected(address token);
    /// @notice MAIAT-005: Reverts when executeThreshold is called before the 24h delay expires
    error TrustGateHook__TimelockNotExpired(uint256 executeAfter);
    /// @notice MAIAT-005: Reverts when executeThreshold/cancelThreshold is called with no pending change
    error TrustGateHook__NoPendingThreshold();

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

    /// @notice Register or remove a trusted router (MAIAT-004)
    /// @dev Only trusted routers may pass a user address in hookData for per-user fee discounts.
    ///      When a router is removed (trusted = false), its hookData will be ignored in future swaps.
    /// @param router The router contract address to register or deregister
    /// @param trusted True to trust the router, false to revoke
    function setTrustedRouter(address router, bool trusted) external onlyOwner {
        if (router == address(0)) revert TrustGateHook__ZeroAddress();
        trustedRouters[router] = trusted;
        emit TrustedRouterUpdated(router, trusted);
    }

    /// @notice Propose a new minimum trust threshold (MAIAT-005)
    /// @dev Initiates a 24-hour timelock. Validation happens at proposal time.
    ///      A new proposal overrides any existing pending change (resets the timer).
    ///      Call executeThreshold() after 24h to apply, or cancelThreshold() to abort.
    /// @param newThreshold Must be between MIN_THRESHOLD (1) and 100 inclusive
    function proposeThreshold(uint256 newThreshold) external onlyOwner {
        if (newThreshold > 100) revert TrustGateHook__InvalidThreshold(newThreshold);
        if (newThreshold < MIN_THRESHOLD) revert TrustGateHook__ThresholdTooLow(newThreshold);

        pendingThreshold = newThreshold;
        pendingThresholdTimestamp = block.timestamp;
        hasThresholdPending = true;

        emit ThresholdProposed(newThreshold, block.timestamp + THRESHOLD_TIMELOCK_DELAY);
    }

    /// @notice Apply the proposed threshold change after the 24-hour timelock (MAIAT-005)
    /// @dev Reverts if no change is pending or the delay has not elapsed.
    function executeThreshold() external onlyOwner {
        if (!hasThresholdPending) revert TrustGateHook__NoPendingThreshold();
        uint256 executeAfter = pendingThresholdTimestamp + THRESHOLD_TIMELOCK_DELAY;
        if (block.timestamp <= executeAfter) revert TrustGateHook__TimelockNotExpired(executeAfter);

        uint256 old = trustThreshold;
        trustThreshold = pendingThreshold;

        // Clear pending state
        hasThresholdPending = false;
        pendingThreshold = 0;
        pendingThresholdTimestamp = 0;

        emit ThresholdUpdated(old, trustThreshold);
    }

    /// @notice Cancel a pending threshold change (MAIAT-005)
    /// @dev Can be called at any time before execution to abort a proposed change.
    function cancelThreshold() external onlyOwner {
        if (!hasThresholdPending) revert TrustGateHook__NoPendingThreshold();
        uint256 cancelled = pendingThreshold;

        hasThresholdPending = false;
        pendingThreshold = 0;
        pendingThresholdTimestamp = 0;

        emit ThresholdCancelled(cancelled);
    }

    /// @notice beforeSwap: trust-gate tokens + apply reputation-based dynamic fee
    /// @dev The pool MUST be initialized with a dynamic fee (0x800000) for the
    ///      fee override to take effect. We set LPFeeLibrary.OVERRIDE_FEE_FLAG (0x400000)
    ///      so V4 actually applies the returned fee value.
    ///
    ///      `sender` is the router address, not the end user.
    ///      For per-user fees, the TRUSTED router must abi.encode(userAddress) in hookData.
    ///      If the sender is not a trusted router, hookData is ignored and fee uses sender.
    ///      If hookData is empty or <32 bytes, fee falls back to sender regardless of trust.
    ///
    /// @dev SEED SCORES: Tokens with DataSource.SEED (unverified baseline) are rejected.
    ///      The updater must submit a verified score before the token can be swapped.
    ///
    /// @dev STALE SCORES: If oracle.getScore() reverts with StaleScore, the swap is BLOCKED.
    ///      This is conservative by design — a stale score cannot be trusted.
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

        // MAIAT-004: Per-user fee via hookData — only if sender is a trusted router.
        // Untrusted routers: hookData is ignored, fee based on sender directly.
        // This prevents any router from spoofing a high-rep user's address to claim their fee discount.
        address feeTarget = sender;
        if (hookData.length >= 32 && trustedRouters[sender]) {
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
