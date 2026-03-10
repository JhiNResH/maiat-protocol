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
        assertEq(oracle.getScore(token), 80);
    }

    function test_Constructor_FeeTiersCorrect() public view {
        assertEq(oracle.BASE_FEE(), 50);
        assertEq(oracle.TRUSTED_FEE(), 30);
        assertEq(oracle.VERIFIED_FEE(), 10);
        assertEq(oracle.GUARDIAN_FEE(), 0);
    }

    // ─── Rate Limiting Constants ──────────────────────────────

    function test_Constants_ScoreMaxDelta() public view {
        assertEq(oracle.SCORE_MAX_DELTA(), 20);
    }

    function test_Constants_MinUpdateInterval() public view {
        assertEq(oracle.MIN_UPDATE_INTERVAL(), 1 hours);
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
        assertEq(oracle.getScore(token), 0);
    }

    function test_UpdateTokenScore_MaxScore() public {
        oracle.updateTokenScore(token, 100, 1000, 500, TrustScoreOracle.DataSource.VERIFIED);
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

    /// @dev MAIAT-002: Overwrite now requires warp + small delta
    function test_UpdateTokenScore_Overwrite() public {
        oracle.updateTokenScore(token, 50, 5, 300, TrustScoreOracle.DataSource.SEED);
        // Must wait MIN_UPDATE_INTERVAL and change within ±SCORE_MAX_DELTA
        vm.warp(block.timestamp + 1 hours);
        oracle.updateTokenScore(token, 65, 20, 480, TrustScoreOracle.DataSource.VERIFIED); // delta = 15 ≤ 20
        assertEq(oracle.getScore(token), 65);
        assertEq(uint8(oracle.getDataSource(token)), uint8(TrustScoreOracle.DataSource.VERIFIED));
    }

    // ─── MAIAT-002: Rate Limiting Tests ───────────────────────

    function test_RateLimit_FirstUpdateAlwaysAllowed() public {
        // First update: lastUpdated == 0 → no rate limit
        oracle.updateTokenScore(token, 80, 10, 400, TrustScoreOracle.DataSource.API);
        assertEq(oracle.getScore(token), 80);
    }

    function test_RateLimit_UpdateTooSoon_Reverts() public {
        oracle.updateTokenScore(token, 50, 10, 400, TrustScoreOracle.DataSource.API);
        // Immediately try to update again — should fail
        TrustScoreOracle.TokenScore memory ts = oracle.getTokenData(token);
        vm.expectRevert(
            abi.encodeWithSelector(
                TrustScoreOracle.TrustScoreOracle__UpdateTooSoon.selector,
                token,
                ts.lastUpdated,
                oracle.MIN_UPDATE_INTERVAL()
            )
        );
        oracle.updateTokenScore(token, 55, 10, 400, TrustScoreOracle.DataSource.API);
    }

    function test_RateLimit_DeltaTooLarge_Reverts() public {
        oracle.updateTokenScore(token, 10, 5, 200, TrustScoreOracle.DataSource.API);
        vm.warp(block.timestamp + 1 hours);
        // Delta 10 → 80 = 70 > SCORE_MAX_DELTA (20)
        vm.expectRevert(
            abi.encodeWithSelector(
                TrustScoreOracle.TrustScoreOracle__ScoreChangeTooLarge.selector,
                token,
                10,
                80,
                oracle.SCORE_MAX_DELTA()
            )
        );
        oracle.updateTokenScore(token, 80, 10, 400, TrustScoreOracle.DataSource.API);
    }

    function test_RateLimit_ExactMaxDelta_Passes() public {
        oracle.updateTokenScore(token, 50, 10, 400, TrustScoreOracle.DataSource.API);
        vm.warp(block.timestamp + 1 hours);
        // Delta exactly 20 → should pass
        oracle.updateTokenScore(token, 70, 10, 400, TrustScoreOracle.DataSource.API);
        assertEq(oracle.getScore(token), 70);
    }

    function test_RateLimit_OneBeyondMaxDelta_Reverts() public {
        oracle.updateTokenScore(token, 50, 10, 400, TrustScoreOracle.DataSource.API);
        vm.warp(block.timestamp + 1 hours);
        // Delta 21 → should fail
        vm.expectRevert(
            abi.encodeWithSelector(
                TrustScoreOracle.TrustScoreOracle__ScoreChangeTooLarge.selector,
                token,
                50,
                71,
                oracle.SCORE_MAX_DELTA()
            )
        );
        oracle.updateTokenScore(token, 71, 10, 400, TrustScoreOracle.DataSource.API);
    }

    function test_RateLimit_ExactIntervalBoundary_Passes() public {
        oracle.updateTokenScore(token, 50, 10, 400, TrustScoreOracle.DataSource.API);
        // Exactly 1 hour later — should pass (not strictly greater)
        vm.warp(block.timestamp + 1 hours);
        oracle.updateTokenScore(token, 60, 10, 400, TrustScoreOracle.DataSource.API);
        assertEq(oracle.getScore(token), 60);
    }

    function test_RateLimit_OneBelowInterval_Reverts() public {
        oracle.updateTokenScore(token, 50, 10, 400, TrustScoreOracle.DataSource.API);
        vm.warp(block.timestamp + 1 hours - 1); // 1 second short
        vm.expectRevert();
        oracle.updateTokenScore(token, 60, 10, 400, TrustScoreOracle.DataSource.API);
    }

    function test_RateLimit_DecreaseScore_Passes() public {
        oracle.updateTokenScore(token, 80, 10, 400, TrustScoreOracle.DataSource.API);
        vm.warp(block.timestamp + 1 hours);
        // Decrease by 15 ≤ 20 — should pass
        oracle.updateTokenScore(token, 65, 10, 400, TrustScoreOracle.DataSource.API);
        assertEq(oracle.getScore(token), 65);
    }

    function test_RateLimit_FlashManipulationBlocked() public {
        // Simulate MAIAT-002 attack vector:
        // 1. Set scam token initial low score
        oracle.updateTokenScore(token, 5, 2, 100, TrustScoreOracle.DataSource.API);

        // 2. Try to flash-whitelist to 99 in same block → UpdateTooSoon
        vm.expectRevert();
        oracle.updateTokenScore(token, 99, 100, 450, TrustScoreOracle.DataSource.VERIFIED);

        // 3. Even after 1 hour, delta too large (5 → 99 = 94 > 20) → ScoreChangeTooLarge
        vm.warp(block.timestamp + 1 hours);
        vm.expectRevert();
        oracle.updateTokenScore(token, 99, 100, 450, TrustScoreOracle.DataSource.VERIFIED);

        // Score remains at 5 — gate still blocks this token
        assertEq(oracle.getScore(token), 5);
    }

    function test_RateLimit_GradualIncrease_Allowed() public {
        // A legitimate large score change requires multiple updates over time
        oracle.updateTokenScore(token, 10, 5, 200, TrustScoreOracle.DataSource.API);
        vm.warp(block.timestamp + 1 hours);
        oracle.updateTokenScore(token, 30, 10, 300, TrustScoreOracle.DataSource.API); // +20
        vm.warp(block.timestamp + 1 hours);
        oracle.updateTokenScore(token, 50, 20, 400, TrustScoreOracle.DataSource.API); // +20
        vm.warp(block.timestamp + 1 hours);
        oracle.updateTokenScore(token, 70, 30, 430, TrustScoreOracle.DataSource.VERIFIED); // +20
        assertEq(oracle.getScore(token), 70);
    }

    // ─── Emergency Update (admin bypass) ──────────────────────

    function test_EmergencyUpdate_BypassesRateLimit() public {
        oracle.updateTokenScore(token, 50, 10, 400, TrustScoreOracle.DataSource.API);
        // No warp, large delta — emergency path bypasses both checks
        oracle.emergencyUpdateTokenScore(token, 5, 0, 0, TrustScoreOracle.DataSource.NONE);
        assertEq(oracle.getScore(token), 5);
    }

    function test_EmergencyUpdate_RequiresAdminRole() public {
        vm.prank(updater); // updater has UPDATER_ROLE but not DEFAULT_ADMIN_ROLE
        vm.expectRevert();
        oracle.emergencyUpdateTokenScore(token, 80, 10, 400, TrustScoreOracle.DataSource.API);
    }

    function test_EmergencyUpdate_AttackerReverts() public {
        vm.prank(attacker);
        vm.expectRevert();
        oracle.emergencyUpdateTokenScore(token, 80, 10, 400, TrustScoreOracle.DataSource.API);
    }

    function test_EmergencyUpdate_ValidatesScore() public {
        vm.expectRevert(abi.encodeWithSelector(TrustScoreOracle.TrustScoreOracle__ScoreOutOfRange.selector, 101));
        oracle.emergencyUpdateTokenScore(token, 101, 0, 0, TrustScoreOracle.DataSource.API);
    }

    // ─── batchUpdateTokenScores ────────────────────────────────

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

        oracle.batchUpdateTokenScores(tokens, scores, reviewCounts, avgRatings, TrustScoreOracle.DataSource.API);

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
        oracle.batchUpdateTokenScores(tokens, scores, reviewCounts, avgRatings, TrustScoreOracle.DataSource.API);
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
        oracle.batchUpdateTokenScores(tokens, scores, reviewCounts, avgRatings, TrustScoreOracle.DataSource.API);
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
        oracle.batchUpdateTokenScores(tokens, scores, reviewCounts, avgRatings, TrustScoreOracle.DataSource.API);
    }

    function test_BatchUpdate_TooLargeReverts() public {
        uint256 size = 101;
        address[] memory tokens = new address[](size);
        uint256[] memory scores = new uint256[](size);
        uint256[] memory reviewCounts = new uint256[](size);
        uint256[] memory avgRatings = new uint256[](size);

        vm.expectRevert(abi.encodeWithSelector(TrustScoreOracle.TrustScoreOracle__BatchTooLarge.selector, size));
        oracle.batchUpdateTokenScores(tokens, scores, reviewCounts, avgRatings, TrustScoreOracle.DataSource.API);
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
        oracle.batchUpdateTokenScores(tokens, scores, reviewCounts, avgRatings, TrustScoreOracle.DataSource.API);
    }

    function test_BatchUpdate_RateLimit_DuplicateTokenReverts() public {
        // MAIAT-002: duplicate token in batch triggers UpdateTooSoon on second occurrence
        address[] memory tokens = new address[](2);
        uint256[] memory scores = new uint256[](2);
        uint256[] memory reviewCounts = new uint256[](2);
        uint256[] memory avgRatings = new uint256[](2);

        tokens[0] = token;
        scores[0] = 50;
        reviewCounts[0] = 5;
        avgRatings[0] = 300;
        tokens[1] = token; // duplicate
        scores[1] = 55;
        reviewCounts[1] = 6;
        avgRatings[1] = 310;

        vm.expectRevert(); // UpdateTooSoon on second occurrence
        oracle.batchUpdateTokenScores(tokens, scores, reviewCounts, avgRatings, TrustScoreOracle.DataSource.API);
    }

    // ─── Emergency Batch Update ────────────────────────────────

    function test_EmergencyBatch_BypassesRateLimit() public {
        address[] memory tokens = new address[](2);
        uint256[] memory scores = new uint256[](2);
        uint256[] memory reviewCounts = new uint256[](2);
        uint256[] memory avgRatings = new uint256[](2);

        tokens[0] = token;
        scores[0] = 80;
        reviewCounts[0] = 10;
        avgRatings[0] = 400;
        tokens[1] = token2;
        scores[1] = 70;
        reviewCounts[1] = 5;
        avgRatings[1] = 350;

        // First set via normal path
        oracle.updateTokenScore(token, 50, 5, 300, TrustScoreOracle.DataSource.API);

        // Emergency batch: no interval wait, large delta on token, fresh token2
        oracle.emergencyBatchUpdateTokenScores(tokens, scores, reviewCounts, avgRatings, TrustScoreOracle.DataSource.VERIFIED);

        assertEq(oracle.getScore(token), 80);
        assertEq(oracle.getScore(token2), 70);
    }

    function test_EmergencyBatch_RequiresAdminRole() public {
        address[] memory tokens = new address[](1);
        uint256[] memory scores = new uint256[](1);
        uint256[] memory reviewCounts = new uint256[](1);
        uint256[] memory avgRatings = new uint256[](1);
        tokens[0] = token;
        scores[0] = 80;

        vm.prank(updater);
        vm.expectRevert();
        oracle.emergencyBatchUpdateTokenScores(tokens, scores, reviewCounts, avgRatings, TrustScoreOracle.DataSource.API);
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
        assertEq(oracle.getScore(token), 80);
    }

    function test_Pause_OnlyAdmin() public {
        vm.prank(attacker);
        vm.expectRevert();
        oracle.pause();
    }

    function test_Pause_ReadsStillWork() public {
        oracle.updateTokenScore(token, 80, 10, 400, TrustScoreOracle.DataSource.API);
        oracle.pause();
        // Reads should still work when paused
        assertEq(oracle.getScore(token), 80);
    }

    // ─── getScore: staleness ───────────────────────────────────

    function test_GetScore_FreshScore_Passes() public {
        oracle.updateTokenScore(token, 70, 10, 400, TrustScoreOracle.DataSource.VERIFIED);
        // Should not revert — score is fresh
        assertEq(oracle.getScore(token), 70);
    }

    function test_GetScore_StaleScore_Reverts() public {
        oracle.updateTokenScore(token, 70, 10, 400, TrustScoreOracle.DataSource.VERIFIED);
        uint256 updatedAt = block.timestamp;

        // Warp past staleness window
        vm.warp(block.timestamp + 7 days + 1);

        vm.expectRevert(
            abi.encodeWithSelector(TrustScoreOracle.TrustScoreOracle__StaleScore.selector, token, updatedAt, 7 days)
        );
        oracle.getScore(token);
    }

    function test_GetScore_ExactBoundary_Passes() public {
        oracle.updateTokenScore(token, 70, 10, 400, TrustScoreOracle.DataSource.VERIFIED);
        // Exactly at max age — should still pass (not strictly greater)
        vm.warp(block.timestamp + 7 days);
        assertEq(oracle.getScore(token), 70);
    }

    function test_GetScore_OneBeyondBoundary_Reverts() public {
        oracle.updateTokenScore(token, 70, 10, 400, TrustScoreOracle.DataSource.VERIFIED);
        uint256 updatedAt = block.timestamp;
        vm.warp(block.timestamp + 7 days + 1);
        vm.expectRevert(
            abi.encodeWithSelector(TrustScoreOracle.TrustScoreOracle__StaleScore.selector, token, updatedAt, 7 days)
        );
        oracle.getScore(token);
    }

    function test_GetScore_RefreshResetsStale() public {
        oracle.updateTokenScore(token, 70, 10, 400, TrustScoreOracle.DataSource.VERIFIED);
        vm.warp(block.timestamp + 7 days + 100); // well past MIN_UPDATE_INTERVAL

        // delta 70→75 = 5 ≤ 20, interval satisfied → passes rate limit
        oracle.updateTokenScore(token, 75, 15, 420, TrustScoreOracle.DataSource.VERIFIED);

        // Should no longer revert
        assertEq(oracle.getScore(token), 75);
    }

    // ─── Fuzz ──────────────────────────────────────────────────

    function testFuzz_TokenScore_ValidRange(uint256 score, uint256 reviews, uint256 avgRating) public {
        score = bound(score, 0, 100);
        avgRating = bound(avgRating, 0, oracle.MAX_AVG_RATING()); // 0–500
        oracle.updateTokenScore(token, score, reviews, avgRating, TrustScoreOracle.DataSource.API);
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

        // First update for any fuzz token → no rate limiting (lastUpdated == 0)
        oracle.updateTokenScore(fuzzToken, score, reviewCount, avgRating, TrustScoreOracle.DataSource(ds));

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
        oracle.updateUserReputation(user, 100, 20, 500);
        assertEq(oracle.getUserFee(user), oracle.VERIFIED_FEE());

        TrustScoreOracle.UserReputation memory repBefore = oracle.getUserData(user);
        assertTrue(repBefore.initialized);

        vm.expectEmit(true, false, false, false);
        emit UserReputationReset(user);

        oracle.resetUserReputation(user);

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

        tokens[0] = address(0x100);
        scores[0] = 70;
        reviewCounts[0] = 10;
        avgRatings[0] = 400; // valid

        tokens[1] = address(0x200);
        scores[1] = 80;
        reviewCounts[1] = 5;
        avgRatings[1] = 501; // OVER MAX_AVG_RATING (500) → should revert

        vm.expectRevert(
            abi.encodeWithSelector(TrustScoreOracle.TrustScoreOracle__AvgRatingOutOfRange.selector, 501)
        );
        oracle.batchUpdateTokenScores(tokens, scores, reviewCounts, avgRatings, TrustScoreOracle.DataSource.API);
    }

    // ─── Fee tier exact boundaries ──────────────────────────────

    function test_UserRep_ExactBoundaryAt10() public {
        oracle.updateUserReputation(user, 10, 1, 0);
        assertEq(oracle.getUserFee(user), oracle.TRUSTED_FEE());
    }

    function test_UserRep_ExactBoundaryAt50() public {
        oracle.updateUserReputation(user, 50, 1, 0);
        assertEq(oracle.getUserFee(user), oracle.VERIFIED_FEE());
    }

    function test_UserRep_ExactBoundaryAt200() public {
        oracle.updateUserReputation(user, 200, 1, 0);
        assertEq(oracle.getUserFee(user), oracle.GUARDIAN_FEE());
    }

    function test_UserRep_OneBelowTrusted() public {
        oracle.updateUserReputation(user, 9, 1, 0);
        assertEq(oracle.getUserFee(user), oracle.BASE_FEE());
    }

    function test_UserRep_OneBelowVerified() public {
        oracle.updateUserReputation(user, 49, 1, 0);
        assertEq(oracle.getUserFee(user), oracle.TRUSTED_FEE());
    }

    function test_UserRep_OneBelowGuardian() public {
        oracle.updateUserReputation(user, 199, 1, 0);
        assertEq(oracle.getUserFee(user), oracle.VERIFIED_FEE());
    }

    // ─── Batch Fuzz (deduplicated tokens) ──────────────────────

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
        if (len == 0) return;
        if (len > 10) len = 10; // Reduced from 50: avoids O(n^2) vm.assume overhead

        // Truncate to shortest
        assembly {
            mstore(tokens, len)
            mstore(scores, len)
            mstore(reviewCounts, len)
            mstore(avgRatings, len)
        }

        TrustScoreOracle.DataSource dataSource = TrustScoreOracle.DataSource(uint8(bound(ds, 0, 4)));

        // MAIAT-002: Deduplicate tokens — duplicates in a batch would trigger UpdateTooSoon
        for (uint256 i = 0; i < len; i++) {
            vm.assume(tokens[i] != address(0));
            // Ensure uniqueness vs all prior tokens in this batch
            for (uint256 j = 0; j < i; j++) {
                vm.assume(tokens[i] != tokens[j]);
            }
            scores[i] = bound(scores[i], 0, 100);
            avgRatings[i] = bound(avgRatings[i], 0, 500);
        }

        // All tokens are first-time updates (fresh oracle from setUp) → no rate limiting
        oracle.batchUpdateTokenScores(tokens, scores, reviewCounts, avgRatings, dataSource);

        for (uint256 i = 0; i < len; i++) {
            TrustScoreOracle.TokenScore memory data = oracle.getTokenData(tokens[i]);
            assertEq(data.trustScore, scores[i]);
            assertEq(data.reviewCount, reviewCounts[i]);
            assertEq(data.avgRating, avgRatings[i]);
            assertEq(uint8(data.dataSource), uint8(dataSource));
            assertEq(oracle.getScore(tokens[i]), scores[i]);
        }
    }
}
