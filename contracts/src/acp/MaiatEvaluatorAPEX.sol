// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @title MaiatEvaluatorAPEX
 * @notice ERC-8183 Evaluator for BNB Chain APEX ecosystem.
 *         Trust-based fast-path evaluation — seconds instead of UMA's 30-min liveness.
 *         Reads provider TrustScore from on-chain oracle, decides complete/reject.
 *
 *         Deployment: BSC Testnet (97) → BSC Mainnet (56)
 *
 * @dev Key differences from Base (Virtuals ACP) version:
 *      - Job struct field order matches BNB's AgenticCommerceUpgradeable
 *      - Job struct includes `deliverable` field and excludes `id`
 *      - Uses IERC8183 interface naming (ERC standard, not Virtuals-specific)
 *      - Compatible with APEX's evaluator slot (agents choose Maiat over UMA)
 *
 * @custom:security-contact security@maiat.xyz
 */

import {Ownable2Step, Ownable} from "openzeppelin-contracts/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

/*//////////////////////////////////////////////////////////////
                        INTERFACES
//////////////////////////////////////////////////////////////*/

/// @notice ERC-8183 AgenticCommerce interface (BNB Chain / APEX version)
/// @dev Matches AgenticCommerceUpgradeable from bnb-chain/bnbagent-sdk
interface IERC8183 {
    enum Status {
        Open,
        Funded,
        Submitted,
        Completed,
        Rejected,
        Expired
    }

