// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice Integration tests: real TrustScoreOracle + real TrustGateHook, no mocks.
///         Tests the full flow: update score → swap gate decision.
///         These tests catch the class of bugs that MAIAT-001 would have prevented
///         (interface mismatches between caller and oracle).

import {Test, console2} from "forge-std/Test.sol";
import {TrustScoreOracle} from "../src/TrustScoreOracle.sol";
import {TrustGateHook} from "../src/TrustGateHook.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {SwapParams} from "v4-core/types/PoolOperation.sol";
import {LPFeeLibrary} from "v4-core/libraries/LPFeeLibrary.sol";

contract IntegrationTest is Test {
    TrustScoreOracle public oracle;
    TrustGateHook public hook;

    address public admin = address(this);
    address public mockPoolManager = address(0xBEEF);
    address public token0 = address(0x100);
    address public token1 = address(0x200);
    address public user = address(0x300);
    address public trustedRouter = address(0x400);
    address public untrustedRouter = address(0x500);

    function setUp() public {
        oracle = new TrustScoreOracle(admin);
        hook = new TrustGateHook(oracle, IPoolManager(mockPoolManager), admin, admin);
    }

    // ─── Helpers ───────────────────────────────────────────────

    /// @dev Set oracle scores and warp past SCORE_MIN_AGE so they're accepted by the hook
    function _setScores(address t0, uint256 s0, address t1, uint256 s1) internal {
        oracle.updateTokenScore(t0, s0, 10, 400, TrustScoreOracle.DataSource.VERIFIED);
        oracle.updateTokenScore(t1, s1, 10, 400, TrustScoreOracle.DataSource.VERIFIED);
        vm.warp(block.timestamp + oracle.SCORE_MIN_AGE() + 1);
    }

    function _setScoresWithSource(
        address t0, uint256 s0, uint256 r0, uint256 avg0, TrustScoreOracle.DataSource ds0,
        address t1, uint256 s1, uint256 r1, uint256 avg1, TrustScoreOracle.DataSource ds1
    ) internal {
        oracle.updateTokenScore(t0, s0, r0, avg0, ds0);
        oracle.updateTokenScore(t1, s1, r1, avg1, ds1);
        vm.warp(block.timestamp + oracle.SCORE_MIN_AGE() + 1);
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

    // ─── Integration Test 1: Real oracle score → hook gate ─────

    /// @notice Full flow: update real oracle scores → hook queries real oracle → swap allowed
    function test_Integration_UpdateScore_SwapPasses() public {
        _setScoresWithSource(
            token0, 80, 100, 450, TrustScoreOracle.DataSource.VERIFIED,
            token1, 70, 50, 400, TrustScoreOracle.DataSource.API
        );

        vm.prank(mockPoolManager);
        (bytes4 sel,,) = hook.beforeSwap(user, _makeKey(), _makeParams(), "");
        assertEq(sel, IHooks.beforeSwap.selector);
    }

    // ─── Integration Test 2: Low score blocks swap ──────────────

    /// @notice Real oracle: low score → hook blocks the swap
    function test_Integration_LowScore_BlocksSwap() public {
        _setScoresWithSource(
            token0, 10, 5, 200, TrustScoreOracle.DataSource.API,
            token1, 80, 50, 400, TrustScoreOracle.DataSource.VERIFIED
        );

        vm.prank(mockPoolManager);
        vm.expectRevert(abi.encodeWithSelector(TrustGateHook.TrustScoreTooLow.selector, token0, 10, 30));
        hook.beforeSwap(user, _makeKey(), _makeParams(), "");
    }

    // ─── Integration Test 3: Reputation fee full flow ───────────

    /// @notice Update user rep on real oracle → trusted router passes it to hook → correct fee
    function test_Integration_ReputationFee_FullFlow() public {
        _setScoresWithSource(
            token0, 80, 100, 450, TrustScoreOracle.DataSource.VERIFIED,
            token1, 80, 100, 450, TrustScoreOracle.DataSource.VERIFIED
        );
        oracle.updateUserReputation(user, 200, 50, 1000); // Guardian tier: fee = 0%

        hook.setRouterAllowance(trustedRouter, true);
        bytes memory hookData = abi.encode(user);

        vm.prank(mockPoolManager);
        (,, uint24 fee) = hook.beforeSwap(trustedRouter, _makeKey(), _makeParams(), hookData);

        // Real oracle.getUserFee(user) should return GUARDIAN_FEE = 0
        assertEq(oracle.getUserFee(user), oracle.GUARDIAN_FEE()); // sanity check
        assertEq(fee, uint24(0) | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    // ─── Integration Test 4: Seed score rejected ────────────────

    /// @notice SEED-sourced scores are blocked even with high numeric value
    function test_Integration_SeedScore_BlocksSwap() public {
        _setScoresWithSource(
            token0, 90, 5, 400, TrustScoreOracle.DataSource.SEED,
            token1, 80, 50, 400, TrustScoreOracle.DataSource.VERIFIED
        );

        vm.prank(mockPoolManager);
        vm.expectRevert(abi.encodeWithSelector(TrustGateHook.TrustGateHook__SeedScoreRejected.selector, token0));
        hook.beforeSwap(user, _makeKey(), _makeParams(), "");
    }

    // ─── Integration Test 5: Stale score blocks swap ────────────

    /// @notice Stale oracle data → hook blocks swap (fail-safe behavior)
    function test_Integration_StaleScore_BlocksSwap() public {
        _setScoresWithSource(
            token0, 80, 100, 450, TrustScoreOracle.DataSource.VERIFIED,
            token1, 80, 100, 450, TrustScoreOracle.DataSource.VERIFIED
        );

        vm.warp(block.timestamp + 8 days); // Past SCORE_MAX_AGE (7 days)

        vm.prank(mockPoolManager);
        vm.expectRevert(); // TrustScoreOracle__StaleScore bubbles up through hook
        hook.beforeSwap(user, _makeKey(), _makeParams(), "");
    }

    // ─── Integration Test 6: Score refresh enables swap ─────────

    /// @notice Refresh stale oracle data → swap becomes allowed again
    function test_Integration_ScoreRefresh_ReenablesSwap() public {
        _setScoresWithSource(
            token0, 80, 100, 450, TrustScoreOracle.DataSource.VERIFIED,
            token1, 80, 100, 450, TrustScoreOracle.DataSource.VERIFIED
        );

        vm.warp(block.timestamp + 8 days); // Scores go stale

        // Verify stale state blocks swaps
        vm.prank(mockPoolManager);
        vm.expectRevert();
        hook.beforeSwap(user, _makeKey(), _makeParams(), "");

        // Refresh scores + warp past MIN_AGE
        _setScoresWithSource(
            token0, 80, 100, 450, TrustScoreOracle.DataSource.VERIFIED,
            token1, 80, 100, 450, TrustScoreOracle.DataSource.VERIFIED
        );

        // Swap now passes
        vm.prank(mockPoolManager);
        (bytes4 sel,,) = hook.beforeSwap(user, _makeKey(), _makeParams(), "");
        assertEq(sel, IHooks.beforeSwap.selector);
    }

    // ─── Integration Test 7: MAIAT-002 rate limiting blocks flash manipulation ──

    /// @notice Flash score manipulation is blocked by SCORE_MIN_AGE on real oracle
    function test_Integration_RateLimiting_PreventsFlashManipulation() public {
        _setScoresWithSource(
            token0, 5, 2, 100, TrustScoreOracle.DataSource.API,
            token1, 80, 50, 400, TrustScoreOracle.DataSource.VERIFIED
        );

        // Swap blocked initially (token0 score = 5 < threshold 30)
        vm.prank(mockPoolManager);
        vm.expectRevert(abi.encodeWithSelector(TrustGateHook.TrustScoreTooLow.selector, token0, 5, 30));
        hook.beforeSwap(user, _makeKey(), _makeParams(), "");

        // Attacker updates token0 to 80 — but SCORE_MIN_AGE prevents immediate use
        oracle.updateTokenScore(token0, 80, 10, 400, TrustScoreOracle.DataSource.VERIFIED);

        // Swap still fails: token0 score was JUST updated → ScoreTooFresh
        vm.prank(mockPoolManager);
        vm.expectRevert();
        hook.beforeSwap(user, _makeKey(), _makeParams(), "");

        // After SCORE_MIN_AGE, the new score is accepted
        vm.warp(block.timestamp + oracle.SCORE_MIN_AGE() + 1);
        vm.prank(mockPoolManager);
        (bytes4 sel,,) = hook.beforeSwap(user, _makeKey(), _makeParams(), "");
        assertEq(sel, IHooks.beforeSwap.selector);
    }

    // ─── Integration Test 8: Gradual score improvement allows swap ──

    /// @notice Legitimate gradual score improvement eventually allows swaps
    function test_Integration_GradualScoreImprovement_EnablesSwap() public {
        _setScoresWithSource(
            token0, 10, 5, 200, TrustScoreOracle.DataSource.API,
            token1, 80, 50, 400, TrustScoreOracle.DataSource.VERIFIED
        );

        // token0 score=10 < threshold=30 → blocked
        vm.prank(mockPoolManager);
        vm.expectRevert();
        hook.beforeSwap(user, _makeKey(), _makeParams(), "");

        // Improve score to threshold + warp past MIN_AGE
        oracle.updateTokenScore(token0, 30, 15, 300, TrustScoreOracle.DataSource.API);
        oracle.updateTokenScore(token1, 80, 50, 400, TrustScoreOracle.DataSource.VERIFIED);
        vm.warp(block.timestamp + oracle.SCORE_MIN_AGE() + 1);

        // Now at threshold exactly — swap passes
        vm.prank(mockPoolManager);
        (bytes4 sel,,) = hook.beforeSwap(user, _makeKey(), _makeParams(), "");
        assertEq(sel, IHooks.beforeSwap.selector);
    }

    // ─── Integration Test 9: MAIAT-004 trusted router hookData ─

    /// @notice Only trusted routers can pass user addresses via hookData
    function test_Integration_TrustedRouter_PerUserFee() public {
        _setScoresWithSource(
            token0, 80, 100, 450, TrustScoreOracle.DataSource.VERIFIED,
            token1, 80, 100, 450, TrustScoreOracle.DataSource.VERIFIED
        );
        oracle.updateUserReputation(user, 250, 50, 5000); // Guardian tier

        bytes memory hookData = abi.encode(user);

        // Untrusted router: hookData ignored → gets BASE_FEE (50 bps)
        vm.prank(mockPoolManager);
        (,, uint24 fee1) = hook.beforeSwap(untrustedRouter, _makeKey(), _makeParams(), hookData);
        assertEq(fee1, uint24(50 * 100) | LPFeeLibrary.OVERRIDE_FEE_FLAG);

        // Register trustedRouter
        hook.setRouterAllowance(trustedRouter, true);

        // Trusted router: hookData decoded → gets user's Guardian fee (0 bps)
        vm.prank(mockPoolManager);
        (,, uint24 fee2) = hook.beforeSwap(trustedRouter, _makeKey(), _makeParams(), hookData);
        assertEq(fee2, uint24(0) | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    // ─── Integration Test 10: MAIAT-005 threshold timelock ──────

    /// @notice Threshold changes require 24h delay — prevents instant manipulation
    function test_Integration_ThresholdTimelock_FullFlow() public {
        _setScoresWithSource(
            token0, 10, 5, 200, TrustScoreOracle.DataSource.API,
            token1, 80, 50, 400, TrustScoreOracle.DataSource.VERIFIED
        );

        // token0 (score=10) blocked by threshold=30
        vm.prank(mockPoolManager);
        vm.expectRevert();
        hook.beforeSwap(user, _makeKey(), _makeParams(), "");

        // Propose lowering threshold to 5
        hook.proposeThreshold(5);
        uint256 timelockExpiry = block.timestamp + 24 hours;

        // Cannot execute immediately — must wait 24h
        vm.expectRevert(
            abi.encodeWithSelector(TrustGateHook.TrustGateHook__ThresholdTimelockNotExpired.selector, timelockExpiry)
        );
        hook.executeThresholdUpdate();

        // Swap still blocked (threshold still 30)
        vm.prank(mockPoolManager);
        vm.expectRevert();
        hook.beforeSwap(user, _makeKey(), _makeParams(), "");

        // Wait 24h
        vm.warp(block.timestamp + 24 hours + 1);
        hook.executeThresholdUpdate();
        assertEq(hook.trustThreshold(), 5);

        // Re-seed scores (may have gone stale during 24h warp)
        _setScoresWithSource(
            token0, 10, 5, 200, TrustScoreOracle.DataSource.API,
            token1, 80, 50, 400, TrustScoreOracle.DataSource.VERIFIED
        );

        // Now token0 (score=10 > threshold=5) → swap passes
        vm.prank(mockPoolManager);
        (bytes4 sel,,) = hook.beforeSwap(user, _makeKey(), _makeParams(), "");
        assertEq(sel, IHooks.beforeSwap.selector);
    }

    // ─── Integration Test 11: Cancel threshold, swap still blocked ──

    function test_Integration_CancelThreshold_SwapRemainsBlocked() public {
        vm.warp(10_000); // start at known timestamp
        _setScoresWithSource(
            token0, 10, 5, 200, TrustScoreOracle.DataSource.API,
            token1, 80, 50, 400, TrustScoreOracle.DataSource.VERIFIED
        );
        // Now at ~13601

        hook.proposeThreshold(5);

        // Wait 24h
        vm.warp(100_000);

        // Override with a new proposal (effectively cancels the old one)
        hook.proposeThreshold(30);

        // Wait another 24h+
        vm.warp(200_000);
        hook.executeThresholdUpdate();
        assertEq(hook.trustThreshold(), 30); // still original threshold

        // Re-seed scores after long warps
        _setScoresWithSource(
            token0, 10, 5, 200, TrustScoreOracle.DataSource.API,
            token1, 80, 50, 400, TrustScoreOracle.DataSource.VERIFIED
        );

        // token0 still blocked (score=10 < threshold=30)
        vm.prank(mockPoolManager);
        vm.expectRevert();
        hook.beforeSwap(user, _makeKey(), _makeParams(), "");
    }

    // ─── Integration Test 12: Emergency oracle update ───────────

    /// @notice Admin can update scores — after MIN_AGE, new score is live
    function test_Integration_EmergencyUpdate_LargeCorrection() public {
        _setScoresWithSource(
            token0, 5, 2, 100, TrustScoreOracle.DataSource.API,
            token1, 80, 50, 400, TrustScoreOracle.DataSource.VERIFIED
        );

        vm.prank(mockPoolManager);
        vm.expectRevert();
        hook.beforeSwap(user, _makeKey(), _makeParams(), "");

        // Update token0 from 5 → 80 + warp past MIN_AGE
        _setScoresWithSource(
            token0, 80, 50, 420, TrustScoreOracle.DataSource.VERIFIED,
            token1, 80, 50, 400, TrustScoreOracle.DataSource.VERIFIED
        );

        // Swap now passes
        vm.prank(mockPoolManager);
        (bytes4 sel,,) = hook.beforeSwap(user, _makeKey(), _makeParams(), "");
        assertEq(sel, IHooks.beforeSwap.selector);
    }

    // ─── Integration Test 13: Multiple tokens, mixed scores ─────

    function test_Integration_MixedTokenScores_BothMustPass() public {
        _setScoresWithSource(
            token0, 80, 10, 400, TrustScoreOracle.DataSource.VERIFIED,
            token1, 20, 5, 200, TrustScoreOracle.DataSource.API
        );

        vm.prank(mockPoolManager);
        vm.expectRevert(abi.encodeWithSelector(TrustGateHook.TrustScoreTooLow.selector, token1, 20, 30));
        hook.beforeSwap(user, _makeKey(), _makeParams(), "");

        // Improve token1 past threshold + warp past MIN_AGE
        _setScoresWithSource(
            token0, 80, 10, 400, TrustScoreOracle.DataSource.VERIFIED,
            token1, 40, 10, 350, TrustScoreOracle.DataSource.API
        );

        vm.prank(mockPoolManager);
        (bytes4 sel,,) = hook.beforeSwap(user, _makeKey(), _makeParams(), "");
        assertEq(sel, IHooks.beforeSwap.selector);
    }

    // ─── Integration Test 14: Complete mainnet readiness check ──

    /// @notice Simulates a complete realistic mainnet scenario
    function test_Integration_MainnetScenario_EndToEnd() public {
        // 1. Deploy and configure
        hook.setRouterAllowance(trustedRouter, true);

        // 2. Seed initial scores via oracle + warp past MIN_AGE
        _setScoresWithSource(
            token0, 75, 200, 440, TrustScoreOracle.DataSource.VERIFIED,
            token1, 65, 150, 420, TrustScoreOracle.DataSource.COMMUNITY
        );

        // 3. New user swaps → BASE_FEE
        vm.prank(mockPoolManager);
        (bytes4 sel1,, uint24 fee1) = hook.beforeSwap(user, _makeKey(), _makeParams(), "");
        assertEq(sel1, IHooks.beforeSwap.selector);
        assertEq(fee1, uint24(50 * 100) | LPFeeLibrary.OVERRIDE_FEE_FLAG);

        // 4. User earns reputation over time → GUARDIAN tier
        oracle.updateUserReputation(user, 250, 75, 5000);

        // 5. Trusted router passes user address in hookData → GUARDIAN fee (0%)
        bytes memory hookData = abi.encode(user);
        vm.prank(mockPoolManager);
        (bytes4 sel2,, uint24 fee2) = hook.beforeSwap(trustedRouter, _makeKey(), _makeParams(), hookData);
        assertEq(sel2, IHooks.beforeSwap.selector);
        assertEq(fee2, uint24(0) | LPFeeLibrary.OVERRIDE_FEE_FLAG);

        // 6. Propose threshold change (governance action)
        hook.proposeThreshold(40);
        assertTrue(hook.pendingThreshold() > 0);

        // 7. Wait 24h and execute
        vm.warp(block.timestamp + 24 hours + 1);
        hook.executeThresholdUpdate();
        assertEq(hook.trustThreshold(), 40);

        // 8. Re-seed scores (may have gone stale during 24h warp)
        _setScoresWithSource(
            token0, 75, 200, 440, TrustScoreOracle.DataSource.VERIFIED,
            token1, 65, 150, 420, TrustScoreOracle.DataSource.COMMUNITY
        );
        // token1 (score=65) still passes new threshold=40
        vm.prank(mockPoolManager);
        (bytes4 sel3,,) = hook.beforeSwap(user, _makeKey(), _makeParams(), "");
        assertEq(sel3, IHooks.beforeSwap.selector);

        // 9. Score freshness: warp 7+ days → stale → swap blocked
        vm.warp(block.timestamp + 7 days + 1);
        vm.prank(mockPoolManager);
        vm.expectRevert();
        hook.beforeSwap(user, _makeKey(), _makeParams(), "");
    }
}
