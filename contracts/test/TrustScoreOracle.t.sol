// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {TrustScoreOracle} from "../src/TrustScoreOracle.sol";

contract TrustScoreOracleTest is Test {
    TrustScoreOracle public oracle;

    address public admin = address(this);
    address public updater = address(0x999);
    address public attacker = address(0xBAD);
    address public token = address(0x100);
    address public token2 = address(0x200);
    address public user = address(0x300);

    event TokenScoreUpdated(address indexed token, uint256 score, uint256 reviewCount);
    event UserReputationUpdated(address indexed user, uint256 score, uint256 feeBps);
    event UserReputationReset(address indexed user);

    function setUp() public {
        oracle = new TrustScoreOracle(admin);
        // Grant updater role to a separate address
        oracle.grantRole(oracle.UPDATER_ROLE(), updater);
    }

    /// @dev Update a token score and immediately age it past SCORE_MIN_AGE so getScore() works.
    function _updateAndAge(address t, uint256 score, uint256 reviews, uint256 avg, TrustScoreOracle.DataSource ds) internal {
        oracle.updateTokenScore(t, score, reviews, avg, ds);
        vm.warp(block.timestamp + oracle.SCORE_MIN_AGE() + 1);
    }

    // ─── Constructor & Roles ───────────────────────────────────

    function test_Constructor_SetsAdmin() public view {
        assertTrue(oracle.hasRole(oracle.DEFAULT_ADMIN_ROLE(), admin));
    }

    function test_Constructor_AdminHasUpdaterRole() public view {
        assertTrue(oracle.hasRole(oracle.UPDATER_ROLE(), admin));
    }

    function test_SeparateUpdaterCanUpdate() public {
        vm.prank(updater);
        oracle.updateTokenScore(token, 80, 10, 400, TrustScoreOracle.DataSource.API);
        vm.warp(block.timestamp + oracle.SCORE_MIN_AGE() + 1);
        assertEq(oracle.getScore(token), 80);
    }

    function test_Constructor_FeeTiersCorrect() public view {
        assertEq(oracle.BASE_FEE(), 50);
        assertEq(oracle.TRUSTED_FEE(), 30);
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

        oracle.updateTokenScore(token, 85, 42, 450, TrustScoreOracle.DataSource.COMMUNITY);
        vm.warp(block.timestamp + oracle.SCORE_MIN_AGE() + 1);

        assertEq(oracle.getScore(token), 85);

        TrustScoreOracle.TokenScore memory data = oracle.getTokenData(token);
        assertEq(data.trustScore, 85);
        assertEq(data.reviewCount, 42);
        assertEq(data.avgRating, 450);
        assertGt(data.lastUpdated, 0);
        assertEq(uint8(data.dataSource), uint8(TrustScoreOracle.DataSource.COMMUNITY));
    }

    function test_UpdateTokenScore_Zero() public {
        oracle.updateTokenScore(token, 0, 0, 0, TrustScoreOracle.DataSource.NONE);
        vm.warp(block.timestamp + oracle.SCORE_MIN_AGE() + 1);
        assertEq(oracle.getScore(token), 0);
    }

    function test_UpdateTokenScore_MaxScore() public {
        oracle.updateTokenScore(token, 100, 1000, 500, TrustScoreOracle.DataSource.VERIFIED);
        vm.warp(block.timestamp + oracle.SCORE_MIN_AGE() + 1);
        assertEq(oracle.getScore(token), 100);
    }

    function test_UpdateTokenScore_OverMaxReverts() public {
        vm.expectRevert(abi.encodeWithSelector(TrustScoreOracle.TrustScoreOracle__ScoreOutOfRange.selector, 101));
        oracle.updateTokenScore(token, 101, 10, 400, TrustScoreOracle.DataSource.API);
    }

    function test_UpdateTokenScore_NotUpdaterReverts() public {
        vm.prank(attacker);
        vm.expectRevert();
        oracle.updateTokenScore(token, 80, 10, 400, TrustScoreOracle.DataSource.API);
    }

    function test_UpdateTokenScore_Overwrite() public {
        oracle.updateTokenScore(token, 50, 5, 300, TrustScoreOracle.DataSource.SEED);
        oracle.updateTokenScore(token, 90, 20, 480, TrustScoreOracle.DataSource.VERIFIED);
        vm.warp(block.timestamp + oracle.SCORE_MIN_AGE() + 1);
        assertEq(oracle.getScore(token), 90);
        assertEq(uint8(oracle.getDataSource(token)), uint8(TrustScoreOracle.DataSource.VERIFIED));
    }

    // ─── batchUpdateTokenScores ────────────────────────────────

    function _batchUpdateTokenScores(
        address[] memory tokens,
        uint256[] memory scores,
        uint256[] memory reviewCounts,
        uint256[] memory avgRatings,
        TrustScoreOracle.DataSource dataSource
    ) internal {
        TrustScoreOracle.DataSource[] memory dsList = new TrustScoreOracle.DataSource[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) dsList[i] = dataSource;
        oracle.batchUpdateTokenScores(tokens, scores, reviewCounts, avgRatings, dsList);
    }

    function test_BatchUpdate_Success() public {
        address[] memory tokens = new address[](3);
        uint256[] memory scores = new uint256[](3);
        uint256[] memory reviewCounts = new uint256[](3);
        uint256[] memory avgRatings = new uint256[](3);

        tokens[0] = address(0x100);
        scores[0] = 70;
        reviewCounts[0] = 10;
        avgRatings[0] = 350;
        tokens[1] = address(0x200);
        scores[1] = 85;
        reviewCounts[1] = 25;
        avgRatings[1] = 430;
        tokens[2] = address(0x300);
        scores[2] = 95;
        reviewCounts[2] = 80;
        avgRatings[2] = 490;

        _batchUpdateTokenScores(tokens, scores, reviewCounts, avgRatings, TrustScoreOracle.DataSource.API);
        vm.warp(block.timestamp + oracle.SCORE_MIN_AGE() + 1);

        assertEq(oracle.getScore(tokens[0]), 70);
        assertEq(oracle.getScore(tokens[1]), 85);
        assertEq(oracle.getScore(tokens[2]), 95);
    }

    function test_BatchUpdate_ScoresLengthMismatchReverts() public {
        address[] memory tokens = new address[](2);
        uint256[] memory scores = new uint256[](3);
        uint256[] memory reviewCounts = new uint256[](2);
        uint256[] memory avgRatings = new uint256[](2);
        tokens[0] = token;
        tokens[1] = token2;

        vm.expectRevert(TrustScoreOracle.TrustScoreOracle__LengthMismatch.selector);
        _batchUpdateTokenScores(tokens, scores, reviewCounts, avgRatings, TrustScoreOracle.DataSource.API);
    }

    function test_BatchUpdate_ReviewCountsLengthMismatchReverts() public {
        address[] memory tokens = new address[](2);
        uint256[] memory scores = new uint256[](2);
        uint256[] memory reviewCounts = new uint256[](3);
        uint256[] memory avgRatings = new uint256[](2);
        tokens[0] = token;
        tokens[1] = token2;
        scores[0] = 50;
        scores[1] = 60;

        vm.expectRevert(TrustScoreOracle.TrustScoreOracle__LengthMismatch.selector);
        _batchUpdateTokenScores(tokens, scores, reviewCounts, avgRatings, TrustScoreOracle.DataSource.API);
    }

    function test_BatchUpdate_AvgRatingsLengthMismatchReverts() public {
        address[] memory tokens = new address[](2);
        uint256[] memory scores = new uint256[](2);
        uint256[] memory reviewCounts = new uint256[](2);
        uint256[] memory avgRatings = new uint256[](3);
        tokens[0] = token;
        tokens[1] = token2;
        scores[0] = 50;
        scores[1] = 60;

        vm.expectRevert(TrustScoreOracle.TrustScoreOracle__LengthMismatch.selector);
        _batchUpdateTokenScores(tokens, scores, reviewCounts, avgRatings, TrustScoreOracle.DataSource.API);
    }

    function test_BatchUpdate_TooLargeReverts() public {
        uint256 size = 101;
        address[] memory tokens = new address[](size);
        uint256[] memory scores = new uint256[](size);
        uint256[] memory reviewCounts = new uint256[](size);
        uint256[] memory avgRatings = new uint256[](size);

        vm.expectRevert(abi.encodeWithSelector(TrustScoreOracle.TrustScoreOracle__BatchTooLarge.selector, size));
        _batchUpdateTokenScores(tokens, scores, reviewCounts, avgRatings, TrustScoreOracle.DataSource.API);
    }

    function test_BatchUpdate_NotUpdaterReverts() public {
        address[] memory tokens = new address[](1);
        uint256[] memory scores = new uint256[](1);
        uint256[] memory reviewCounts = new uint256[](1);
        uint256[] memory avgRatings = new uint256[](1);
        tokens[0] = token;
        scores[0] = 80;

        vm.prank(attacker);
        vm.expectRevert();
        _batchUpdateTokenScores(tokens, scores, reviewCounts, avgRatings, TrustScoreOracle.DataSource.API);
    }

    // ─── updateUserReputation + fee tiers ─────────────────────

    function test_UserRep_NewUserGetsBaseFee() public view {
        assertEq(oracle.getUserFee(user), oracle.BASE_FEE());
    }

    function test_UserRep_TrustedTier() public {
        oracle.updateUserReputation(user, 25, 5, 100);
        assertEq(oracle.getUserFee(user), 30);
    }

    function test_UserRep_VerifiedTier() public {
        oracle.updateUserReputation(user, 100, 20, 500);
        assertEq(oracle.getUserFee(user), oracle.VERIFIED_FEE());
    }

    function test_UserRep_GuardianTier() public {
        oracle.updateUserReputation(user, 250, 50, 10000);
        assertEq(oracle.getUserFee(user), oracle.GUARDIAN_FEE());
    }

    function test_UserRep_BelowTrustedThreshold() public {
        oracle.updateUserReputation(user, 5, 1, 50);
        assertEq(oracle.getUserFee(user), oracle.BASE_FEE());
    }

    function test_UserRep_EventEmitted() public {
        vm.expectEmit(true, false, false, true);
        emit UserReputationUpdated(user, 100, 10);
        oracle.updateUserReputation(user, 100, 20, 500);
    }

    function test_UserRep_NotUpdaterReverts() public {
        vm.prank(attacker);
        vm.expectRevert();
        oracle.updateUserReputation(user, 100, 20, 500);
    }

    // ─── Pause ─────────────────────────────────────────────────

    function test_Pause_BlocksUpdates() public {
        oracle.pause();
        vm.expectRevert();
        oracle.updateTokenScore(token, 80, 10, 400, TrustScoreOracle.DataSource.API);
    }

    function test_Unpause_AllowsUpdates() public {
        oracle.pause();
        oracle.unpause();
        oracle.updateTokenScore(token, 80, 10, 400, TrustScoreOracle.DataSource.API);
        vm.warp(block.timestamp + oracle.SCORE_MIN_AGE() + 1);
        assertEq(oracle.getScore(token), 80);
    }

    function test_Pause_OnlyAdmin() public {
        vm.prank(attacker);
        vm.expectRevert();
        oracle.pause();
    }

    function test_Pause_ReadsStillWork() public {
        oracle.updateTokenScore(token, 80, 10, 400, TrustScoreOracle.DataSource.API);
        vm.warp(block.timestamp + oracle.SCORE_MIN_AGE() + 1);
        oracle.pause();
        // Reads should still work when paused
        assertEq(oracle.getScore(token), 80);
    }

    // ─── Fuzz ──────────────────────────────────────────────────

    // ─── getScore: staleness ───────────────────────────────────

    function test_GetScore_FreshScore_Passes() public {
        oracle.updateTokenScore(token, 70, 10, 400, TrustScoreOracle.DataSource.VERIFIED);
        // Must be past SCORE_MIN_AGE but before SCORE_MAX_AGE
        vm.warp(block.timestamp + oracle.SCORE_MIN_AGE() + 1);
        assertEq(oracle.getScore(token), 70);
    }

    function test_GetScore_TooFresh_Reverts() public {
        uint256 updatedAt = block.timestamp;
        oracle.updateTokenScore(token, 70, 10, 400, TrustScoreOracle.DataSource.VERIFIED);
        // Not yet past SCORE_MIN_AGE — should revert
        vm.expectRevert(
            abi.encodeWithSelector(
                TrustScoreOracle.TrustScoreOracle__ScoreTooFresh.selector,
                token,
                updatedAt,
                oracle.SCORE_MIN_AGE()
            )
        );
        oracle.getScore(token);
    }

    function test_GetScore_StaleScore_Reverts() public {
        oracle.updateTokenScore(token, 70, 10, 400, TrustScoreOracle.DataSource.VERIFIED);

        // Warp past staleness window
        vm.warp(block.timestamp + 7 days + 1);

        vm.expectRevert(
            abi.encodeWithSelector(TrustScoreOracle.TrustScoreOracle__StaleScore.selector, token, 1, 7 days)
        );
        oracle.getScore(token);
    }

    function test_GetScore_ExactBoundary_Passes() public {
        oracle.updateTokenScore(token, 70, 10, 400, TrustScoreOracle.DataSource.VERIFIED);
        // Exactly at max age — should still pass (MIN_AGE < 7 days ≤ MAX_AGE)
        vm.warp(block.timestamp + 7 days);
        assertEq(oracle.getScore(token), 70);
    }

    function test_GetScore_OneBeyondBoundary_Reverts() public {
        oracle.updateTokenScore(token, 70, 10, 400, TrustScoreOracle.DataSource.VERIFIED);
        vm.warp(block.timestamp + 7 days + 1);
        vm.expectRevert(
            abi.encodeWithSelector(TrustScoreOracle.TrustScoreOracle__StaleScore.selector, token, 1, 7 days)
        );
        oracle.getScore(token);
    }

    function test_GetScore_RefreshResetsStale() public {
        oracle.updateTokenScore(token, 70, 10, 400, TrustScoreOracle.DataSource.VERIFIED);
        vm.warp(block.timestamp + 7 days + 100);

        // Refresh score — then age past SCORE_MIN_AGE before reading
        oracle.updateTokenScore(token, 75, 15, 420, TrustScoreOracle.DataSource.VERIFIED);
        vm.warp(block.timestamp + oracle.SCORE_MIN_AGE() + 1);

        // Should no longer revert
        assertEq(oracle.getScore(token), 75);
    }

    function testFuzz_TokenScore_ValidRange(uint256 score, uint256 reviews, uint256 avgRating) public {
        score = bound(score, 0, 100);
        avgRating = bound(avgRating, 0, oracle.MAX_AVG_RATING()); // 0–500
        oracle.updateTokenScore(token, score, reviews, avgRating, TrustScoreOracle.DataSource.API);
        vm.warp(block.timestamp + oracle.SCORE_MIN_AGE() + 1);
        assertEq(oracle.getScore(token), score);
    }

    function testFuzz_TokenScore_InvalidRange(uint256 score) public {
        score = bound(score, 101, type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(TrustScoreOracle.TrustScoreOracle__ScoreOutOfRange.selector, score));
        oracle.updateTokenScore(token, score, 0, 0, TrustScoreOracle.DataSource.API);
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

    // ─── Fuzz Tests ─────────────────────────────────────────────

    function testFuzz_UpdateTokenScore(
        address fuzzToken,
        uint256 score,
        uint256 reviewCount,
        uint256 avgRating,
        uint8 ds
    ) public {
        vm.assume(fuzzToken != address(0));
        score = bound(score, 0, 100);
        avgRating = bound(avgRating, 0, 500);
        ds = uint8(bound(ds, 0, 4));

        oracle.updateTokenScore(fuzzToken, score, reviewCount, avgRating, TrustScoreOracle.DataSource(ds));
        vm.warp(block.timestamp + oracle.SCORE_MIN_AGE() + 1);

        TrustScoreOracle.TokenScore memory data = oracle.getTokenData(fuzzToken);
        assertEq(data.trustScore, score);
        assertEq(data.reviewCount, reviewCount);
        assertEq(data.avgRating, avgRating);
        assertEq(uint8(data.dataSource), ds);
        assertEq(oracle.getScore(fuzzToken), score);
    }

    function testFuzz_UpdateUserReputation(
        address fuzzUser,
        uint256 repScore,
        uint256 totalReviews,
        uint256 scarabPoints
    ) public {
        vm.assume(fuzzUser != address(0));
        repScore = bound(repScore, 0, 100000);

        oracle.updateUserReputation(fuzzUser, repScore, totalReviews, scarabPoints);

        TrustScoreOracle.UserReputation memory data = oracle.getUserData(fuzzUser);
        assertEq(data.reputationScore, repScore);
        assertEq(data.totalReviews, totalReviews);
        assertEq(data.scarabPoints, scarabPoints);
        assertTrue(data.initialized);
    }

    // ─── resetUserReputation ────────────────────────────────────

    function test_ResetUserReputation_Success() public {
        // First set up a user with non-default reputation
        oracle.updateUserReputation(user, 100, 20, 500);
        assertEq(oracle.getUserFee(user), oracle.VERIFIED_FEE());

        TrustScoreOracle.UserReputation memory repBefore = oracle.getUserData(user);
        assertTrue(repBefore.initialized);

        // Reset
        vm.expectEmit(true, false, false, false);
        emit UserReputationReset(user);

        oracle.resetUserReputation(user);

        // After reset, user should have BASE_FEE (uninitialized)
        assertEq(oracle.getUserFee(user), oracle.BASE_FEE());

        TrustScoreOracle.UserReputation memory repAfter = oracle.getUserData(user);
        assertFalse(repAfter.initialized);
        assertEq(repAfter.reputationScore, 0);
        assertEq(repAfter.totalReviews, 0);
        assertEq(repAfter.scarabPoints, 0);
        assertEq(repAfter.feeBps, 0);
    }

    function test_ResetUserReputation_Unauthorized() public {
        oracle.updateUserReputation(user, 100, 20, 500);

        vm.prank(attacker);
        vm.expectRevert();
        oracle.resetUserReputation(user);
    }

    function test_ResetUserReputation_WhenPaused_Reverts() public {
        oracle.updateUserReputation(user, 100, 20, 500);
        oracle.pause();

        vm.expectRevert();
        oracle.resetUserReputation(user);
    }

    // ─── batchUpdate: avgRating boundary ───────────────────────

    function test_BatchUpdate_AvgRatingOverMaxReverts() public {
        address[] memory tokens = new address[](2);
        uint256[] memory scores = new uint256[](2);
        uint256[] memory reviewCounts = new uint256[](2);
        uint256[] memory avgRatings = new uint256[](2);

        tokens[0]      = address(0x100);
        scores[0]      = 70;
        reviewCounts[0] = 10;
        avgRatings[0]  = 400; // valid

        tokens[1]      = address(0x200);
        scores[1]      = 80;
        reviewCounts[1] = 5;
        avgRatings[1]  = 501; // OVER MAX_AVG_RATING (500) → should revert

        vm.expectRevert(
            abi.encodeWithSelector(TrustScoreOracle.TrustScoreOracle__AvgRatingOutOfRange.selector, 501)
        );
        _batchUpdateTokenScores(tokens, scores, reviewCounts, avgRatings, TrustScoreOracle.DataSource.API);
    }

    // ─── Fee tier exact boundaries ──────────────────────────────

    function test_UserRep_ExactBoundaryAt10() public {
        // rep=10 → TRUSTED tier (>= 10, < 50)
        oracle.updateUserReputation(user, 10, 1, 0);
        assertEq(oracle.getUserFee(user), oracle.TRUSTED_FEE()); // 30 bps
    }

    function test_UserRep_ExactBoundaryAt50() public {
        // rep=50 → VERIFIED tier (>= 50, < 200)
        oracle.updateUserReputation(user, 50, 1, 0);
        assertEq(oracle.getUserFee(user), oracle.VERIFIED_FEE()); // 10 bps
    }

    function test_UserRep_ExactBoundaryAt200() public {
        // rep=200 → GUARDIAN tier (>= 200)
        oracle.updateUserReputation(user, 200, 1, 0);
        assertEq(oracle.getUserFee(user), oracle.GUARDIAN_FEE()); // 0 bps
    }

    function test_UserRep_OneBelowTrusted() public {
        // rep=9 → BASE tier (< 10)
        oracle.updateUserReputation(user, 9, 1, 0);
        assertEq(oracle.getUserFee(user), oracle.BASE_FEE()); // 50 bps
    }

    function test_UserRep_OneBelowVerified() public {
        // rep=49 → TRUSTED tier (>= 10, < 50)
        oracle.updateUserReputation(user, 49, 1, 0);
        assertEq(oracle.getUserFee(user), oracle.TRUSTED_FEE()); // 30 bps
    }

    function test_UserRep_OneBelowGuardian() public {
        // rep=199 → VERIFIED tier (>= 50, < 200)
        oracle.updateUserReputation(user, 199, 1, 0);
        assertEq(oracle.getUserFee(user), oracle.VERIFIED_FEE()); // 10 bps
    }

    // ─── Existing fuzz tests ────────────────────────────────────

    function testFuzz_BatchUpdateTokenScores(
        address[] memory tokens,
        uint256[] memory scores,
        uint256[] memory reviewCounts,
        uint256[] memory avgRatings,
        uint8 ds
    ) public {
        uint256 len = tokens.length;
        if (scores.length < len) len = scores.length;
        if (reviewCounts.length < len) len = reviewCounts.length;
        if (avgRatings.length < len) len = avgRatings.length;
        if (len == 0) return; // Ignore runs with length 0
        if (len > 50) len = 50; // Bound maximum size to prevent OutOfGas

        // Truncate memory arrays to the shortest length
        assembly {
            mstore(tokens, len)
            mstore(scores, len)
            mstore(reviewCounts, len)
            mstore(avgRatings, len)
        }

        TrustScoreOracle.DataSource dataSource = TrustScoreOracle.DataSource(uint8(bound(ds, 0, 4)));

        for (uint256 i = 0; i < len; i++) {
            vm.assume(tokens[i] != address(0));
            scores[i] = bound(scores[i], 0, 100);
            avgRatings[i] = bound(avgRatings[i], 0, 500);
        }

        _batchUpdateTokenScores(tokens, scores, reviewCounts, avgRatings, dataSource);

        for (uint256 i = 0; i < len; i++) {
            // If the token appears again later in the array, its score gets overwritten.
            // Only check the final overwritten value.
            bool overridden = false;
            for (uint256 j = i + 1; j < len; j++) {
                if (tokens[i] == tokens[j]) {
                    overridden = true;
                    break;
                }
            }
            if (overridden) continue;

            TrustScoreOracle.TokenScore memory data = oracle.getTokenData(tokens[i]);
            assertEq(data.trustScore, scores[i]);
            assertEq(data.reviewCount, reviewCounts[i]);
            assertEq(data.avgRating, avgRatings[i]);
            assertEq(uint8(data.dataSource), uint8(dataSource));
            vm.warp(block.timestamp + oracle.SCORE_MIN_AGE() + 1);
            assertEq(oracle.getScore(tokens[i]), scores[i]);
        }
    }
}
