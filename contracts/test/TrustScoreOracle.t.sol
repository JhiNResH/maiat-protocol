// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {TrustScoreOracle} from "../src/TrustScoreOracle.sol";

contract TrustScoreOracleTest is Test {
    TrustScoreOracle public oracle;

    address public owner = address(this);
    address public attacker = address(0xBAD);
    address public token  = address(0x100);
    address public token2 = address(0x200);
    address public user   = address(0x300);

    event TokenScoreUpdated(address indexed token, uint256 score, uint256 reviewCount);
    event UserReputationUpdated(address indexed user, uint256 score, uint256 feeBps);

    function setUp() public {
        oracle = new TrustScoreOracle(owner);
    }

    // ─── Constructor ───────────────────────────────────────────

    function test_Constructor_SetsOwner() public view {
        assertEq(oracle.owner(), owner);
    }

    function test_Constructor_FeeTiersCorrect() public view {
        assertEq(oracle.BASE_FEE(),     50);
        assertEq(oracle.TRUSTED_FEE(),  30);
        assertEq(oracle.VERIFIED_FEE(), 10);
        assertEq(oracle.GUARDIAN_FEE(), 0);
    }

    // ─── getScore ──────────────────────────────────────────────

    function test_GetScore_UnregisteredReturnsZero() public view {
        assertEq(oracle.getScore(address(0xDEAD)), 0);
    }

    // ─── updateTokenScore ──────────────────────────────────────

    function test_UpdateTokenScore_Success() public {
        vm.expectEmit(true, false, false, true);
        emit TokenScoreUpdated(token, 85, 42);

        oracle.updateTokenScore(token, 85, 42, 450);

        assertEq(oracle.getScore(token), 85);

        TrustScoreOracle.TokenScore memory data = oracle.getTokenData(token);
        assertEq(data.trustScore,   85);
        assertEq(data.reviewCount,  42);
        assertEq(data.avgRating,    450);
        assertGt(data.lastUpdated,  0);
    }

    function test_UpdateTokenScore_Zero() public {
        oracle.updateTokenScore(token, 0, 0, 0);
        assertEq(oracle.getScore(token), 0);
    }

    function test_UpdateTokenScore_MaxScore() public {
        oracle.updateTokenScore(token, 100, 1000, 500);
        assertEq(oracle.getScore(token), 100);
    }

    function test_UpdateTokenScore_OverMaxReverts() public {
        vm.expectRevert(abi.encodeWithSelector(TrustScoreOracle.TrustScoreOracle__ScoreOutOfRange.selector, 101));
        oracle.updateTokenScore(token, 101, 10, 400);
    }

    function test_UpdateTokenScore_NotOwnerReverts() public {
        vm.prank(attacker);
        vm.expectRevert();
        oracle.updateTokenScore(token, 80, 10, 400);
    }

    function test_UpdateTokenScore_Overwrite() public {
        oracle.updateTokenScore(token, 50, 5, 300);
        oracle.updateTokenScore(token, 90, 20, 480);
        assertEq(oracle.getScore(token), 90);

        TrustScoreOracle.TokenScore memory data = oracle.getTokenData(token);
        assertEq(data.reviewCount, 20);
    }

    // ─── batchUpdateTokenScores ────────────────────────────────

    function test_BatchUpdate_Success() public {
        address[] memory tokens       = new address[](3);
        uint256[] memory scores       = new uint256[](3);
        uint256[] memory reviewCounts = new uint256[](3);
        uint256[] memory avgRatings   = new uint256[](3);

        tokens[0] = address(0x100); scores[0] = 70; reviewCounts[0] = 10; avgRatings[0] = 350;
        tokens[1] = address(0x200); scores[1] = 85; reviewCounts[1] = 25; avgRatings[1] = 430;
        tokens[2] = address(0x300); scores[2] = 95; reviewCounts[2] = 80; avgRatings[2] = 490;

        oracle.batchUpdateTokenScores(tokens, scores, reviewCounts, avgRatings);

        assertEq(oracle.getScore(tokens[0]), 70);
        assertEq(oracle.getScore(tokens[1]), 85);
        assertEq(oracle.getScore(tokens[2]), 95);
    }

    function test_BatchUpdate_LengthMismatchReverts() public {
        address[] memory tokens       = new address[](2);
        uint256[] memory scores       = new uint256[](3);
        uint256[] memory reviewCounts = new uint256[](2);
        uint256[] memory avgRatings   = new uint256[](2);
        tokens[0] = token; tokens[1] = token2;

        vm.expectRevert(TrustScoreOracle.TrustScoreOracle__LengthMismatch.selector);
        oracle.batchUpdateTokenScores(tokens, scores, reviewCounts, avgRatings);
    }

    function test_BatchUpdate_NotOwnerReverts() public {
        address[] memory tokens       = new address[](1);
        uint256[] memory scores       = new uint256[](1);
        uint256[] memory reviewCounts = new uint256[](1);
        uint256[] memory avgRatings   = new uint256[](1);
        tokens[0] = token; scores[0] = 80;

        vm.prank(attacker);
        vm.expectRevert();
        oracle.batchUpdateTokenScores(tokens, scores, reviewCounts, avgRatings);
    }

    // ─── updateUserReputation + fee tiers ─────────────────────

    function test_UserRep_NewUserGetsBaseFee() public view {
        assertEq(oracle.getUserFee(user), oracle.BASE_FEE()); // 50 bps
    }

    function test_UserRep_TrustedTier() public {
        // 10 <= score < 50 → TRUSTED_FEE (30 bps)
        oracle.updateUserReputation(user, 25, 5, 100);

        TrustScoreOracle.UserReputation memory rep = oracle.getUserData(user);
        assertEq(rep.feeBps, oracle.TRUSTED_FEE()); // 30
        assertEq(oracle.getUserFee(user), 30);
    }

    function test_UserRep_VerifiedTier() public {
        // 50 <= score < 200 → VERIFIED_FEE (10 bps)
        oracle.updateUserReputation(user, 100, 20, 500);

        assertEq(oracle.getUserFee(user), oracle.VERIFIED_FEE()); // 10
    }

    function test_UserRep_GuardianTier() public {
        // score >= 200 → GUARDIAN_FEE (0 bps)
        oracle.updateUserReputation(user, 250, 50, 10000);

        assertEq(oracle.getUserFee(user), oracle.GUARDIAN_FEE()); // 0
    }

    function test_UserRep_BelowTrustedThreshold() public {
        // score < 10 → BASE_FEE (50 bps)
        oracle.updateUserReputation(user, 5, 1, 50);

        assertEq(oracle.getUserFee(user), oracle.BASE_FEE()); // 50
    }

    function test_UserRep_EventEmitted() public {
        vm.expectEmit(true, false, false, true);
        emit UserReputationUpdated(user, 100, 10); // 10 bps for score=100

        oracle.updateUserReputation(user, 100, 20, 500);
    }

    function test_UserRep_NotOwnerReverts() public {
        vm.prank(attacker);
        vm.expectRevert();
        oracle.updateUserReputation(user, 100, 20, 500);
    }

    function test_UserRep_StoresAllFields() public {
        oracle.updateUserReputation(user, 75, 15, 2000);

        TrustScoreOracle.UserReputation memory rep = oracle.getUserData(user);
        assertEq(rep.reputationScore, 75);
        assertEq(rep.totalReviews,    15);
        assertEq(rep.scarabPoints,    2000);
        assertGt(rep.lastUpdated,     0);
    }

    // ─── Fuzz ──────────────────────────────────────────────────

    function testFuzz_TokenScore_ValidRange(uint256 score, uint256 reviews, uint256 avgRating) public {
        score = bound(score, 0, 100);
        oracle.updateTokenScore(token, score, reviews, avgRating);
        assertEq(oracle.getScore(token), score);
    }

    function testFuzz_TokenScore_InvalidRange(uint256 score) public {
        score = bound(score, 101, type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(TrustScoreOracle.TrustScoreOracle__ScoreOutOfRange.selector, score));
        oracle.updateTokenScore(token, score, 0, 0);
    }

    function testFuzz_FeeTier_Boundaries(uint256 repScore) public {
        repScore = bound(repScore, 0, 1000);
        oracle.updateUserReputation(user, repScore, 1, 0);

        uint256 fee = oracle.getUserFee(user);
        if (repScore >= 200) {
            assertEq(fee, oracle.GUARDIAN_FEE());
        } else if (repScore >= 50) {
            assertEq(fee, oracle.VERIFIED_FEE());
        } else if (repScore >= 10) {
            assertEq(fee, oracle.TRUSTED_FEE());
        } else {
            assertEq(fee, oracle.BASE_FEE());
        }
    }
}
