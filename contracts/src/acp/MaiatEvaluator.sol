// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @title MaiatEvaluator
 * @notice ERC-8183 Evaluator — trust-based job evaluation for Agentic Commerce.
 *         Reads provider TrustScore from on-chain oracle, decides complete/reject.
 *         Part of Maiat's three-layer protection: Guard (before) + Hook (during) + Evaluator (after).
 * @custom:security-contact security@maiat.xyz
 */

import {Ownable2Step, Ownable} from "openzeppelin-contracts/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

/*//////////////////////////////////////////////////////////////
                        INTERFACES
//////////////////////////////////////////////////////////////*/

/// @notice Minimal interface for ERC-8183 AgenticCommerce contract
/// @dev Aligned with erc-8183/base-contracts reference implementation
interface IAgenticCommerce {
    enum JobStatus {
        Open,
        Funded,
        Submitted,
        Completed,
        Rejected,
        Expired
    }

    struct Job {
        uint256 id;
        address client;
        address provider;
        address evaluator;
        string description;
        uint256 budget;
        uint256 expiredAt;
        JobStatus status;
        address hook;
    }

    function getJob(uint256 jobId) external view returns (Job memory);
    function complete(uint256 jobId, bytes32 reason, bytes calldata optParams) external;
    function reject(uint256 jobId, bytes32 reason, bytes calldata optParams) external;
}

/// @notice Minimal interface for TrustScoreOracle — reads user reputation
interface ITrustScoreOracle {
    struct UserReputation {
        uint256 reputationScore;
        uint256 totalReviews;
        uint256 scarabPoints;
        uint256 feeBps;
        bool initialized;
        uint256 lastUpdated;
    }

    function getUserData(address user) external view returns (UserReputation memory);
}

/*//////////////////////////////////////////////////////////////
                        ERRORS
//////////////////////////////////////////////////////////////*/

error MaiatEvaluator__JobNotSubmitted(uint256 jobId, uint8 currentStatus);
error MaiatEvaluator__NotJobEvaluator(uint256 jobId, address expected, address actual);
error MaiatEvaluator__ThresholdOutOfRange(uint256 value);
error MaiatEvaluator__ZeroAddress();
error MaiatEvaluator__AlreadyEvaluated(uint256 jobId);

/*//////////////////////////////////////////////////////////////
                        CONTRACT
//////////////////////////////////////////////////////////////*/

