// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {TrustGateHook} from "../src/TrustGateHook.sol";
import {BaseHook} from "../src/base/BaseHook.sol";
import {TrustScoreOracle} from "../src/TrustScoreOracle.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {SwapParams} from "v4-core/types/PoolOperation.sol";
import {LPFeeLibrary} from "v4-core/libraries/LPFeeLibrary.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";

contract TrustGateHookTest is Test {
    TrustGateHook public hook;
    TrustScoreOracle public oracle;

    address public owner = address(this);
    address public attacker = address(0xBAD);
    address public swapper = address(0xABC);
    address public token0 = address(0x2);
    address public token1 = address(0x3);
    address public mockPoolManager = address(0xBEEF);
    address public trustedRouter = address(0x1234);

    uint256 constant DEFAULT_THRESHOLD = 30;
    uint256 constant TIMELOCK_DELAY = 24 hours;

    event DynamicFeeApplied(address indexed feeTarget, uint256 feeBps);
    event TrustGateChecked(address indexed token, uint256 score, bool passed);
    event ThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    event ThresholdProposed(uint256 newThreshold, uint256 executeAfter);
    event ThresholdCancelled(uint256 proposedThreshold);
    event TrustedRouterUpdated(address indexed router, bool trusted);

    function setUp() public {
        oracle = new TrustScoreOracle(owner);
        hook = new TrustGateHook(oracle, IPoolManager(mockPoolManager), owner);
    }

    // ─── Helpers ───────────────────────────────────────────────

    function _setScores(uint256 s0, uint256 s1) internal {
        oracle.updateTokenScore(token0, s0, 10, 400, TrustScoreOracle.DataSource.VERIFIED);
        oracle.updateTokenScore(token1, s1, 10, 400, TrustScoreOracle.DataSource.VERIFIED);
    }

    function _makeKey() internal view returns (PoolKey memory) {
        return PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
    }

    function _makeParams() internal pure returns (SwapParams memory) {
        return SwapParams({zeroForOne: true, amountSpecified: -100, sqrtPriceLimitX96: 0});
    }

    /// @dev Helper: propose + warp + execute threshold change
    function _executeThreshold(uint256 newThreshold) internal {
        hook.proposeThreshold(newThreshold);
        vm.warp(block.timestamp + TIMELOCK_DELAY + 1);
        hook.executeThreshold();
    }

    // ─── Constructor ───────────────────────────────────────────

    function test_Constructor_ZeroOracleReverts() public {
        vm.expectRevert(TrustGateHook.TrustGateHook__ZeroAddress.selector);
        new TrustGateHook(TrustScoreOracle(address(0)), IPoolManager(mockPoolManager), owner);
    }

    function test_Constructor_ZeroPoolManagerReverts() public {
        vm.expectRevert(TrustGateHook.TrustGateHook__ZeroAddress.selector);
        new TrustGateHook(oracle, IPoolManager(address(0)), owner);
    }

    function test_Constructor_ZeroOwnerReverts() public {
        vm.expectRevert();
        new TrustGateHook(oracle, IPoolManager(mockPoolManager), address(0));
    }

    function test_Constructor_DefaultThreshold() public view {
        assertEq(hook.trustThreshold(), DEFAULT_THRESHOLD);
    }

    function test_Constructor_StoresOracle() public view {
        assertEq(address(hook.oracle()), address(oracle));
    }

    function test_Constructor_StoresPoolManager() public view {
        assertEq(address(hook.poolManager()), mockPoolManager);
    }

    function test_Constructor_NoThresholdPending() public view {
        assertFalse(hook.hasThresholdPending());
    }

    // ─── proposeThreshold (MAIAT-005) ──────────────────────────

    function test_ProposeThreshold_Success() public {
        vm.expectEmit(false, false, false, true);
        emit ThresholdProposed(70, block.timestamp + TIMELOCK_DELAY);
        hook.proposeThreshold(70);

        assertTrue(hook.hasThresholdPending());
        assertEq(hook.pendingThreshold(), 70);
        assertEq(hook.pendingThresholdTimestamp(), block.timestamp);
    }

    function test_ProposeThreshold_Zero_Reverts() public {
        vm.expectRevert(abi.encodeWithSelector(TrustGateHook.TrustGateHook__ThresholdTooLow.selector, 0));
        hook.proposeThreshold(0);
    }

    function test_ProposeThreshold_Hundred_Accepted() public {
        hook.proposeThreshold(100);
        assertTrue(hook.hasThresholdPending());
        assertEq(hook.pendingThreshold(), 100);
    }

    function test_ProposeThreshold_InvalidReverts() public {
        vm.expectRevert(abi.encodeWithSelector(TrustGateHook.TrustGateHook__InvalidThreshold.selector, 101));
        hook.proposeThreshold(101);
    }

    function test_ProposeThreshold_NotOwnerReverts() public {
        vm.prank(attacker);
        vm.expectRevert();
        hook.proposeThreshold(70);
    }

    function test_ProposeThreshold_OverridesPendingChange() public {
        hook.proposeThreshold(70);
        // New proposal overrides the existing one (resets timer)
        vm.warp(block.timestamp + 1 hours);
        hook.proposeThreshold(80);
        assertEq(hook.pendingThreshold(), 80);
        assertEq(hook.pendingThresholdTimestamp(), block.timestamp);
    }

    // ─── executeThreshold (MAIAT-005) ──────────────────────────

    function test_ExecuteThreshold_Success() public {
        hook.proposeThreshold(70);
        vm.warp(block.timestamp + TIMELOCK_DELAY + 1);

        vm.expectEmit(false, false, false, true);
        emit ThresholdUpdated(DEFAULT_THRESHOLD, 70);
        hook.executeThreshold();

        assertEq(hook.trustThreshold(), 70);
        assertFalse(hook.hasThresholdPending());
        assertEq(hook.pendingThreshold(), 0);
        assertEq(hook.pendingThresholdTimestamp(), 0);
    }

    function test_ExecuteThreshold_BeforeDelay_Reverts() public {
        hook.proposeThreshold(70);
        uint256 executeAfter = block.timestamp + TIMELOCK_DELAY;

        vm.expectRevert(abi.encodeWithSelector(TrustGateHook.TrustGateHook__TimelockNotExpired.selector, executeAfter));
        hook.executeThreshold();
    }

    function test_ExecuteThreshold_ExactDelay_Reverts() public {
        hook.proposeThreshold(70);
        uint256 executeAfter = block.timestamp + TIMELOCK_DELAY;
        vm.warp(executeAfter); // exactly at boundary — not past

        vm.expectRevert(abi.encodeWithSelector(TrustGateHook.TrustGateHook__TimelockNotExpired.selector, executeAfter));
        hook.executeThreshold();
    }

    function test_ExecuteThreshold_AfterExactDelay_Passes() public {
        hook.proposeThreshold(70);
        vm.warp(block.timestamp + TIMELOCK_DELAY + 1);
        hook.executeThreshold();
        assertEq(hook.trustThreshold(), 70);
    }

    function test_ExecuteThreshold_NoPending_Reverts() public {
        vm.expectRevert(TrustGateHook.TrustGateHook__NoPendingThreshold.selector);
        hook.executeThreshold();
    }

    function test_ExecuteThreshold_NotOwnerReverts() public {
        hook.proposeThreshold(70);
        vm.warp(block.timestamp + TIMELOCK_DELAY + 1);
        vm.prank(attacker);
        vm.expectRevert();
        hook.executeThreshold();
    }

    // ─── cancelThreshold (MAIAT-005) ───────────────────────────

    function test_CancelThreshold_Success() public {
        hook.proposeThreshold(70);
        assertTrue(hook.hasThresholdPending());

        vm.expectEmit(false, false, false, true);
        emit ThresholdCancelled(70);
        hook.cancelThreshold();

        assertFalse(hook.hasThresholdPending());
        assertEq(hook.pendingThreshold(), 0);
        assertEq(hook.pendingThresholdTimestamp(), 0);
        // Original threshold unchanged
        assertEq(hook.trustThreshold(), DEFAULT_THRESHOLD);
    }

    function test_CancelThreshold_NoPending_Reverts() public {
        vm.expectRevert(TrustGateHook.TrustGateHook__NoPendingThreshold.selector);
        hook.cancelThreshold();
    }

    function test_CancelThreshold_NotOwnerReverts() public {
        hook.proposeThreshold(70);
        vm.prank(attacker);
        vm.expectRevert();
        hook.cancelThreshold();
    }

    function test_CancelThreshold_CanRepropose() public {
        hook.proposeThreshold(70);
        hook.cancelThreshold();
        // Should be able to propose again after cancel
        hook.proposeThreshold(80);
        assertTrue(hook.hasThresholdPending());
        assertEq(hook.pendingThreshold(), 80);
    }

    // ─── Threshold timelock prevents instant manipulation ───────

    function test_Timelock_PreventsAtomicThresholdManipulation() public {
        // Set scam token score to 10
        oracle.updateTokenScore(token0, 10, 5, 200, TrustScoreOracle.DataSource.API);
        oracle.updateTokenScore(token1, 80, 50, 400, TrustScoreOracle.DataSource.VERIFIED);

        // Try to atomically lower threshold to 1 (in same block)
        hook.proposeThreshold(1);
        uint256 timelockExpiry = block.timestamp + TIMELOCK_DELAY;

        // Cannot execute immediately — timelock not expired
        vm.prank(mockPoolManager);
        vm.expectRevert(); // TrustScoreTooLow: token0 score=10 < threshold=30
        hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");

        // Still blocked even after proposing — cannot execute before 24h
        vm.expectRevert(
            abi.encodeWithSelector(TrustGateHook.TrustGateHook__TimelockNotExpired.selector, timelockExpiry)
        );
        hook.executeThreshold();
    }

    // ─── setTrustedRouter (MAIAT-004) ──────────────────────────

    function test_SetTrustedRouter_Success() public {
        assertFalse(hook.trustedRouters(trustedRouter));

        vm.expectEmit(true, false, false, true);
        emit TrustedRouterUpdated(trustedRouter, true);
        hook.setTrustedRouter(trustedRouter, true);

        assertTrue(hook.trustedRouters(trustedRouter));
    }

    function test_SetTrustedRouter_Revoke() public {
        hook.setTrustedRouter(trustedRouter, true);
        assertTrue(hook.trustedRouters(trustedRouter));

        hook.setTrustedRouter(trustedRouter, false);
        assertFalse(hook.trustedRouters(trustedRouter));
    }

    function test_SetTrustedRouter_ZeroAddress_Reverts() public {
        vm.expectRevert(TrustGateHook.TrustGateHook__ZeroAddress.selector);
        hook.setTrustedRouter(address(0), true);
    }

    function test_SetTrustedRouter_NotOwnerReverts() public {
        vm.prank(attacker);
        vm.expectRevert();
        hook.setTrustedRouter(trustedRouter, true);
    }

    // ─── beforeSwap: access control ────────────────────────────

    function test_BeforeSwap_NotPoolManager_Reverts() public {
        _setScores(80, 80);
        vm.expectRevert(abi.encodeWithSelector(BaseHook.BaseHook__NotPoolManager.selector, address(this)));
        hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");
    }

    function test_BeforeSwap_AttackerReverts() public {
        _setScores(80, 80);
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(BaseHook.BaseHook__NotPoolManager.selector, attacker));
        hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");
    }

    // ─── beforeSwap: trust gating ──────────────────────────────

    function test_BeforeSwap_BothHighScore_Passes() public {
        _setScores(80, 90);
        vm.prank(mockPoolManager);
        (bytes4 sel,,) = hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");
        assertEq(sel, IHooks.beforeSwap.selector);
    }

    function test_BeforeSwap_ExactlyAtThreshold_Passes() public {
        _setScores(DEFAULT_THRESHOLD, DEFAULT_THRESHOLD);
        vm.prank(mockPoolManager);
        (bytes4 sel,,) = hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");
        assertEq(sel, IHooks.beforeSwap.selector);
    }

    function test_BeforeSwap_Token0LowScore_Reverts() public {
        _setScores(10, 90);
        vm.prank(mockPoolManager);
        vm.expectRevert(abi.encodeWithSelector(TrustGateHook.TrustScoreTooLow.selector, token0, 10, DEFAULT_THRESHOLD));
        hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");
    }

    function test_BeforeSwap_Token1LowScore_Reverts() public {
        _setScores(80, 10);
        vm.prank(mockPoolManager);
        vm.expectRevert(abi.encodeWithSelector(TrustGateHook.TrustScoreTooLow.selector, token1, 10, DEFAULT_THRESHOLD));
        hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");
    }

    function test_BeforeSwap_UnregisteredToken_Reverts() public {
        vm.prank(mockPoolManager);
        vm.expectRevert(abi.encodeWithSelector(TrustGateHook.TrustScoreTooLow.selector, token0, 0, DEFAULT_THRESHOLD));
        hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");
    }

    function test_BeforeSwap_LowerThreshold_AllowsPreviouslyBlocked() public {
        _setScores(10, 10); // blocked at threshold 30
        vm.prank(mockPoolManager);
        vm.expectRevert();
        hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");

        // MAIAT-005: threshold change requires timelock
        _executeThreshold(5); // now passes

        vm.prank(mockPoolManager);
        (bytes4 sel,,) = hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");
        assertEq(sel, IHooks.beforeSwap.selector);
    }

    // ─── beforeSwap: dynamic fee ───────────────────────────────

    function test_BeforeSwap_NewUserGetsBaseFee() public {
        _setScores(80, 80);
        vm.prank(mockPoolManager);
        (,, uint24 fee) = hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");
        assertEq(fee, uint24(50 * 100) | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    function test_BeforeSwap_TrustedUserGetsTrustedFee() public {
        _setScores(80, 80);
        oracle.updateUserReputation(swapper, 25, 5, 100);

        vm.prank(mockPoolManager);
        (,, uint24 fee) = hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");
        assertEq(fee, uint24(30 * 100) | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    function test_BeforeSwap_VerifiedUserGetsVerifiedFee() public {
        _setScores(80, 80);
        oracle.updateUserReputation(swapper, 100, 20, 500);

        vm.prank(mockPoolManager);
        (,, uint24 fee) = hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");
        assertEq(fee, uint24(10 * 100) | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    function test_BeforeSwap_GuardianUserGetsZeroFee() public {
        _setScores(80, 80);
        oracle.updateUserReputation(swapper, 250, 50, 10000);

        vm.prank(mockPoolManager);
        (,, uint24 fee) = hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");
        assertEq(fee, uint24(0) | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    function test_BeforeSwap_EmitsDynamicFeeEvent() public {
        _setScores(80, 80);
        vm.expectEmit(true, false, false, true);
        emit DynamicFeeApplied(swapper, 50); // new user = 50 bps

        vm.prank(mockPoolManager);
        hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");
    }

    // ─── Native ETH edge case ──────────────────────────────────

    function test_BeforeSwap_NativeETH_Skipped() public {
        oracle.updateTokenScore(token1, 80, 10, 400, TrustScoreOracle.DataSource.VERIFIED);
        PoolKey memory ethKey = PoolKey({
            currency0: Currency.wrap(address(0)), // native ETH — skipped
            currency1: Currency.wrap(token1),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
        vm.prank(mockPoolManager);
        (bytes4 sel,,) = hook.beforeSwap(swapper, ethKey, _makeParams(), "");
        assertEq(sel, IHooks.beforeSwap.selector);
    }

    // ─── Seed data source protection ─────────────────────────────

    function test_BeforeSwap_SeedDataSource_Reverts() public {
        oracle.updateTokenScore(token0, 90, 10, 400, TrustScoreOracle.DataSource.SEED);
        oracle.updateTokenScore(token1, 90, 10, 400, TrustScoreOracle.DataSource.VERIFIED);
        vm.prank(mockPoolManager);
        vm.expectRevert(abi.encodeWithSelector(TrustGateHook.TrustGateHook__SeedScoreRejected.selector, token0));
        hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");
    }

    function test_BeforeSwap_APIDataSource_Passes() public {
        oracle.updateTokenScore(token0, 80, 10, 400, TrustScoreOracle.DataSource.API);
        oracle.updateTokenScore(token1, 80, 10, 400, TrustScoreOracle.DataSource.COMMUNITY);
        vm.prank(mockPoolManager);
        (bytes4 sel,,) = hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");
        assertEq(sel, IHooks.beforeSwap.selector);
    }

    // ─── MAIAT-004: Trusted Router + hookData ──────────────────

    /// @dev After MAIAT-004 fix: untrusted router hookData is IGNORED.
    ///      The fee is applied based on sender (router) directly.
    function test_BeforeSwap_UntrustedRouter_HookDataIgnored() public {
        _setScores(80, 80);

        address highRepUser = address(0xBEEF);
        oracle.updateUserReputation(highRepUser, 200, 50, 1000); // Guardian tier

        // swapper (router) has base fee by default
        // Encode highRepUser in hookData — but swapper is NOT trusted → should be ignored
        bytes memory hookData = abi.encode(highRepUser);

        vm.prank(mockPoolManager);
        (,, uint24 fee) = hook.beforeSwap(swapper, _makeKey(), _makeParams(), hookData);

        // Fee should be swapper's fee (BASE_FEE = 50 bps), NOT highRepUser's (0%)
        uint256 expectedFee = oracle.BASE_FEE(); // 50
        assertEq(fee, uint24(expectedFee * 100) | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    /// @dev MAIAT-004: Trusted router hookData IS respected — per-user fee applied correctly.
    function test_BeforeSwap_TrustedRouter_HookDataRespected() public {
        _setScores(80, 80);

        address highRepUser = address(0xBEEF);
        oracle.updateUserReputation(highRepUser, 200, 50, 1000); // Guardian tier

        // Register swapper as trusted router
        hook.setTrustedRouter(swapper, true);

        bytes memory hookData = abi.encode(highRepUser);

        vm.prank(mockPoolManager);
        (,, uint24 fee) = hook.beforeSwap(swapper, _makeKey(), _makeParams(), hookData);

        // Fee should reflect highRepUser's Guardian tier (0%)
        assertEq(fee, uint24(0) | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    /// @dev MAIAT-004: After revoking trust, hookData is ignored again.
    function test_BeforeSwap_RevokedRouter_HookDataIgnored() public {
        _setScores(80, 80);

        address highRepUser = address(0xBEEF);
        oracle.updateUserReputation(highRepUser, 200, 50, 1000);

        hook.setTrustedRouter(swapper, true);
        bytes memory hookData = abi.encode(highRepUser);

        // Works while trusted
        vm.prank(mockPoolManager);
        (,, uint24 fee1) = hook.beforeSwap(swapper, _makeKey(), _makeParams(), hookData);
        assertEq(fee1, uint24(0) | LPFeeLibrary.OVERRIDE_FEE_FLAG);

        // Revoke trust
        hook.setTrustedRouter(swapper, false);

        // Now hookData is ignored — fee falls back to swapper (BASE_FEE)
        vm.prank(mockPoolManager);
        (,, uint24 fee2) = hook.beforeSwap(swapper, _makeKey(), _makeParams(), hookData);
        assertEq(fee2, uint24(50 * 100) | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    function test_BeforeSwap_EmptyHookData_FallsBackToSender() public {
        _setScores(80, 80);
        oracle.updateUserReputation(swapper, 50, 10, 0);

        vm.prank(mockPoolManager);
        (,, uint24 fee) = hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");

        uint256 expectedFee = oracle.getUserFee(swapper); // VERIFIED = 10 bps
        assertEq(fee, uint24(expectedFee * 100) | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    function test_BeforeSwap_TrustedRouter_EmptyHookData_FallsBackToSender() public {
        _setScores(80, 80);
        hook.setTrustedRouter(swapper, true);
        oracle.updateUserReputation(swapper, 50, 10, 0); // VERIFIED tier

        vm.prank(mockPoolManager);
        (,, uint24 fee) = hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");

        // Empty hookData → fallback to swapper (trusted router itself)
        uint256 expectedFee = oracle.getUserFee(swapper); // VERIFIED = 10 bps
        assertEq(fee, uint24(expectedFee * 100) | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    // ─── beforeSwap: stale oracle score ────────────────────────

    function test_BeforeSwap_StaleScore_BlocksSwap() public {
        _setScores(80, 80);
        vm.warp(block.timestamp + 7 days + 1);

        vm.prank(mockPoolManager);
        vm.expectRevert();
        hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");
    }

    function test_BeforeSwap_StaleScoreRefreshed_AllowsSwap() public {
        _setScores(80, 80);
        vm.warp(block.timestamp + 7 days + 1);

        // Refresh scores — warp already > MIN_UPDATE_INTERVAL, delta 0 ≤ 20
        _setScores(80, 80);

        vm.prank(mockPoolManager);
        (bytes4 sel,,) = hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");
        assertEq(sel, IHooks.beforeSwap.selector);
    }

    // ─── getHookPermissions ────────────────────────────────────

    function test_GetHookPermissions_OnlyBeforeSwapEnabled() public view {
        // MAIAT-013: Verify exact permissions bitmap — only beforeSwap should be true
        // Incorrect permissions could silently disable the trust gate
        Hooks.Permissions memory perms = hook.getHookPermissions();
        assertFalse(perms.beforeInitialize);
        assertFalse(perms.afterInitialize);
        assertFalse(perms.beforeAddLiquidity);
        assertFalse(perms.afterAddLiquidity);
        assertFalse(perms.beforeRemoveLiquidity);
        assertFalse(perms.afterRemoveLiquidity);
        assertTrue(perms.beforeSwap); // ← Only this should be true
        assertFalse(perms.afterSwap);
        assertFalse(perms.beforeDonate);
        assertFalse(perms.afterDonate);
        assertFalse(perms.beforeSwapReturnDelta);
        assertFalse(perms.afterSwapReturnDelta);
        assertFalse(perms.afterAddLiquidityReturnDelta);
        assertFalse(perms.afterRemoveLiquidityReturnDelta);
    }

    // ─── Fuzz ──────────────────────────────────────────────────

    function testFuzz_ScoreThreshold(uint256 score, uint256 threshold) public {
        score = bound(score, 0, 100);
        threshold = bound(threshold, hook.MIN_THRESHOLD(), 100);

        oracle.updateTokenScore(token0, score, 10, 400, TrustScoreOracle.DataSource.VERIFIED);
        oracle.updateTokenScore(token1, score, 10, 400, TrustScoreOracle.DataSource.VERIFIED);

        // MAIAT-005: use timelock pattern
        _executeThreshold(threshold);

        vm.prank(mockPoolManager);
        if (score >= threshold) {
            (bytes4 sel,,) = hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");
            assertEq(sel, IHooks.beforeSwap.selector);
        } else {
            vm.expectRevert();
            hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");
        }
    }

    function testFuzz_OracleScoreRange(uint256 score) public {
        if (score > 100) {
            vm.expectRevert(abi.encodeWithSelector(TrustScoreOracle.TrustScoreOracle__ScoreOutOfRange.selector, score));
            oracle.updateTokenScore(token0, score, 0, 0, TrustScoreOracle.DataSource.API);
        } else {
            oracle.updateTokenScore(token0, score, 0, 0, TrustScoreOracle.DataSource.API);
            assertEq(oracle.getScore(token0), score);
        }
    }

    function testFuzz_FeeBpsConversion(uint256 repScore) public {
        repScore = bound(repScore, 0, 500);
        _setScores(80, 80);
        oracle.updateUserReputation(swapper, repScore, 1, 0);

        vm.prank(mockPoolManager);
        (,, uint24 fee) = hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");

        uint256 expectedBps = oracle.getUserFee(swapper);
        assertEq(fee, uint24(expectedBps * 100) | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }
}


