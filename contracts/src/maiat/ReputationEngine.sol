// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "openzeppelin-contracts/contracts/access/Ownable.sol";

/**
 * @title ReputationEngine — Per-skill reputation + dynamic fee (ERC-8183 style)
 * @notice Tracks per-skill reputation scores for autonomous workers.
 *         Higher reputation → lower fees (market self-selection).
 */
contract ReputationEngine is Ownable {
    struct SkillRep {
        uint256 totalScore;   // sum of all ratings (scaled by 20 to map 1-5 → 20-100)
        uint256 totalRatings; // number of ratings received
    }

    // agent => skillId => reputation data
    mapping(address => mapping(uint256 => SkillRep)) public skillReputation;
    // agent => list of skill ids they have reputation for
    mapping(address => uint256[]) private _ratedSkills;
    // agent => skillId => has been rated before
    mapping(address => mapping(uint256 => bool)) private _hasRatedSkill;

    // Authorized callers (JobMarket contract)
    mapping(address => bool) public authorizedCallers;

    event ReputationUpdated(address indexed agent, uint256 indexed skillId, uint256 newScore);
    event FeeAdjusted(address indexed agent, uint256 oldFee, uint256 newFee);
    event CallerAuthorized(address indexed caller, bool authorized);

    constructor() Ownable(msg.sender) {}

    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        authorizedCallers[caller] = authorized;
        emit CallerAuthorized(caller, authorized);
    }

    /// @notice Update reputation after a job rating (1-5 scale)
    /// @param agent The worker address
    /// @param skillId The skill being rated (0 = general)
    /// @param rating Score from 1-5
    function updateReputation(address agent, uint256 skillId, uint8 rating) external {
        require(authorizedCallers[msg.sender], "not authorized");
        require(rating >= 1 && rating <= 5, "rating must be 1-5");

        // Convert 1-5 to 20-100 scale
        uint256 scaledRating = uint256(rating) * 20;

        SkillRep storage rep = skillReputation[agent][skillId];
        rep.totalScore += scaledRating;
        rep.totalRatings++;

        // Track rated skills
        if (!_hasRatedSkill[agent][skillId]) {
            _hasRatedSkill[agent][skillId] = true;
            _ratedSkills[agent].push(skillId);
        }

        uint256 newScore = rep.totalScore / rep.totalRatings;
        emit ReputationUpdated(agent, skillId, newScore);
    }

    /// @notice Get reputation score for a specific skill (0-100)
    function getReputation(address agent, uint256 skillId) external view returns (uint256) {
        SkillRep storage rep = skillReputation[agent][skillId];
        if (rep.totalRatings == 0) return 50; // default: neutral
        return rep.totalScore / rep.totalRatings;
    }

    /// @notice Get global reputation (weighted average across all skills)
    function getGlobalReputation(address agent) external view returns (uint256) {
        uint256[] storage rated = _ratedSkills[agent];
        if (rated.length == 0) return 50;

        uint256 totalScore;
        uint256 totalRatings;
        for (uint256 i = 0; i < rated.length; i++) {
            SkillRep storage rep = skillReputation[agent][rated[i]];
            totalScore += rep.totalScore;
            totalRatings += rep.totalRatings;
        }
        return totalScore / totalRatings;
    }

    /// @notice Calculate adjusted fee based on reputation (ERC-8183 style)
    /// @param agent The worker
    /// @param baseFeeBps Base fee in basis points
    /// @return adjustedFeeBps The adjusted fee
    function calculateFee(address agent, uint256 baseFeeBps) external view returns (uint256 adjustedFeeBps) {
        uint256[] storage rated = _ratedSkills[agent];
        uint256 rep = 50; // default
        if (rated.length > 0) {
            uint256 totalScore;
            uint256 totalRatings;
            for (uint256 i = 0; i < rated.length; i++) {
                SkillRep storage r = skillReputation[agent][rated[i]];
                totalScore += r.totalScore;
                totalRatings += r.totalRatings;
            }
            rep = totalScore / totalRatings;
        }

        // Dynamic fee: high rep = low fee, low rep = high fee
        if (rep >= 90) {
            adjustedFeeBps = baseFeeBps * 50 / 100;  // 50% of base (reward)
        } else if (rep >= 70) {
            adjustedFeeBps = baseFeeBps * 75 / 100;  // 75% of base
        } else if (rep >= 50) {
            adjustedFeeBps = baseFeeBps;              // 100% (neutral)
        } else if (rep >= 30) {
            adjustedFeeBps = baseFeeBps * 150 / 100;  // 150% of base
        } else {
            adjustedFeeBps = baseFeeBps * 200 / 100;  // 200% of base (penalty)
        }
    }

    /// @notice Get number of ratings for a skill
    function getRatingCount(address agent, uint256 skillId) external view returns (uint256) {
        return skillReputation[agent][skillId].totalRatings;
    }

    /// @notice Get all skill IDs an agent has been rated on
    function getRatedSkills(address agent) external view returns (uint256[] memory) {
        return _ratedSkills[agent];
    }
}