contract MaiatEvaluator is Ownable2Step, ReentrancyGuard {
    /*//////////////////////////////////////////////////////////////
                            CONSTANTS
    //////////////////////////////////////////////////////////////*/

    uint256 public constant MAX_SCORE = 100;

    /// @notice Rejection reason codes (bytes32)
    bytes32 public constant REASON_LOW_TRUST = keccak256("LOW_TRUST_SCORE");
    bytes32 public constant REASON_FLAGGED = keccak256("FLAGGED_AGENT");
    bytes32 public constant REASON_UNINITIALIZED = keccak256("UNINITIALIZED_PROVIDER");

    /*//////////////////////////////////////////////////////////////
                            STATE
    //////////////////////////////////////////////////////////////*/

    /// @notice TrustScoreOracle for reading provider scores
    ITrustScoreOracle public oracle;

    /// @notice Minimum reputation score to pass evaluation (0-100)
    uint256 public threshold;

    /// @notice Number of threat reports that triggers auto-reject
    uint256 public threatThreshold;

    /// @notice Threat report count per provider
    mapping(address => uint256) public threatReports;

    /// @notice Track evaluated jobs to prevent double-evaluation
    mapping(address => mapping(uint256 => bool)) public evaluated;

    /// @notice Total evaluations completed (for stats)
    uint256 public totalEvaluations;
    uint256 public totalCompleted;
    uint256 public totalRejected;

    /*//////////////////////////////////////////////////////////////
                            EVENTS
    //////////////////////////////////////////////////////////////*/

    event EvaluationResult(
        address indexed acpContract,
        uint256 indexed jobId,
        address indexed provider,
        uint256 score,
        bool completed,
        bytes32 reason
    );

    event ThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    event ThreatThresholdUpdated(uint256 oldCount, uint256 newCount);
    event ThreatReported(address indexed provider, uint256 newCount, address reporter);
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @param _oracle TrustScoreOracle address
    /// @param _threshold Minimum score to pass (0-100)
    /// @param _threatThreshold Threat reports for auto-reject
    /// @param _owner Contract owner
    constructor(
        address _oracle,
        uint256 _threshold,
        uint256 _threatThreshold,
        address _owner
    ) Ownable(_owner) {
        if (_oracle == address(0)) revert MaiatEvaluator__ZeroAddress();
        if (_threshold > MAX_SCORE) revert MaiatEvaluator__ThresholdOutOfRange(_threshold);

        oracle = ITrustScoreOracle(_oracle);
        threshold = _threshold;
        threatThreshold = _threatThreshold;
    }

    /*//////////////////////////////////////////////////////////////
                        CORE: EVALUATE
    //////////////////////////////////////////////////////////////*/

    /// @notice Evaluate a submitted ERC-8183 job
    /// @param acpContract The AgenticCommerce contract holding the job
    /// @param jobId The job to evaluate
    /// @dev Reads provider TrustScore → complete if >= threshold, reject otherwise
    function evaluate(address acpContract, uint256 jobId) external nonReentrant {
        if (acpContract == address(0)) revert MaiatEvaluator__ZeroAddress();

        // Prevent double evaluation
        if (evaluated[acpContract][jobId]) {
            revert MaiatEvaluator__AlreadyEvaluated(jobId);
        }

        IAgenticCommerce acp = IAgenticCommerce(acpContract);
        IAgenticCommerce.Job memory job = acp.getJob(jobId);

        // Must be Submitted
        if (job.status != IAgenticCommerce.JobStatus.Submitted) {
            revert MaiatEvaluator__JobNotSubmitted(jobId, uint8(job.status));
        }

        // This contract must be the evaluator
        if (job.evaluator != address(this)) {
            revert MaiatEvaluator__NotJobEvaluator(jobId, address(this), job.evaluator);
        }

        // Read provider score from oracle
        ITrustScoreOracle.UserReputation memory rep = oracle.getUserData(job.provider);

        uint256 score = rep.initialized ? rep.reputationScore : 0;
        // Cap at MAX_SCORE for comparison
        uint256 cappedScore = score > MAX_SCORE ? MAX_SCORE : score;

        // Decision logic
        bool shouldComplete;
        bytes32 reason;

        uint256 threats = threatReports[job.provider];

        if (threats >= threatThreshold && threatThreshold > 0) {
            // Flagged agent — auto-reject regardless of score
            shouldComplete = false;
            reason = REASON_FLAGGED;
        } else if (!rep.initialized) {
            // Never scored — reject as uninitialized
            shouldComplete = false;
            reason = REASON_UNINITIALIZED;
        } else if (cappedScore >= threshold) {
            // Score meets threshold — complete
            shouldComplete = true;
            reason = bytes32(cappedScore); // attestation: the score itself
        } else {
            // Score too low — reject
            shouldComplete = false;
            reason = REASON_LOW_TRUST;
        }

        // Mark as evaluated before external call
        evaluated[acpContract][jobId] = true;
        totalEvaluations++;

        // Execute decision on ACP contract
        if (shouldComplete) {
            totalCompleted++;
            acp.complete(jobId, reason, "");
        } else {
            totalRejected++;
            acp.reject(jobId, reason, "");
        }

        emit EvaluationResult(acpContract, jobId, job.provider, cappedScore, shouldComplete, reason);
    }

    /*//////////////////////////////////////////////////////////////
                        VIEW: PRE-CHECK
    //////////////////////////////////////////////////////////////*/

    /// @notice Check if a provider would pass evaluation (read-only)
    /// @param provider Address to check
    /// @return score The provider's current reputation score (capped at 100)
    /// @return wouldPass Whether score >= threshold and not flagged
    function preCheck(address provider) external view returns (uint256 score, bool wouldPass) {
        ITrustScoreOracle.UserReputation memory rep = oracle.getUserData(provider);

        if (!rep.initialized) {
            return (0, false);
        }

        score = rep.reputationScore > MAX_SCORE ? MAX_SCORE : rep.reputationScore;

        uint256 threats = threatReports[provider];
        bool flagged = threatThreshold > 0 && threats >= threatThreshold;

        wouldPass = score >= threshold && !flagged;
    }

    /*//////////////////////////////////////////////////////////////
                        ADMIN: CONFIGURATION
    //////////////////////////////////////////////////////////////*/

    /// @notice Update the trust score threshold (owner only)
    function setThreshold(uint256 _threshold) external onlyOwner {
        if (_threshold > MAX_SCORE) revert MaiatEvaluator__ThresholdOutOfRange(_threshold);
        uint256 old = threshold;
        threshold = _threshold;
        emit ThresholdUpdated(old, _threshold);
    }

    /// @notice Update the threat report threshold (owner only)
    function setThreatThreshold(uint256 _count) external onlyOwner {
        uint256 old = threatThreshold;
        threatThreshold = _count;
        emit ThreatThresholdUpdated(old, _count);
    }

    /// @notice Update the oracle address (owner only)
    function setOracle(address _oracle) external onlyOwner {
        if (_oracle == address(0)) revert MaiatEvaluator__ZeroAddress();
        address old = address(oracle);
        oracle = ITrustScoreOracle(_oracle);
        emit OracleUpdated(old, _oracle);
    }

    /// @notice Report a threat against a provider (owner only — batched from off-chain)
    function reportThreat(address provider) external onlyOwner {
        if (provider == address(0)) revert MaiatEvaluator__ZeroAddress();
        threatReports[provider]++;
        emit ThreatReported(provider, threatReports[provider], msg.sender);
    }

    /// @notice Batch report threats (owner only)
    function reportThreats(address[] calldata providers) external onlyOwner {
        for (uint256 i = 0; i < providers.length; i++) {
            if (providers[i] == address(0)) revert MaiatEvaluator__ZeroAddress();
            threatReports[providers[i]]++;
            emit ThreatReported(providers[i], threatReports[providers[i]], msg.sender);
        }
    }

    /// @notice Reset threat count for a provider (owner only — false positive)
    function clearThreats(address provider) external onlyOwner {
        threatReports[provider] = 0;
    }
}
