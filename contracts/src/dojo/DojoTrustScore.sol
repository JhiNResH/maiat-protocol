// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import {ITrustOracle} from "../interfaces/ITrustOracle.sol";

/// @title DojoTrustScore
/// @notice 5-component trust score for Dojo agent/creator reputation
/// @dev Multi-vertical key: scores[subject][vertical]. Evaluator write-only.
///      Implements ITrustOracle so ERC-8183 hooks can read trust scores directly.
///
/// Phase 1 formula (weights in bps, total = 10000):
///   trustScore = evaluatorSuccess  * 3500
///              + buyerAvgRating    * 2500
///              + sellerAvgBehavior * 1500
///              + volumeScore       * 1500
///              + uptimeScore       * 1000
contract DojoTrustScore is AccessControl, ITrustOracle {

    bytes32 public constant EVALUATOR_ROLE = keccak256("EVALUATOR_ROLE");
    bytes32 public constant DEFAULT_VERTICAL = bytes32("dojo");
    uint256 public constant MAX_SCORE = 100;
    uint256 public constant MAX_COMPONENT = 10000; // bps for sub-scores

    struct Score {
        uint16 overall;            // 0-100
        uint16 evaluatorSuccess;   // 0-10000 bps
        uint16 buyerAvgRating;     // 0-10000 bps
        uint16 sellerAvgBehavior;  // 0-10000 bps
        uint16 volumeScore;        // 0-10000 bps
        uint16 uptimeScore;        // 0-10000 bps
        uint32 sessionCount;
        uint64 lastUpdated;
    }

    /// @notice scores[subject][vertical]
    mapping(address => mapping(bytes32 => Score)) public scores;

    event ScoreUpdated(
        address indexed subject,
        bytes32 indexed vertical,
        uint16 overall,
        uint32 sessionCount
    );

    error DojoTrustScore__ComponentOutOfRange();
    error DojoTrustScore__ZeroAddress();

    constructor(address admin) {
        if (admin == address(0)) revert DojoTrustScore__ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(EVALUATOR_ROLE, admin);
    }

    /// @notice Update a subject's trust score for a given vertical
    /// @param subject The agent or creator address
    /// @param vertical The vertical identifier (e.g., bytes32("dojo"))
    /// @param evaluatorSuccess 0-10000 bps
    /// @param buyerAvgRating 0-10000 bps
    /// @param sellerAvgBehavior 0-10000 bps
    /// @param volumeScore 0-10000 bps
    /// @param uptimeScore 0-10000 bps
    /// @param sessionCount Total sessions completed
    function updateScore(
        address subject,
        bytes32 vertical,
        uint16 evaluatorSuccess,
        uint16 buyerAvgRating,
        uint16 sellerAvgBehavior,
        uint16 volumeScore,
        uint16 uptimeScore,
        uint32 sessionCount
    ) external onlyRole(EVALUATOR_ROLE) {
        if (
            evaluatorSuccess > uint16(MAX_COMPONENT) ||
            buyerAvgRating > uint16(MAX_COMPONENT) ||
            sellerAvgBehavior > uint16(MAX_COMPONENT) ||
            volumeScore > uint16(MAX_COMPONENT) ||
            uptimeScore > uint16(MAX_COMPONENT)
        ) revert DojoTrustScore__ComponentOutOfRange();

        // Weighted sum: 3500 + 2500 + 1500 + 1500 + 1000 = 10000
        uint256 weighted =
            uint256(evaluatorSuccess) * 3500 +
            uint256(buyerAvgRating) * 2500 +
            uint256(sellerAvgBehavior) * 1500 +
            uint256(volumeScore) * 1500 +
            uint256(uptimeScore) * 1000;

        // weighted is 0..100_000_000 (10000 * 10000). Divide by 10000 * 100 = 1_000_000 to get 0-100.
        uint16 overall = uint16(weighted / 1_000_000);

        scores[subject][vertical] = Score({
            overall: overall,
            evaluatorSuccess: evaluatorSuccess,
            buyerAvgRating: buyerAvgRating,
            sellerAvgBehavior: sellerAvgBehavior,
            volumeScore: volumeScore,
            uptimeScore: uptimeScore,
            sessionCount: sessionCount,
            lastUpdated: uint64(block.timestamp)
        });

        emit ScoreUpdated(subject, vertical, overall, sessionCount);
    }

    /// @notice Get overall trust score for a subject + vertical
    function getScore(address subject, bytes32 vertical) external view returns (uint16) {
        return scores[subject][vertical].overall;
    }

    /// @notice Get full score breakdown
    function getFullScore(address subject, bytes32 vertical) external view returns (Score memory) {
        return scores[subject][vertical];
    }

    /// @inheritdoc ITrustOracle
    /// @dev Returns the overall score for DEFAULT_VERTICAL ("dojo").
    function getTrustScore(address user) external view override returns (uint256 score) {
        score = uint256(scores[user][DEFAULT_VERTICAL].overall);
    }
}
