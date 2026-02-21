// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {TrustGateHook} from "../src/TrustGateHook.sol";
import {TrustScoreOracle} from "../src/TrustScoreOracle.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {LPFeeLibrary} from "v4-core/libraries/LPFeeLibrary.sol";

contract TrustGateHookTest is Test {
    TrustGateHook    public hook;
    TrustScoreOracle public oracle;

    address public owner           = address(this);
    address public attacker        = address(0xBAD);
    address public swapper         = address(0xABC);
    address public token0          = address(0x2);
    address public token1          = address(0x3);
    address public mockPoolManager = address(0xBEEF);

    uint256 constant DEFAULT_THRESHOLD = 30;

    event DynamicFeeApplied(address indexed swapper, uint256 feeBps);
    event TrustGateChecked(address indexed token, uint256 score, bool passed);
    event SwapBlocked(address indexed token, uint256 score, uint256 threshold);
    event ThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

    function setUp() public {
        oracle = new TrustScoreOracle(owner);
        hook   = new TrustGateHook(oracle, IPoolManager(mockPoolManager), owner);
    }

    // ─── Helpers ───────────────────────────────────────────────

    function _setScores(uint256 s0, uint256 s1) internal {
        oracle.updateTokenScore(token0, s0, 10, 400);
        oracle.updateTokenScore(token1, s1, 10, 400);
    }

    function _makeKey() internal view returns (PoolKey memory) {
        return PoolKey({
            currency0:   Currency.wrap(token0),
            currency1:   Currency.wrap(token1),
            fee:         3000,
            tickSpacing: 60,
            hooks:       IHooks(address(hook))
        });
    }

    function _makeParams() internal pure returns (IPoolManager.SwapParams memory) {
        return IPoolManager.SwapParams({zeroForOne: true, amountSpecified: -100, sqrtPriceLimitX96: 0});
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
        // Ownable base constructor reverts before our custom check runs
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

    // ─── updateThreshold ───────────────────────────────────────

    function test_UpdateThreshold_Success() public {
        hook.updateThreshold(70);
        assertEq(hook.trustThreshold(), 70);
    }

    function test_UpdateThreshold_Zero() public {
        hook.updateThreshold(0);
        assertEq(hook.trustThreshold(), 0);
    }

    function test_UpdateThreshold_Hundred() public {
        hook.updateThreshold(100);
        assertEq(hook.trustThreshold(), 100);
    }

    function test_UpdateThreshold_InvalidReverts() public {
        vm.expectRevert(abi.encodeWithSelector(TrustGateHook.TrustGateHook__InvalidThreshold.selector, 101));
        hook.updateThreshold(101);
    }

    function test_UpdateThreshold_NotOwnerReverts() public {
        vm.prank(attacker);
        vm.expectRevert();
        hook.updateThreshold(70);
    }

    function test_UpdateThreshold_EmitsEvent() public {
        vm.expectEmit(false, false, false, true);
        emit ThresholdUpdated(DEFAULT_THRESHOLD, 80);
        hook.updateThreshold(80);
    }

    // ─── beforeSwap: access control ────────────────────────────

    function test_BeforeSwap_NotPoolManager_Reverts() public {
        _setScores(80, 80);
        vm.expectRevert(
            abi.encodeWithSelector(TrustGateHook.TrustGateHook__NotPoolManager.selector, address(this))
        );
        hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");
    }

    function test_BeforeSwap_AttackerReverts() public {
        _setScores(80, 80);
        vm.prank(attacker);
        vm.expectRevert(
            abi.encodeWithSelector(TrustGateHook.TrustGateHook__NotPoolManager.selector, attacker)
        );
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
        _setScores(10, 90); // token0 score 10 < threshold 30
        vm.prank(mockPoolManager);
        vm.expectRevert(
            abi.encodeWithSelector(TrustGateHook.TrustScoreTooLow.selector, token0, 10, DEFAULT_THRESHOLD)
        );
        hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");
    }

    function test_BeforeSwap_Token1LowScore_Reverts() public {
        _setScores(80, 10); // token1 score 10 < threshold 30
        vm.prank(mockPoolManager);
        vm.expectRevert(
            abi.encodeWithSelector(TrustGateHook.TrustScoreTooLow.selector, token1, 10, DEFAULT_THRESHOLD)
        );
        hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");
    }

    function test_BeforeSwap_UnregisteredToken_Reverts() public {
        // Score 0 < threshold 30 → denied
        vm.prank(mockPoolManager);
        vm.expectRevert(
            abi.encodeWithSelector(TrustGateHook.TrustScoreTooLow.selector, token0, 0, DEFAULT_THRESHOLD)
        );
        hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");
    }

    function test_BeforeSwap_LowerThreshold_AllowsPreviouslyBlocked() public {
        _setScores(10, 10); // blocked at threshold 30
        vm.prank(mockPoolManager);
        vm.expectRevert();
        hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");

        hook.updateThreshold(5); // now passes
        vm.prank(mockPoolManager);
        (bytes4 sel,,) = hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");
        assertEq(sel, IHooks.beforeSwap.selector);
    }

    // ─── beforeSwap: dynamic fee ───────────────────────────────

    function test_BeforeSwap_NewUserGetsBaseFee() public {
        _setScores(80, 80);
        // swapper has no reputation → BASE_FEE = 50 bps → lpFeeOverride = 5000
        vm.prank(mockPoolManager);
        (,, uint24 fee) = hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");
        assertEq(fee, uint24(50 * 100) | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    function test_BeforeSwap_TrustedUserGetsTrustedFee() public {
        _setScores(80, 80);
        oracle.updateUserReputation(swapper, 25, 5, 100); // 10 <= 25 < 50 → TRUSTED_FEE = 30 bps

        vm.prank(mockPoolManager);
        (,, uint24 fee) = hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");
        assertEq(fee, uint24(30 * 100) | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    function test_BeforeSwap_VerifiedUserGetsVerifiedFee() public {
        _setScores(80, 80);
        oracle.updateUserReputation(swapper, 100, 20, 500); // 50 <= 100 < 200 → VERIFIED_FEE = 10 bps

        vm.prank(mockPoolManager);
        (,, uint24 fee) = hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");
        assertEq(fee, uint24(10 * 100) | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    function test_BeforeSwap_GuardianUserGetsZeroFee() public {
        _setScores(80, 80);
        oracle.updateUserReputation(swapper, 250, 50, 10000); // >= 200 → GUARDIAN_FEE = 0 bps

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
        oracle.updateTokenScore(token1, 80, 10, 400);
        PoolKey memory ethKey = PoolKey({
            currency0:   Currency.wrap(address(0)), // native ETH — skipped
            currency1:   Currency.wrap(token1),
            fee:         3000,
            tickSpacing: 60,
            hooks:       IHooks(address(hook))
        });
        vm.prank(mockPoolManager);
        (bytes4 sel,,) = hook.beforeSwap(swapper, ethKey, _makeParams(), "");
        assertEq(sel, IHooks.beforeSwap.selector);
    }

    // ─── Fuzz ──────────────────────────────────────────────────

    function testFuzz_ScoreThreshold(uint256 score, uint256 threshold) public {
        score     = bound(score,     0, 100);
        threshold = bound(threshold, 0, 100);

        oracle.updateTokenScore(token0, score, 10, 400);
        oracle.updateTokenScore(token1, score, 10, 400);
        hook.updateThreshold(threshold);

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
            oracle.updateTokenScore(token0, score, 0, 0);
        } else {
            oracle.updateTokenScore(token0, score, 0, 0);
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
