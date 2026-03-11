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
import {ECDSA} from "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "openzeppelin-contracts/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title TrustGateHookFuzzTest
/// @notice Comprehensive fuzz tests for EIP-712 signed scores, oracle fallback,
///         access control, nonce replay, timestamp bounds, and fee calculations.
contract TrustGateHookFuzzTest is Test {
    TrustGateHook public hook;
    TrustScoreOracle public oracle;

    address public owner = address(this);
    address public mockPoolManager = address(0xBEEF);

    uint256 internal signerPk = 0xA11CE;
    address internal signerAddr;

    // Track nonces we've used in this test contract
    uint256 internal nextNonce = 1;

    function setUp() public {
        // Start at a sane timestamp to avoid underflow
        vm.warp(100_000);
        signerAddr = vm.addr(signerPk);
        oracle = new TrustScoreOracle(owner);
        hook = new TrustGateHook(oracle, IPoolManager(mockPoolManager), owner, signerAddr);
    }

    /*//////////////////////////////////////////////////////////////
                          HELPER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function _sign(uint256 pk, address token, uint256 score, uint256 ts, uint256 nonce)
        internal
        view
        returns (bytes memory)
    {
        bytes32 structHash = keccak256(
            abi.encode(hook.SCORE_TYPEHASH(), token, score, ts, nonce)
        );
        bytes32 digest = MessageHashUtils.toTypedDataHash(hook.DOMAIN_SEPARATOR(), structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _makeSignedHookData(
        address feeTarget,
        address token0, uint256 score0, uint256 ts0, uint256 nonce0,
        address token1, uint256 score1, uint256 ts1, uint256 nonce1
    ) internal view returns (bytes memory) {
        bytes memory sig0 = _sign(signerPk, token0, score0, ts0, nonce0);
        bytes memory sig1 = _sign(signerPk, token1, score1, ts1, nonce1);
        return abi.encode(feeTarget, score0, ts0, nonce0, sig0, score1, ts1, nonce1, sig1);
    }

    function _setOracleScores(address t0, uint256 s0, address t1, uint256 s1) internal {
        oracle.updateTokenScore(t0, s0, 10, 400, TrustScoreOracle.DataSource.VERIFIED);
        oracle.updateTokenScore(t1, s1, 10, 400, TrustScoreOracle.DataSource.VERIFIED);
        vm.warp(block.timestamp + oracle.SCORE_MIN_AGE() + 1);
    }

    function _makeKey(address t0, address t1) internal view returns (PoolKey memory) {
        // Ensure t0 < t1 for valid Uniswap key ordering
        if (uint160(t0) > uint160(t1)) (t0, t1) = (t1, t0);
        return PoolKey({
            currency0: Currency.wrap(t0),
            currency1: Currency.wrap(t1),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
    }

    function _swapParams() internal pure returns (SwapParams memory) {
        return SwapParams({zeroForOne: true, amountSpecified: -100, sqrtPriceLimitX96: 0});
    }

    function _freshNonce() internal returns (uint256) {
        return nextNonce++;
    }

    /*//////////////////////////////////////////////////////////////
              FUZZ: EIP-712 Score + Threshold Interaction
    //////////////////////////////////////////////////////////////*/

    /// @notice Fuzz both scores and threshold — verify gating is correct
    function testFuzz_SignedScore_GatingLogic(
        uint256 score0,
        uint256 score1,
        uint256 threshold
    ) public {
        score0 = bound(score0, 0, 100);
        score1 = bound(score1, 0, 100);
        threshold = bound(threshold, 1, 100);

        // Set threshold via timelock
        hook.proposeThreshold(threshold);
        vm.warp(block.timestamp + hook.THRESHOLD_UPDATE_DELAY() + 1);
        hook.executeThresholdUpdate();

        address t0 = address(uint160(0x1000));
        address t1 = address(uint160(0x2000));
        uint256 ts = block.timestamp;
        uint256 n0 = _freshNonce();
        uint256 n1 = _freshNonce();

        bytes memory hookData = _makeSignedHookData(
            address(0), t0, score0, ts, n0, t1, score1, ts, n1
        );

        vm.prank(mockPoolManager);
        if (score0 >= threshold && score1 >= threshold) {
            (bytes4 sel,,) = hook.beforeSwap(address(0xABC), _makeKey(t0, t1), _swapParams(), hookData);
            assertEq(sel, IHooks.beforeSwap.selector);
        } else {
            vm.expectRevert();
            hook.beforeSwap(address(0xABC), _makeKey(t0, t1), _swapParams(), hookData);
        }
    }

    /// @notice Fuzz the timestamp — verify freshness window
    function testFuzz_SignedScore_TimestampFreshness(uint256 age) public {
        age = bound(age, 0, 1 hours);

        address t0 = address(uint160(0x1000));
        address t1 = address(uint160(0x2000));

        uint256 ts = block.timestamp - age;
        uint256 n0 = _freshNonce();
        uint256 n1 = _freshNonce();

        bytes memory hookData = _makeSignedHookData(
            address(0), t0, 80, ts, n0, t1, 80, ts, n1
        );

        if (age <= hook.SIGNED_SCORE_MAX_AGE()) {
            vm.prank(mockPoolManager);
            (bytes4 sel,,) = hook.beforeSwap(address(0xABC), _makeKey(t0, t1), _swapParams(), hookData);
            assertEq(sel, IHooks.beforeSwap.selector);
        } else {
            vm.expectRevert();
            vm.prank(mockPoolManager);
            hook.beforeSwap(address(0xABC), _makeKey(t0, t1), _swapParams(), hookData);
        }
    }

    /// @notice Fuzz signer private key — only trustedSigner should pass
    function testFuzz_SignedScore_OnlyTrustedSigner(uint256 pk) public {
        // Avoid invalid keys
        pk = bound(pk, 1, type(uint128).max);
        // Skip if this happens to be the trusted signer
        vm.assume(vm.addr(pk) != signerAddr);

        address t0 = address(uint160(0x1000));
        address t1 = address(uint160(0x2000));
        uint256 ts = block.timestamp;
        uint256 n0 = _freshNonce();
        uint256 n1 = _freshNonce();

        // Sign with the wrong key
        bytes memory sig0 = _sign(pk, t0, 80, ts, n0);
        bytes memory sig1 = _sign(pk, t1, 80, ts, n1);
        bytes memory hookData = abi.encode(address(0), uint256(80), ts, n0, sig0, uint256(80), ts, n1, sig1);

        vm.prank(mockPoolManager);
        vm.expectRevert(abi.encodeWithSelector(TrustGateHook.TrustGateHook__InvalidSignature.selector, t0));
        hook.beforeSwap(address(0xABC), _makeKey(t0, t1), _swapParams(), hookData);
    }

    /// @notice Nonce must not be reusable — every (token, nonce) pair is one-shot
    function testFuzz_SignedScore_NonceReplay(uint256 nonce) public {
        nonce = bound(nonce, 0, type(uint64).max);

        address t0 = address(uint160(0x1000));
        address t1 = address(uint160(0x2000));
        uint256 ts = block.timestamp;

        bytes memory hookData = _makeSignedHookData(address(0), t0, 80, ts, nonce, t1, 80, ts, nonce + 1);

        // First call succeeds
        vm.prank(mockPoolManager);
        hook.beforeSwap(address(0xABC), _makeKey(t0, t1), _swapParams(), hookData);

        // Same nonces → replay → revert
        vm.prank(mockPoolManager);
        vm.expectRevert();
        hook.beforeSwap(address(0xABC), _makeKey(t0, t1), _swapParams(), hookData);
    }

    /*//////////////////////////////////////////////////////////////
              FUZZ: Oracle Fallback Mode
    //////////////////////////////////////////////////////////////*/

    /// @notice Fuzz oracle scores + threshold — verify MODE 2 gating
    function testFuzz_OracleFallback_GatingLogic(
        uint256 score0,
        uint256 score1,
        uint256 threshold
    ) public {
        score0 = bound(score0, 1, 100); // avoid 0 (unregistered = always blocked)
        score1 = bound(score1, 1, 100);
        threshold = bound(threshold, 1, 100);

        address t0 = address(uint160(0x3000));
        address t1 = address(uint160(0x4000));

        _setOracleScores(t0, score0, t1, score1);

        hook.proposeThreshold(threshold);
        vm.warp(block.timestamp + hook.THRESHOLD_UPDATE_DELAY() + 1);
        hook.executeThresholdUpdate();

        // Re-set scores after threshold warp (to avoid staleness)
        _setOracleScores(t0, score0, t1, score1);

        vm.prank(mockPoolManager);
        if (score0 >= threshold && score1 >= threshold) {
            (bytes4 sel,,) = hook.beforeSwap(address(0xABC), _makeKey(t0, t1), _swapParams(), "");
            assertEq(sel, IHooks.beforeSwap.selector);
        } else {
            vm.expectRevert();
            hook.beforeSwap(address(0xABC), _makeKey(t0, t1), _swapParams(), "");
        }
    }

    /*//////////////////////////////////////////////////////////////
              FUZZ: Dynamic Fee Calculation
    //////////////////////////////////////////////////////////////*/

    /// @notice Verify fee tier boundaries are correct for all reputation scores
    function testFuzz_DynamicFee_Tiers(uint256 repScore) public {
        repScore = bound(repScore, 0, 500);

        address t0 = address(uint160(0x5000));
        address t1 = address(uint160(0x6000));
        address user = address(uint160(0x7000));

        _setOracleScores(t0, 80, t1, 80);
        oracle.updateUserReputation(user, repScore, 1, 0);

        // Use signed scores with user as feeTarget
        uint256 ts = block.timestamp;
        uint256 n0 = _freshNonce();
        uint256 n1 = _freshNonce();
        bytes memory hookData = _makeSignedHookData(user, t0, 80, ts, n0, t1, 80, ts, n1);

        vm.prank(mockPoolManager);
        (,, uint24 fee) = hook.beforeSwap(address(0xABC), _makeKey(t0, t1), _swapParams(), hookData);

        uint256 expectedBps;
        if (repScore >= 200) expectedBps = oracle.GUARDIAN_FEE();
        else if (repScore >= 50) expectedBps = oracle.VERIFIED_FEE();
        else if (repScore >= 10) expectedBps = oracle.TRUSTED_FEE();
        else expectedBps = oracle.BASE_FEE();

        assertEq(fee, uint24(expectedBps * 100) | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    /*//////////////////////////////////////////////////////////////
              FUZZ: Access Control
    //////////////////////////////////////////////////////////////*/

    /// @notice Only PoolManager can call beforeSwap
    function testFuzz_AccessControl_OnlyPoolManager(address caller) public {
        vm.assume(caller != mockPoolManager);

        address t0 = address(uint160(0x1000));
        address t1 = address(uint160(0x2000));

        vm.prank(caller);
        vm.expectRevert(abi.encodeWithSelector(BaseHook.BaseHook__NotPoolManager.selector, caller));
        hook.beforeSwap(address(0xABC), _makeKey(t0, t1), _swapParams(), "");
    }

    /// @notice Only owner can set trusted signer
    function testFuzz_AccessControl_SetSigner(address caller) public {
        vm.assume(caller != owner);

        vm.prank(caller);
        vm.expectRevert();
        hook.setTrustedSigner(address(0xCAFE));
    }

    /// @notice Only owner can propose threshold
    function testFuzz_AccessControl_ProposeThreshold(address caller, uint256 threshold) public {
        vm.assume(caller != owner);
        threshold = bound(threshold, 1, 100);

        vm.prank(caller);
        vm.expectRevert();
        hook.proposeThreshold(threshold);
    }

    /// @notice Only owner can set router allowance
    function testFuzz_AccessControl_SetRouter(address caller, address router) public {
        vm.assume(caller != owner);
        vm.assume(router != address(0));

        vm.prank(caller);
        vm.expectRevert();
        hook.setRouterAllowance(router, true);
    }

    /*//////////////////////////////////////////////////////////////
              FUZZ: Score Out of Range in Signed Mode
    //////////////////////////////////////////////////////////////*/

    /// @notice Signed scores > 100 should revert with ScoreOutOfRange
    function testFuzz_SignedScore_OutOfRange(uint256 score) public {
        score = bound(score, 101, type(uint128).max);

        address t0 = address(uint160(0x1000));
        address t1 = address(uint160(0x2000));
        uint256 ts = block.timestamp;
        uint256 n0 = _freshNonce();
        uint256 n1 = _freshNonce();

        // Sign an out-of-range score (the signature will be valid, but the score check should revert)
        bytes memory hookData = _makeSignedHookData(address(0), t0, score, ts, n0, t1, 80, ts, n1);

        vm.prank(mockPoolManager);
        vm.expectRevert(abi.encodeWithSelector(TrustGateHook.TrustGateHook__ScoreOutOfRange.selector, score));
        hook.beforeSwap(address(0xABC), _makeKey(t0, t1), _swapParams(), hookData);
    }

    /*//////////////////////////////////////////////////////////////
              FUZZ: ETH (address(0)) is always skipped
    //////////////////////////////////////////////////////////////*/

    /// @notice Native ETH currency should bypass trust checks
    function testFuzz_NativeETH_AlwaysSkipped(uint256 score) public {
        score = bound(score, 30, 100); // valid score for the non-ETH token

        address nonEthToken = address(uint160(0x8000));
        _setOracleScores(nonEthToken, score, nonEthToken, score);

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)), // native ETH
            currency1: Currency.wrap(nonEthToken),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });

        vm.prank(mockPoolManager);
        (bytes4 sel,,) = hook.beforeSwap(address(0xABC), key, _swapParams(), "");
        assertEq(sel, IHooks.beforeSwap.selector);
    }

    /*//////////////////////////////////////////////////////////////
              FUZZ: Threshold Timelock Invariant
    //////////////////////////////////////////////////////////////*/

    /// @notice Threshold update must wait THRESHOLD_UPDATE_DELAY
    function testFuzz_ThresholdTimelock_Enforced(uint256 threshold, uint256 waitTime) public {
        threshold = bound(threshold, 1, 100);
        waitTime = bound(waitTime, 0, 2 days);

        hook.proposeThreshold(threshold);
        vm.warp(block.timestamp + waitTime);

        if (waitTime > hook.THRESHOLD_UPDATE_DELAY()) {
            hook.executeThresholdUpdate();
            assertEq(hook.trustThreshold(), threshold);
        } else {
            vm.expectRevert();
            hook.executeThresholdUpdate();
        }
    }

    /*//////////////////////////////////////////////////////////////
              FUZZ: Legacy hookData (32 bytes) fee override
    //////////////////////////////////////////////////////////////*/

    /// @notice 32-byte hookData with allowed router should set feeTarget
    function testFuzz_LegacyHookData_FeeTarget(address feeTarget) public {
        vm.assume(feeTarget != address(0));

        address t0 = address(uint160(0x9000));
        address t1 = address(uint160(0xA000));
        address router = address(uint160(0xB000));

        _setOracleScores(t0, 80, t1, 80);
        hook.setRouterAllowance(router, true);
        oracle.updateUserReputation(feeTarget, 200, 50, 1000); // guardian

        bytes memory hookData = abi.encode(feeTarget);

        vm.prank(mockPoolManager);
        (,, uint24 fee) = hook.beforeSwap(router, _makeKey(t0, t1), _swapParams(), hookData);

        // Should use feeTarget's guardian fee (0)
        assertEq(fee, uint24(0) | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    /// @notice 32-byte hookData from non-allowed router should use sender as feeTarget
    function testFuzz_LegacyHookData_NonAllowedRouter(address router) public {
        vm.assume(router != address(0));
        vm.assume(!hook.allowedRouters(router));

        address t0 = address(uint160(0x9000));
        address t1 = address(uint160(0xA000));
        address feeTarget = address(uint160(0xC000));

        _setOracleScores(t0, 80, t1, 80);
        oracle.updateUserReputation(feeTarget, 200, 50, 1000); // guardian fee

        bytes memory hookData = abi.encode(feeTarget);

        vm.prank(mockPoolManager);
        (,, uint24 fee) = hook.beforeSwap(router, _makeKey(t0, t1), _swapParams(), hookData);

        // Should use router's fee (new user = 50 bps), NOT feeTarget's
        assertEq(fee, uint24(50 * 100) | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }
}