    struct Job {
        address client;
        address provider;
        address evaluator;
        address hook;
        uint256 budget;
        uint256 expiredAt;
        Status status;
        bytes32 deliverable;
        string description;
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

error MaiatEvaluatorAPEX__JobNotSubmitted(uint256 jobId, uint8 currentStatus);
error MaiatEvaluatorAPEX__NotJobEvaluator(uint256 jobId, address expected, address actual);
error MaiatEvaluatorAPEX__ThresholdOutOfRange(uint256 value);
error MaiatEvaluatorAPEX__ThreatThresholdCannotBeZero();
error MaiatEvaluatorAPEX__ZeroAddress();
error MaiatEvaluatorAPEX__AlreadyEvaluated(uint256 jobId);
error MaiatEvaluatorAPEX__CallerNotAllowed(address caller);
error MaiatEvaluatorAPEX__JobContractNotAllowed(address jobContract);

/*//////////////////////////////////////////////////////////////
                        CONTRACT
//////////////////////////////////////////////////////////////*/

contract MaiatEvaluatorAPEX is Ownable2Step, ReentrancyGuard {
    /*//////////////////////////////////////////////////////////////
                            CONSTANTS
    //////////////////////////////////////////////////////////////*/

    uint256 public constant MAX_SCORE = 100;

    bytes32 public constant REASON_LOW_TRUST = keccak256("LOW_TRUST_SCORE");
    bytes32 public constant REASON_FLAGGED = keccak256("FLAGGED_AGENT");
    bytes32 public constant REASON_UNINITIALIZED = keccak256("UNINITIALIZED_PROVIDER");

    /*//////////////////////////////////////////////////////////////
                            STATE
    //////////////////////////////////////////////////////////////*/

    ITrustScoreOracle public oracle;
    uint256 public threshold;
    uint256 public threatThreshold;

    mapping(address => uint256) public threatReports;

    /// @notice Addresses allowed to call evaluate()
    mapping(address => bool) public allowedCallers;

    /// @notice Whitelisted ERC-8183 job contracts
    mapping(address => bool) public allowedJobContracts;

    /// @notice Whether caller restriction is enabled
    bool public callerRestrictionEnabled;

    /// @notice Whether job contract restriction is enabled
    bool public jobContractRestrictionEnabled;

    /// @notice Track evaluated jobs to prevent double-evaluation
    mapping(address => mapping(uint256 => bool)) public evaluated;

    uint256 public totalEvaluations;
    uint256 public totalCompleted;
    uint256 public totalRejected;

    /*//////////////////////////////////////////////////////////////
                            EVENTS
    //////////////////////////////////////////////////////////////*/

    event EvaluationResult(
        address indexed jobContract,
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
    event CallerUpdated(address indexed caller, bool allowed);
    event JobContractUpdated(address indexed jobContract, bool allowed);
    event CallerRestrictionToggled(bool enabled);
    event JobContractRestrictionToggled(bool enabled);
    event ThreatsCleared(address indexed provider);

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @param _oracle TrustScoreOracle address
    /// @param _threshold Minimum score to pass (0-100)
    /// @param _threatThreshold Threat reports for auto-reject (must be > 0)
    /// @param _owner Contract owner
    constructor(
        address _oracle,
        uint256 _threshold,
        uint256 _threatThreshold,
        address _owner
    ) Ownable(_owner) {
        if (_oracle == address(0)) revert MaiatEvaluatorAPEX__ZeroAddress();
        if (_threshold > MAX_SCORE) revert MaiatEvaluatorAPEX__ThresholdOutOfRange(_threshold);
        if (_threatThreshold == 0) revert MaiatEvaluatorAPEX__ThreatThresholdCannotBeZero();

        oracle = ITrustScoreOracle(_oracle);
        threshold = _threshold;
        threatThreshold = _threatThreshold;
    }

    /*//////////////////////////////////////////////////////////////
                        CORE: EVALUATE
    //////////////////////////////////////////////////////////////*/

    /// @notice Evaluate a submitted ERC-8183 job on BNB Chain APEX
    /// @param jobContract The ERC-8183 AgenticCommerce contract
    /// @param jobId The job to evaluate
    function evaluate(address jobContract, uint256 jobId) external nonReentrant {
        if (jobContract == address(0)) revert MaiatEvaluatorAPEX__ZeroAddress();

        // Caller restriction
        if (callerRestrictionEnabled && !allowedCallers[msg.sender]) {
            revert MaiatEvaluatorAPEX__CallerNotAllowed(msg.sender);
        }

        // Job contract whitelist
        if (jobContractRestrictionEnabled && !allowedJobContracts[jobContract]) {
            revert MaiatEvaluatorAPEX__JobContractNotAllowed(jobContract);
        }

        // Prevent double evaluation
        if (evaluated[jobContract][jobId]) {
            revert MaiatEvaluatorAPEX__AlreadyEvaluated(jobId);
        }

        IERC8183 erc8183 = IERC8183(jobContract);
        IERC8183.Job memory job = erc8183.getJob(jobId);

        // Must be Submitted
        if (job.status != IERC8183.Status.Submitted) {
            revert MaiatEvaluatorAPEX__JobNotSubmitted(jobId, uint8(job.status));
        }

        // This contract must be the evaluator
        if (job.evaluator != address(this)) {
            revert MaiatEvaluatorAPEX__NotJobEvaluator(jobId, address(this), job.evaluator);
        }

        // Read provider score from oracle
        ITrustScoreOracle.UserReputation memory rep = oracle.getUserData(job.provider);

        uint256 score = rep.initialized ? rep.reputationScore : 0;
        uint256 cappedScore = score > MAX_SCORE ? MAX_SCORE : score;

        // Decision logic
        bool shouldComplete;
        bytes32 reason;

        uint256 threats = threatReports[job.provider];

        if (threats >= threatThreshold && threatThreshold > 0) {
            shouldComplete = false;
            reason = REASON_FLAGGED;
        } else if (!rep.initialized) {
            shouldComplete = false;
            reason = REASON_UNINITIALIZED;
        } else if (cappedScore >= threshold) {
            shouldComplete = true;
            reason = bytes32(cappedScore);
        } else {
            shouldComplete = false;
            reason = REASON_LOW_TRUST;
        }

        // Effects before interactions (CEI)
        evaluated[jobContract][jobId] = true;
        totalEvaluations++;

        if (shouldComplete) {
            totalCompleted++;
        } else {
            totalRejected++;
        }

        emit EvaluationResult(jobContract, jobId, job.provider, cappedScore, shouldComplete, reason);

        // Interaction last
        if (shouldComplete) {
            erc8183.complete(jobId, reason, "");
        } else {
            erc8183.reject(jobId, reason, "");
        }
    }

    /*//////////////////////////////////////////////////////////////
                        VIEW: PRE-CHECK
    //////////////////////////////////////////////////////////////*/

    /// @notice Check if a provider would pass evaluation (read-only)
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

    function setThreshold(uint256 _threshold) external onlyOwner {
        if (_threshold > MAX_SCORE) revert MaiatEvaluatorAPEX__ThresholdOutOfRange(_threshold);
        uint256 old = threshold;
        threshold = _threshold;
        emit ThresholdUpdated(old, _threshold);
    }

    /// @dev Cannot be set to 0 — that would silently disable the entire threat system
    function setThreatThreshold(uint256 _count) external onlyOwner {
        if (_count == 0) revert MaiatEvaluatorAPEX__ThreatThresholdCannotBeZero();
        uint256 old = threatThreshold;
        threatThreshold = _count;
        emit ThreatThresholdUpdated(old, _count);
    }

    function setOracle(address _oracle) external onlyOwner {
        if (_oracle == address(0)) revert MaiatEvaluatorAPEX__ZeroAddress();
        address old = address(oracle);
        oracle = ITrustScoreOracle(_oracle);
        emit OracleUpdated(old, _oracle);
    }

    function reportThreat(address provider) external onlyOwner {
        if (provider == address(0)) revert MaiatEvaluatorAPEX__ZeroAddress();
        threatReports[provider]++;
        emit ThreatReported(provider, threatReports[provider], msg.sender);
    }

    function reportThreats(address[] calldata providers) external onlyOwner {
        for (uint256 i = 0; i < providers.length; i++) {
            if (providers[i] == address(0)) revert MaiatEvaluatorAPEX__ZeroAddress();
            threatReports[providers[i]]++;
            emit ThreatReported(providers[i], threatReports[providers[i]], msg.sender);
        }
    }

    function clearThreats(address provider) external onlyOwner {
        threatReports[provider] = 0;
        emit ThreatsCleared(provider);
    }

    /*//////////////////////////////////////////////////////////////
                    ADMIN: ACCESS CONTROL
    //////////////////////////////////////////////////////////////*/

    function setCallerRestriction(bool _enabled) external onlyOwner {
        callerRestrictionEnabled = _enabled;
        emit CallerRestrictionToggled(_enabled);
    }

    function setJobContractRestriction(bool _enabled) external onlyOwner {
        jobContractRestrictionEnabled = _enabled;
        emit JobContractRestrictionToggled(_enabled);
    }

    function setAllowedCaller(address caller, bool allowed) external onlyOwner {
        if (caller == address(0)) revert MaiatEvaluatorAPEX__ZeroAddress();
        allowedCallers[caller] = allowed;
        emit CallerUpdated(caller, allowed);
    }

    function setAllowedJobContract(address jobContract, bool allowed) external onlyOwner {
        if (jobContract == address(0)) revert MaiatEvaluatorAPEX__ZeroAddress();
        allowedJobContracts[jobContract] = allowed;
        emit JobContractUpdated(jobContract, allowed);
    }
}
