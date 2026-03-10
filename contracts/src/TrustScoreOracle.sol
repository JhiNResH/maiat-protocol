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

    /// @notice Origin of a trust score — determines if the hook should accept it
    enum DataSource {
        NONE, // 0: unset / unknown
        SEED, // 1: hardcoded baseline (not verified)
        API, // 2: scored by off-chain API
        COMMUNITY, // 3: from community reviews
        VERIFIED // 4: audited / multi-source verified

    }

    struct TokenScore {
        uint256 trustScore; // 0-100 overall score
        uint256 reviewCount; // number of community reviews
        uint256 avgRating; // avg rating * 100 (e.g. 450 = 4.5 stars)
        uint256 lastUpdated; // block.timestamp of last update
        DataSource dataSource; // origin of the score
    }

    struct UserReputation {
        uint256 reputationScore; // combined score (reviews + scarab)
        uint256 totalReviews; // reviews written
        uint256 scarabPoints; // Scarab balance
        uint256 feeBps; // fee in basis points (50 = 0.5%)
        bool initialized; // true once updateUserReputation is called
        uint256 lastUpdated;
    }

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    /// @dev SECURITY (MAIAT-006): UPDATER_ROLE controls all trust scores and user reputations.
    ///      RECOMMENDATION: Hold this role with a multi-signature wallet (e.g., Gnosis Safe 3-of-5)
    ///      to prevent single-key compromise from manipulating trust data. A single EOA holding
    ///      this role represents a critical centralization risk — one compromised key grants full
    ///      control over which tokens are tradeable via the TrustGateHook.
    bytes32 public constant UPDATER_ROLE = keccak256("UPDATER_ROLE");

    mapping(address => TokenScore) public tokenScores;
    mapping(address => UserReputation) public userReputations;

    // Fee tiers (basis points)
    uint256 public constant BASE_FEE = 50; // 0.5%
    uint256 public constant TRUSTED_FEE = 30; // 0.3%
    uint256 public constant VERIFIED_FEE = 10; // 0.1%
    uint256 public constant GUARDIAN_FEE = 0; // 0%

    uint256 public constant MAX_SCORE = 100;
    uint256 public constant MAX_BATCH_SIZE = 100;
    /// @notice Max avgRating value: 500 = 5.0 stars (stored as stars * 100)
    uint256 public constant MAX_AVG_RATING = 500;
    /// @notice Score staleness window — scores older than this are considered stale
    uint256 public constant SCORE_MAX_AGE = 7 days;

    // MAIAT-002: Rate limiting — prevents flash score manipulation by UPDATER_ROLE.
    /// @notice Maximum score change allowed per UPDATER_ROLE update (±20 points).
    ///         Large corrections require multiple updates or the DEFAULT_ADMIN_ROLE emergency path.
    uint256 public constant SCORE_MAX_DELTA = 20;
    /// @notice Minimum elapsed time between score updates for the same token (1 hour).
    ///         Prevents flash manipulation: update score → exploit → revert score in one bundle.
    uint256 public constant MIN_UPDATE_INTERVAL = 1 hours;

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
    /// @notice Reverts when a score has not been updated within SCORE_MAX_AGE
    error TrustScoreOracle__StaleScore(address token, uint256 lastUpdated, uint256 maxAge);
    /// @notice MAIAT-002: Reverts when a score change exceeds SCORE_MAX_DELTA
    error TrustScoreOracle__ScoreChangeTooLarge(address token, uint256 oldScore, uint256 newScore, uint256 maxDelta);
    /// @notice MAIAT-002: Reverts when an update is attempted before MIN_UPDATE_INTERVAL has elapsed
    error TrustScoreOracle__UpdateTooSoon(address token, uint256 lastUpdated, uint256 minInterval);

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
    /// @dev Reverts with StaleScore if the score has not been updated within SCORE_MAX_AGE.
    ///      Tokens that have never been scored (lastUpdated == 0) are treated as unscored → score = 0.
    function getScore(address token) external view returns (uint256) {
        TokenScore memory ts = tokenScores[token];
        // Never-scored tokens have lastUpdated == 0 → return 0 (fails trust gate naturally)
        if (ts.lastUpdated == 0) return 0;
        if (block.timestamp - ts.lastUpdated > SCORE_MAX_AGE) {
            revert TrustScoreOracle__StaleScore(token, ts.lastUpdated, SCORE_MAX_AGE);
        }
        return ts.trustScore;
    }

    /// @notice Get fee in basis points for a user based on reputation
    function getUserFee(address user) external view returns (uint256) {
        UserReputation memory rep = userReputations[user];
        if (!rep.initialized) return BASE_FEE;
        return rep.feeBps;
    }

    /// @notice Get the data source for a token's score
    function getDataSource(address token) external view returns (DataSource) {
        return tokenScores[token].dataSource;
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

    /// @notice Update token trust score (UPDATER_ROLE only)
    /// @dev MAIAT-002: Rate limited. Max change = ±SCORE_MAX_DELTA per update.
    ///      Minimum delay = MIN_UPDATE_INTERVAL between updates for the same token.
    ///      First-time updates (lastUpdated == 0) are exempt from both limits.
    ///      For large corrections or incident response, use emergencyUpdateTokenScore (DEFAULT_ADMIN_ROLE).
    function updateTokenScore(
        address token,
        uint256 score,
        uint256 reviewCount,
        uint256 avgRating,
        DataSource dataSource
    ) external onlyRole(UPDATER_ROLE) whenNotPaused {
        if (score > MAX_SCORE) revert TrustScoreOracle__ScoreOutOfRange(score);
        if (avgRating > MAX_AVG_RATING) revert TrustScoreOracle__AvgRatingOutOfRange(avgRating);
        _enforceRateLimit(token, score);
        _writeTokenScore(token, score, reviewCount, avgRating, dataSource);
    }

    /// @notice Emergency score update — bypasses rate limiting (DEFAULT_ADMIN_ROLE only)
    /// @dev Use only for legitimate large corrections (incident response, major re-audit, oracle failure).
    ///      All uses should be justified and communicated to the community.
    function emergencyUpdateTokenScore(
        address token,
        uint256 score,
        uint256 reviewCount,
        uint256 avgRating,
        DataSource dataSource
    ) external onlyRole(DEFAULT_ADMIN_ROLE) whenNotPaused {
        if (score > MAX_SCORE) revert TrustScoreOracle__ScoreOutOfRange(score);
        if (avgRating > MAX_AVG_RATING) revert TrustScoreOracle__AvgRatingOutOfRange(avgRating);
        _writeTokenScore(token, score, reviewCount, avgRating, dataSource);
    }

    /// @notice Update user reputation + fee tier (UPDATER_ROLE only)
    function updateUserReputation(address user, uint256 reputationScore, uint256 totalReviews, uint256 scarabPoints)
        external
        onlyRole(UPDATER_ROLE)
        whenNotPaused
    {
        uint256 feeBps;
        if (reputationScore >= 200) feeBps = GUARDIAN_FEE;
        else if (reputationScore >= 50) feeBps = VERIFIED_FEE;
        else if (reputationScore >= 10) feeBps = TRUSTED_FEE;
        else feeBps = BASE_FEE;

        userReputations[user] = UserReputation({
            reputationScore: reputationScore,
            totalReviews: totalReviews,
            scarabPoints: scarabPoints,
            feeBps: feeBps,
            initialized: true,
            lastUpdated: block.timestamp
        });
        emit UserReputationUpdated(user, reputationScore, feeBps);
    }

    /// @notice Fully reset a user's reputation to uninitialized state (UPDATER_ROLE only)
    /// @dev Use when an account is compromised or needs to be cleared entirely.
    ///      After reset, getUserFee() will return BASE_FEE for the user.
    function resetUserReputation(address user) external onlyRole(UPDATER_ROLE) whenNotPaused {
        delete userReputations[user];
        emit UserReputationReset(user);
    }

    /// @notice Batch update token scores (UPDATER_ROLE only, rate limited per token)
    /// @dev Each token in the batch is individually rate-limited. Duplicate token addresses
    ///      within a single batch will fail on the second occurrence.
    function batchUpdateTokenScores(
        address[] calldata tokens,
        uint256[] calldata scores,
        uint256[] calldata reviewCounts,
        uint256[] calldata avgRatings,
        DataSource dataSource
    ) external onlyRole(UPDATER_ROLE) whenNotPaused {
        uint256 len = tokens.length;
        if (len != scores.length || len != reviewCounts.length || len != avgRatings.length) {
            revert TrustScoreOracle__LengthMismatch();
        }
        if (len > MAX_BATCH_SIZE) revert TrustScoreOracle__BatchTooLarge(len);

        for (uint256 i = 0; i < len; i++) {
            if (scores[i] > MAX_SCORE) revert TrustScoreOracle__ScoreOutOfRange(scores[i]);
            if (avgRatings[i] > MAX_AVG_RATING) revert TrustScoreOracle__AvgRatingOutOfRange(avgRatings[i]);
            _enforceRateLimit(tokens[i], scores[i]);
            _writeTokenScore(tokens[i], scores[i], reviewCounts[i], avgRatings[i], dataSource);
        }
    }

    /// @notice Emergency batch update — bypasses rate limiting (DEFAULT_ADMIN_ROLE only)
    function emergencyBatchUpdateTokenScores(
        address[] calldata tokens,
        uint256[] calldata scores,
        uint256[] calldata reviewCounts,
        uint256[] calldata avgRatings,
        DataSource dataSource
    ) external onlyRole(DEFAULT_ADMIN_ROLE) whenNotPaused {
        uint256 len = tokens.length;
        if (len != scores.length || len != reviewCounts.length || len != avgRatings.length) {
            revert TrustScoreOracle__LengthMismatch();
        }
        if (len > MAX_BATCH_SIZE) revert TrustScoreOracle__BatchTooLarge(len);

        for (uint256 i = 0; i < len; i++) {
            if (scores[i] > MAX_SCORE) revert TrustScoreOracle__ScoreOutOfRange(scores[i]);
            if (avgRatings[i] > MAX_AVG_RATING) revert TrustScoreOracle__AvgRatingOutOfRange(avgRatings[i]);
            _writeTokenScore(tokens[i], scores[i], reviewCounts[i], avgRatings[i], dataSource);
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

    /*//////////////////////////////////////////////////////////////
                          INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @dev MAIAT-002: Enforce rate limiting on UPDATER_ROLE score updates.
    ///      - First-time updates (lastUpdated == 0) are always allowed.
    ///      - Subsequent updates must wait MIN_UPDATE_INTERVAL since the last update.
    ///      - Score change per update must not exceed ±SCORE_MAX_DELTA.
    function _enforceRateLimit(address token, uint256 newScore) internal view {
        TokenScore memory ts = tokenScores[token];
        if (ts.lastUpdated == 0) return; // first update — no restriction

        if (block.timestamp - ts.lastUpdated < MIN_UPDATE_INTERVAL) {
            revert TrustScoreOracle__UpdateTooSoon(token, ts.lastUpdated, MIN_UPDATE_INTERVAL);
        }

        uint256 oldScore = ts.trustScore;
        uint256 delta = newScore > oldScore ? newScore - oldScore : oldScore - newScore;
        if (delta > SCORE_MAX_DELTA) {
            revert TrustScoreOracle__ScoreChangeTooLarge(token, oldScore, newScore, SCORE_MAX_DELTA);
        }
    }

    /// @dev Write token score to storage and emit event
    function _writeTokenScore(
        address token,
        uint256 score,
        uint256 reviewCount,
        uint256 avgRating,
        DataSource dataSource
    ) internal {
        tokenScores[token] = TokenScore({
            trustScore: score,
            reviewCount: reviewCount,
            avgRating: avgRating,
            lastUpdated: block.timestamp,
            dataSource: dataSource
        });
        emit TokenScoreUpdated(token, score, reviewCount);
    }
}
