// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @custom:security-contact security@maiat.xyz
 */

import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import {Pausable} from "openzeppelin-contracts/contracts/utils/Pausable.sol";

/// @title TrustScoreOracle
/// @notice On-chain oracle for Maiat trust scores — fed by community reviews + AI
/// @dev Scores are weighted: On-chain (40%) + Reviews (30%) + Community (20%) + AI (10%)
contract TrustScoreOracle is AccessControl, Pausable {

    /*//////////////////////////////////////////////////////////////
                            TYPE DECLARATIONS
    //////////////////////////////////////////////////////////////*/

    struct TokenScore {
        uint256 trustScore;      // 0-100 overall score
        uint256 reviewCount;     // number of community reviews
        uint256 avgRating;       // avg rating * 100 (e.g. 450 = 4.5 stars)
        uint256 lastUpdated;     // block.timestamp of last update
    }

    struct UserReputation {
        uint256 reputationScore; // combined score (reviews + scarab)
        uint256 totalReviews;    // reviews written
        uint256 scarabPoints;    // Scarab balance
        uint256 feeBps;          // fee in basis points (50 = 0.5%)
        bool    initialized;     // true once updateUserReputation is called
        uint256 lastUpdated;
    }

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    bytes32 public constant UPDATER_ROLE = keccak256("UPDATER_ROLE");

    mapping(address => TokenScore) public tokenScores;
    mapping(address => UserReputation) public userReputations;

    // Fee tiers (basis points)
    uint256 public constant BASE_FEE     = 50;   // 0.5%
    uint256 public constant TRUSTED_FEE  = 30;   // 0.3%
    uint256 public constant VERIFIED_FEE = 10;   // 0.1%
    uint256 public constant GUARDIAN_FEE = 0;    // 0%

    uint256 public constant MAX_SCORE = 100;
    uint256 public constant MAX_BATCH_SIZE = 100;
    /// @notice Max avgRating value: 500 = 5.0 stars (stored as stars * 100)
    uint256 public constant MAX_AVG_RATING = 500;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event TokenScoreUpdated(address indexed token, uint256 score, uint256 reviewCount);
    event UserReputationUpdated(address indexed user, uint256 score, uint256 feeBps);
    event UserReputationReset(address indexed user);

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error TrustScoreOracle__ScoreOutOfRange(uint256 score);
    error TrustScoreOracle__AvgRatingOutOfRange(uint256 avgRating);
    error TrustScoreOracle__LengthMismatch();
    error TrustScoreOracle__BatchTooLarge(uint256 size);

    /*//////////////////////////////////////////////////////////////
                              FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(UPDATER_ROLE, admin);
    }

    /*//////////////////////////////////////////////////////////////
                        USER-FACING READ FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Get trust score for a token (used by TrustGateHook)
    function getScore(address token) external view returns (uint256) {
        return tokenScores[token].trustScore;
    }

    /// @notice Get fee in basis points for a user based on reputation
    function getUserFee(address user) external view returns (uint256) {
        UserReputation memory rep = userReputations[user];
        if (!rep.initialized) return BASE_FEE;
        return rep.feeBps;
    }

    /// @notice Get full token score data
    function getTokenData(address token) external view returns (TokenScore memory) {
        return tokenScores[token];
    }

    /// @notice Get full user reputation data
    function getUserData(address user) external view returns (UserReputation memory) {
        return userReputations[user];
    }

    /*//////////////////////////////////////////////////////////////
                      USER-FACING STATE-CHANGING FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Update token trust score (updater role only)
    /// @dev Called by off-chain service that aggregates community reviews
    function updateTokenScore(
        address token,
        uint256 score,
        uint256 reviewCount,
        uint256 avgRating
    ) external onlyRole(UPDATER_ROLE) whenNotPaused {
        if (score > MAX_SCORE) revert TrustScoreOracle__ScoreOutOfRange(score);
        if (avgRating > MAX_AVG_RATING) revert TrustScoreOracle__AvgRatingOutOfRange(avgRating);
        tokenScores[token] = TokenScore({
            trustScore:  score,
            reviewCount: reviewCount,
            avgRating:   avgRating,
            lastUpdated: block.timestamp
        });
        emit TokenScoreUpdated(token, score, reviewCount);
    }

    /// @notice Update user reputation + fee tier (updater role only)
    function updateUserReputation(
        address user,
        uint256 reputationScore,
        uint256 totalReviews,
        uint256 scarabPoints
    ) external onlyRole(UPDATER_ROLE) whenNotPaused {
        uint256 feeBps;
        if (reputationScore >= 200)      feeBps = GUARDIAN_FEE;
        else if (reputationScore >= 50)  feeBps = VERIFIED_FEE;
        else if (reputationScore >= 10)  feeBps = TRUSTED_FEE;
        else                             feeBps = BASE_FEE;

        userReputations[user] = UserReputation({
            reputationScore: reputationScore,
            totalReviews:    totalReviews,
            scarabPoints:    scarabPoints,
            feeBps:          feeBps,
            initialized:     true,
            lastUpdated:     block.timestamp
        });
        emit UserReputationUpdated(user, reputationScore, feeBps);
    }

    /// @notice Fully reset a user's reputation to uninitialized state (updater role only)
    /// @dev Use when an account is compromised or needs to be cleared entirely.
    ///      After reset, getUserFee() will return BASE_FEE for the user.
    function resetUserReputation(address user) external onlyRole(UPDATER_ROLE) whenNotPaused {
        delete userReputations[user];
        emit UserReputationReset(user);
    }

    /// @notice Batch update token scores
    function batchUpdateTokenScores(
        address[] calldata tokens,
        uint256[] calldata scores,
        uint256[] calldata reviewCounts,
        uint256[] calldata avgRatings
    ) external onlyRole(UPDATER_ROLE) whenNotPaused {
        uint256 len = tokens.length;
        if (len != scores.length || len != reviewCounts.length || len != avgRatings.length) {
            revert TrustScoreOracle__LengthMismatch();
        }
        if (len > MAX_BATCH_SIZE) revert TrustScoreOracle__BatchTooLarge(len);

        for (uint256 i = 0; i < len; i++) {
            if (scores[i] > MAX_SCORE) revert TrustScoreOracle__ScoreOutOfRange(scores[i]);
            if (avgRatings[i] > MAX_AVG_RATING) revert TrustScoreOracle__AvgRatingOutOfRange(avgRatings[i]);
            tokenScores[tokens[i]] = TokenScore({
                trustScore:  scores[i],
                reviewCount: reviewCounts[i],
                avgRating:   avgRatings[i],
                lastUpdated: block.timestamp
            });
            emit TokenScoreUpdated(tokens[i], scores[i], reviewCounts[i]);
        }
    }

    /*//////////////////////////////////////////////////////////////
                          ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Pause all state-changing operations
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /// @notice Unpause operations
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
