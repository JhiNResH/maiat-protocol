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

contract TrustGateHookTest is Test {
    TrustGateHook public hook;
    TrustScoreOracle public oracle;

    address public owner = address(this);
    address public attacker = address(0xBAD);
    address public swapper = address(0xABC);
    address public token0 = address(0x2);
    address public token1 = address(0x3);
    address public mockPoolManager = address(0xBEEF);

    uint256 constant DEFAULT_THRESHOLD = 30;

    event DynamicFeeApplied(address indexed swapper, uint256 feeBps);
    event TrustGateChecked(address indexed token, uint256 score, bool passed);
    event SwapBlocked(address indexed token, uint256 score, uint256 threshold);
    event ThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

    // Trusted signer for EIP-712 tests
    uint256 internal signerPk = 0xA11CE;
    address internal signerAddr;

    function setUp() public {
        signerAddr = vm.addr(signerPk);
        oracle = new TrustScoreOracle(owner);
        hook = new TrustGateHook(oracle, IPoolManager(mockPoolManager), owner, signerAddr);
    }

    // ─── Helpers ───────────────────────────────────────────────

    function _setScores(uint256 s0, uint256 s1) internal {
        oracle.updateTokenScore(token0, s0, 10, 400, TrustScoreOracle.DataSource.VERIFIED);
        oracle.updateTokenScore(token1, s1, 10, 400, TrustScoreOracle.DataSource.VERIFIED);
        // Flash-manipulation guard: scores must age SCORE_MIN_AGE before they gate swaps.
        vm.warp(block.timestamp + oracle.SCORE_MIN_AGE() + 1);
    }

    /// @dev Propose + time-travel + execute a threshold change.
    function _changeThreshold(uint256 newThreshold) internal {
        hook.proposeThreshold(newThreshold);
        vm.warp(block.timestamp + hook.THRESHOLD_UPDATE_DELAY() + 1);
        hook.executeThresholdUpdate();
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

    function _swapParams() internal pure returns (SwapParams memory) {
        return SwapParams({zeroForOne: true, amountSpecified: -100, sqrtPriceLimitX96: 0});
    }

    // ─── Constructor ───────────────────────────────────────────

    function test_Constructor_ZeroOracleReverts() public {
        vm.expectRevert(TrustGateHook.TrustGateHook__ZeroAddress.selector);
        new TrustGateHook(TrustScoreOracle(address(0)), IPoolManager(mockPoolManager), owner, signerAddr);
    }

    function test_Constructor_ZeroPoolManagerReverts() public {
        vm.expectRevert(TrustGateHook.TrustGateHook__ZeroAddress.selector);
        new TrustGateHook(oracle, IPoolManager(address(0)), owner, signerAddr);
    }

    function test_Constructor_ZeroOwnerReverts() public {
        vm.expectRevert();
        new TrustGateHook(oracle, IPoolManager(mockPoolManager), address(0), signerAddr);
    }

    function test_Constructor_ZeroSignerAllowed() public {
        // Zero signer disables signed score mode — should not revert
        TrustGateHook h = new TrustGateHook(oracle, IPoolManager(mockPoolManager), owner, address(0));
        assertEq(h.trustedSigner(), address(0));
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

    // ─── proposeThreshold / executeThresholdUpdate (timelock) ────

    function test_UpdateThreshold_Success() public {
        _changeThreshold(70);
        assertEq(hook.trustThreshold(), 70);
    }

    function test_UpdateThreshold_Zero_Reverts() public {
        // threshold=0 would silently disable the trust gate — now rejected
        vm.expectRevert(abi.encodeWithSelector(TrustGateHook.TrustGateHook__ThresholdTooLow.selector, 0));
        hook.proposeThreshold(0);
    }

    function test_UpdateThreshold_Hundred() public {
        _changeThreshold(100);
        assertEq(hook.trustThreshold(), 100);
    }

    function test_UpdateThreshold_InvalidReverts() public {
        vm.expectRevert(abi.encodeWithSelector(TrustGateHook.TrustGateHook__InvalidThreshold.selector, 101));
        hook.proposeThreshold(101);
    }

    function test_UpdateThreshold_NotOwnerReverts() public {
        vm.prank(attacker);
        vm.expectRevert();
        hook.proposeThreshold(70);
    }

    function test_UpdateThreshold_ExecuteBeforeTimelock_Reverts() public {
        hook.proposeThreshold(70);
        vm.expectRevert(
            abi.encodeWithSelector(
                TrustGateHook.TrustGateHook__ThresholdTimelockNotExpired.selector,
                block.timestamp + hook.THRESHOLD_UPDATE_DELAY()
            )
        );
        hook.executeThresholdUpdate();
    }

    function test_UpdateThreshold_EmitsEvent() public {
        hook.proposeThreshold(80);
        vm.warp(block.timestamp + hook.THRESHOLD_UPDATE_DELAY() + 1);
        vm.expectEmit(false, false, false, true);
        emit ThresholdUpdated(DEFAULT_THRESHOLD, 80);
        hook.executeThresholdUpdate();
    }

    function test_ExecuteThreshold_NoPending_Reverts() public {
        vm.expectRevert(TrustGateHook.TrustGateHook__NoThresholdPending.selector);
        hook.executeThresholdUpdate();
    }

    function test_SetRouterAllowance_ZeroAddress_Reverts() public {
        vm.expectRevert(TrustGateHook.TrustGateHook__ZeroAddressRouter.selector);
        hook.setRouterAllowance(address(0), true);
    }

    function test_SetRouterAllowance_Success() public {
        assertFalse(hook.allowedRouters(swapper));
        hook.setRouterAllowance(swapper, true);
        assertTrue(hook.allowedRouters(swapper));
        hook.setRouterAllowance(swapper, false);
        assertFalse(hook.allowedRouters(swapper));
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
        _setScores(10, 90); // token0 score 10 < threshold 30
        vm.prank(mockPoolManager);
        vm.expectRevert(abi.encodeWithSelector(TrustGateHook.TrustScoreTooLow.selector, token0, 10, DEFAULT_THRESHOLD));
        hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");
    }

    function test_BeforeSwap_Token1LowScore_Reverts() public {
        _setScores(80, 10); // token1 score 10 < threshold 30
        vm.prank(mockPoolManager);
        vm.expectRevert(abi.encodeWithSelector(TrustGateHook.TrustScoreTooLow.selector, token1, 10, DEFAULT_THRESHOLD));
        hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");
    }

    function test_BeforeSwap_UnregisteredToken_Reverts() public {
        // Score 0 < threshold 30 → denied
        vm.prank(mockPoolManager);
        vm.expectRevert(abi.encodeWithSelector(TrustGateHook.TrustScoreTooLow.selector, token0, 0, DEFAULT_THRESHOLD));
        hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");
    }

    function test_BeforeSwap_LowerThreshold_AllowsPreviouslyBlocked() public {
        _setScores(10, 10); // blocked at threshold 30
        vm.prank(mockPoolManager);
        vm.expectRevert();
        hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");

        _changeThreshold(5); // now passes
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
        oracle.updateTokenScore(token1, 80, 10, 400, TrustScoreOracle.DataSource.VERIFIED);
        vm.warp(block.timestamp + oracle.SCORE_MIN_AGE() + 1);
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
        // High score but from seed data → should be rejected.
        // SEED scores are caught by getDataSource check BEFORE SCORE_MIN_AGE matters —
        // the hook calls getScore() first (which reverts ScoreTooFresh if not aged),
        // so we must age the score before the hook can reach the SEED check.
        oracle.updateTokenScore(token0, 90, 10, 400, TrustScoreOracle.DataSource.SEED);
        oracle.updateTokenScore(token1, 90, 10, 400, TrustScoreOracle.DataSource.VERIFIED);
        vm.warp(block.timestamp + oracle.SCORE_MIN_AGE() + 1);
        vm.prank(mockPoolManager);
        vm.expectRevert(abi.encodeWithSelector(TrustGateHook.TrustGateHook__SeedScoreRejected.selector, token0));
        hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");
    }

    function test_BeforeSwap_APIDataSource_Passes() public {
        oracle.updateTokenScore(token0, 80, 10, 400, TrustScoreOracle.DataSource.API);
        oracle.updateTokenScore(token1, 80, 10, 400, TrustScoreOracle.DataSource.COMMUNITY);
        vm.warp(block.timestamp + oracle.SCORE_MIN_AGE() + 1);
        vm.prank(mockPoolManager);
        (bytes4 sel,,) = hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");
        assertEq(sel, IHooks.beforeSwap.selector);
    }

    // ─── Fuzz ──────────────────────────────────────────────────

    // ─── beforeSwap: hookData per-user fee ─────────────────────

    function test_BeforeSwap_HookData_PerUserFee() public {
        _setScores(80, 80);

        // Give a high-rep user guardian-level fee
        address highRepUser = address(0xBEEF);
        oracle.updateUserReputation(highRepUser, 200, 50, 1000);

        // Register the swapper (sender in beforeSwap) as an allowed router so its hookData is trusted.
        // In V4, `sender` passed to beforeSwap is the swap initiator, not msg.sender (poolManager).
        hook.setRouterAllowance(swapper, true);

        // Encode highRepUser in hookData — now the router is trusted so feeTarget = highRepUser
        bytes memory hookData = abi.encode(highRepUser);

        vm.prank(mockPoolManager);
        (,, uint24 fee) = hook.beforeSwap(swapper, _makeKey(), _makeParams(), hookData);

        // Fee should reflect highRepUser's tier (GUARDIAN = 0%), not swapper's (BASE = 0.5%)
        uint256 expectedFee = oracle.GUARDIAN_FEE(); // 0
        assertEq(fee, uint24(expectedFee * 100) | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    function test_BeforeSwap_EmptyHookData_FallsBackToSender() public {
        _setScores(80, 80);

        // Set router (swapper) to verified tier
        oracle.updateUserReputation(swapper, 50, 10, 0);

        vm.prank(mockPoolManager);
        (,, uint24 fee) = hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");

        uint256 expectedFee = oracle.getUserFee(swapper); // VERIFIED = 10 bps
        assertEq(fee, uint24(expectedFee * 100) | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    // ─── beforeSwap: stale oracle score ────────────────────────

    function test_BeforeSwap_StaleScore_AllowsSwap_OracleFallback() public {
        _setScores(80, 80);

        // Warp past SCORE_MAX_AGE
        vm.warp(block.timestamp + 7 days + 1);

        // Should pass due to oracle fallback
        vm.prank(mockPoolManager);
        (bytes4 sel,,) = hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");
        assertEq(sel, IHooks.beforeSwap.selector);
    }

    function test_BeforeSwap_StaleScoreRefreshed_AllowsSwap() public {
        _setScores(80, 80);
        vm.warp(block.timestamp + 7 days + 1);

        // Refresh scores
        _setScores(80, 80);

        vm.prank(mockPoolManager);
        (bytes4 sel,,) = hook.beforeSwap(swapper, _makeKey(), _makeParams(), "");
        assertEq(sel, IHooks.beforeSwap.selector);
    }

    function testFuzz_ScoreThreshold(uint256 score, uint256 threshold) public {
        score = bound(score, 0, 100);
        threshold = bound(threshold, hook.MIN_THRESHOLD(), 100); // 0 is now rejected

        oracle.updateTokenScore(token0, score, 10, 400, TrustScoreOracle.DataSource.VERIFIED);
        oracle.updateTokenScore(token1, score, 10, 400, TrustScoreOracle.DataSource.VERIFIED);
        vm.warp(block.timestamp + oracle.SCORE_MIN_AGE() + 1);
        _changeThreshold(threshold);

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
            // Score must age past SCORE_MIN_AGE before getScore() returns it.
            vm.warp(block.timestamp + oracle.SCORE_MIN_AGE() + 1);
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

    // ─── EIP-712 Signed Scores (MODE 1) ────────────────────────

    function _setTrustedSigner(address newSigner) internal {
        hook.proposeTrustedSigner(newSigner);
        vm.warp(block.timestamp + hook.THRESHOLD_UPDATE_DELAY() + 1);
        hook.executeTrustedSignerUpdate();
    }

    function _signScore(address user, address token, uint256 score, uint256 ts, uint256 nonce)
        internal
        view
        returns (bytes memory)
    {
        bytes32 structHash = keccak256(
            abi.encode(hook.SCORE_TYPEHASH(), user, token, score, ts, nonce)
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", hook.DOMAIN_SEPARATOR(), structHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _makeSignedHookData(
        address feeTarget,
        address userForSig,
        uint256 score0, uint256 ts0, uint256 nonce0,
        uint256 score1, uint256 ts1, uint256 nonce1
    ) internal view returns (bytes memory) {
        bytes memory sig0 = _signScore(userForSig, token0, score0, ts0, nonce0);
        bytes memory sig1 = _signScore(userForSig, token1, score1, ts1, nonce1);
        return abi.encode(feeTarget, score0, ts0, nonce0, sig0, score1, ts1, nonce1, sig1);
    }

    function test_SignedScore_HighScore_Passes() public {
        uint256 ts = block.timestamp;
        bytes memory hookData = _makeSignedHookData(address(0), swapper, 80, ts, 1, 90, ts, 2);

        vm.prank(mockPoolManager);
        (bytes4 sel,,) = hook.beforeSwap(swapper, _makeKey(), _makeParams(), hookData);
        assertEq(sel, IHooks.beforeSwap.selector);
    }

    function test_SignedScore_LowScore_Reverts() public {
        uint256 ts = block.timestamp;
        bytes memory hookData = _makeSignedHookData(address(0), swapper, 10, ts, 1, 90, ts, 2);

        vm.prank(mockPoolManager);
        vm.expectRevert(abi.encodeWithSelector(TrustGateHook.TrustScoreTooLow.selector, token0, 10, DEFAULT_THRESHOLD));
        hook.beforeSwap(swapper, _makeKey(), _makeParams(), hookData);
    }

    function test_SignedScore_ExpiredTimestamp_Reverts() public {
        vm.warp(10000); // ensure block.timestamp is large enough
        uint256 ts = block.timestamp - 6 minutes; // > SIGNED_SCORE_MAX_AGE (5 min)
        bytes memory hookData = _makeSignedHookData(address(0), swapper, 80, ts, 1, 80, ts, 2);

        vm.expectRevert(
            abi.encodeWithSelector(
                TrustGateHook.TrustGateHook__SignatureExpired.selector,
                token0, ts, hook.SIGNED_SCORE_MAX_AGE()
            )
        );
        vm.prank(mockPoolManager);
        hook.beforeSwap(swapper, _makeKey(), _makeParams(), hookData);
    }

    function test_SignedScore_ReplayNonce_Reverts() public {
        uint256 ts = block.timestamp;
        bytes memory hookData = _makeSignedHookData(address(0), swapper, 80, ts, 1, 80, ts, 2);

        // First swap passes
        vm.prank(mockPoolManager);
        hook.beforeSwap(swapper, _makeKey(), _makeParams(), hookData);

        // Same hookData (same nonces) → replay → revert
        vm.prank(mockPoolManager);
        vm.expectRevert(abi.encodeWithSelector(TrustGateHook.TrustGateHook__NonceAlreadyUsed.selector, token0, 1));
        hook.beforeSwap(swapper, _makeKey(), _makeParams(), hookData);
    }

    function test_SignedScore_WrongSigner_Reverts() public {
        // Sign with a different key
        uint256 fakePk = 0xDEAD;
        uint256 ts = block.timestamp;

        bytes32 structHash = keccak256(
            abi.encode(hook.SCORE_TYPEHASH(), swapper, token0, uint256(80), ts, uint256(1))
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", hook.DOMAIN_SEPARATOR(), structHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(fakePk, digest);
        bytes memory fakeSig0 = abi.encodePacked(r, s, v);

        bytes memory goodSig1 = _signScore(swapper, token1, 80, ts, 2);
        bytes memory hookData = abi.encode(address(0), uint256(80), ts, uint256(1), fakeSig0, uint256(80), ts, uint256(2), goodSig1);

        vm.prank(mockPoolManager);
        vm.expectRevert(abi.encodeWithSelector(TrustGateHook.TrustGateHook__InvalidSignature.selector, token0));
        hook.beforeSwap(swapper, _makeKey(), _makeParams(), hookData);
    }

    function test_SignedScore_WithFeeTarget_AllowedRouter() public {
        uint256 ts = block.timestamp;
        address highRepUser = address(0xBEEF);
        oracle.updateUserReputation(highRepUser, 200, 50, 1000);

        // Register the swapper (router) as allowed
        hook.setRouterAllowance(swapper, true);

        bytes memory hookData = _makeSignedHookData(highRepUser, highRepUser, 80, ts, 1, 80, ts, 2);

        vm.prank(mockPoolManager);
        (,, uint24 fee) = hook.beforeSwap(swapper, _makeKey(), _swapParams(), hookData);

        // Fee should use highRepUser's guardian tier (0%)
        assertEq(fee, uint24(0) | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    function test_SignedScore_WithFeeTarget_UntrustedRouter_Ignored() public {
        uint256 ts = block.timestamp;
        address highRepUser = address(0xBEEF);
        oracle.updateUserReputation(highRepUser, 200, 50, 1000);

        // swapper is NOT an allowed router
        assertFalse(hook.allowedRouters(swapper));

        bytes memory hookData = _makeSignedHookData(highRepUser, swapper, 80, ts, 1, 80, ts, 2);

        vm.prank(mockPoolManager);
        (,, uint24 fee) = hook.beforeSwap(swapper, _makeKey(), _swapParams(), hookData);

        // Fee should use swapper's own tier (BASE = 50 bps), NOT highRepUser's
        assertEq(fee, uint24(50 * 100) | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    function test_SignedScore_DisabledSigner_FallsBackToOracle() public {
        // Disable signed scores
        _setTrustedSigner(address(0));

        _setScores(80, 80);

        // Even with long hookData, should fall back to oracle mode
        uint256 ts = block.timestamp;
        bytes memory hookData = _makeSignedHookData(address(0), swapper, 80, ts, 1, 80, ts, 2);

        // hookData > 32 bytes but trustedSigner is 0 → falls to oracle mode
        // However, the hookData won't decode as a legacy address either (too long)
        // Oracle mode will work since scores are set
        vm.prank(mockPoolManager);
        (bytes4 sel,,) = hook.beforeSwap(swapper, _makeKey(), _makeParams(), hookData);
        assertEq(sel, IHooks.beforeSwap.selector);
    }

    function test_SetTrustedSigner() public {
        address newSigner = address(0xCAFE);
        _setTrustedSigner(newSigner);
        assertEq(hook.trustedSigner(), newSigner);
    }

    function test_SetTrustedSigner_NotOwner_Reverts() public {
        vm.prank(attacker);
        vm.expectRevert();
        hook.proposeTrustedSigner(address(0xCAFE));
    }
}
