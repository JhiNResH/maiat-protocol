// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "./ReputationEngine.sol";
import "./SkillRegistry.sol";

/**
 * @title JobMarket — Autonomous Worker Job Board
 * @notice Buyers post jobs, Workers accept & complete them, mutual reviews.
 *         Reputation updates happen automatically via ReputationEngine.
 *         Supports bilateral Airbnb-style reviews (buyer rates worker, worker rates buyer).
 */
contract JobMarket {
    enum JobStatus { Open, InProgress, Completed, Rated, Cancelled }

    struct Job {
        address buyer;
        address worker;
        string description;
        uint256 reward;
        uint256 preferredSkillId; // 0 = open to all
        JobStatus status;
        uint8 buyerRating;  // buyer rates worker (1-5, 0 = not rated)
        uint8 workerRating; // worker rates buyer (1-5, 0 = not rated)
        uint256 createdAt;
    }

    ReputationEngine public reputationEngine;
    SkillRegistry public skillRegistry;
    address public owner;

    uint256 public nextJobId = 1;
    mapping(uint256 => Job) public jobs;
    uint256[] private _openJobIds;
    // Track open job index for efficient removal
    mapping(uint256 => uint256) private _openJobIndex;

    event JobPosted(uint256 indexed jobId, address indexed buyer, string description, uint256 reward, uint256 preferredSkillId);
    event JobAccepted(uint256 indexed jobId, address indexed worker);
    event JobCompleted(uint256 indexed jobId, address indexed worker);
    event BuyerRatedWorker(uint256 indexed jobId, address indexed buyer, address indexed worker, uint8 rating);
    event WorkerRatedBuyer(uint256 indexed jobId, address indexed worker, address indexed buyer, uint8 rating);
    event JobCancelled(uint256 indexed jobId, address indexed buyer);
    event Withdrawn(address indexed to, uint256 amount);

    constructor(address _reputationEngine, address _skillRegistry) {
        reputationEngine = ReputationEngine(_reputationEngine);
        skillRegistry = SkillRegistry(_skillRegistry);
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "onlyOwner");
        _;
    }

    /// @notice Buyer posts a job with reward locked in contract
    function postJob(
        string calldata description,
        uint256 preferredSkillId
    ) external payable returns (uint256 jobId) {
        require(msg.value > 0, "reward required");

        jobId = nextJobId++;
        jobs[jobId] = Job({
            buyer: msg.sender,
            worker: address(0),
            description: description,
            reward: msg.value,
            preferredSkillId: preferredSkillId,
            status: JobStatus.Open,
            buyerRating: 0,
            workerRating: 0,
            createdAt: block.timestamp
        });

        // Track in open jobs list
        _openJobIndex[jobId] = _openJobIds.length;
        _openJobIds.push(jobId);

        emit JobPosted(jobId, msg.sender, description, msg.value, preferredSkillId);
    }

    /// @notice Worker accepts an open job
    function acceptJob(uint256 jobId) external {
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.Open, "job not open");
        require(job.buyer != msg.sender, "buyer cannot accept own job");

        job.worker = msg.sender;
        job.status = JobStatus.InProgress;

        // Remove from open jobs
        _removeFromOpenJobs(jobId);

        emit JobAccepted(jobId, msg.sender);
    }

    /// @notice Worker marks job as completed
    function completeJob(uint256 jobId) external {
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.InProgress, "job not in progress");
        require(job.worker == msg.sender, "only worker can complete");

        job.status = JobStatus.Completed;
        emit JobCompleted(jobId, msg.sender);
    }

    /// @notice Buyer rates the worker (1-5) — triggers reputation update + payout
    function buyerRateWorker(uint256 jobId, uint8 score) external {
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.Completed || job.status == JobStatus.Rated, "job not completed");
        require(job.buyer == msg.sender, "only buyer can rate worker");
        require(job.buyerRating == 0, "already rated");
        require(score >= 1 && score <= 5, "score must be 1-5");

        // CEI: State changes BEFORE external calls
        job.buyerRating = score;
        job.status = JobStatus.Rated;

        // Calculate fee based on reputation
        uint256 skillId = job.preferredSkillId;
        uint256 baseFeeBps = 500; // 5% base fee
        uint256 adjustedFeeBps = reputationEngine.calculateFee(job.worker, baseFeeBps);
        uint256 fee = (job.reward * adjustedFeeBps) / 10000;
        uint256 payout = job.reward - fee;

        // External calls (reputation + payment) AFTER state update
        reputationEngine.updateReputation(job.worker, skillId, score);

        (bool ok, ) = job.worker.call{value: payout}("");
        require(ok, "payout failed");

        emit BuyerRatedWorker(jobId, msg.sender, job.worker, score);
    }

    /// @notice Worker rates the buyer (1-5) — mutual review (Airbnb model)
    function workerRateBuyer(uint256 jobId, uint8 score) external {
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.Completed || job.status == JobStatus.Rated, "job not completed");
        require(job.worker == msg.sender, "only worker can rate buyer");
        require(job.workerRating == 0, "already rated");
        require(score >= 1 && score <= 5, "score must be 1-5");

        job.workerRating = score;

        // Update buyer reputation (skillId 0 = general buyer reputation)
        reputationEngine.updateReputation(job.buyer, 0, score);

        emit WorkerRatedBuyer(jobId, msg.sender, job.buyer, score);
    }

    /// @notice Buyer can cancel an open (unaccepted) job and get refund
    function cancelJob(uint256 jobId) external {
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.Open, "can only cancel open jobs");
        require(job.buyer == msg.sender, "only buyer can cancel");

        job.status = JobStatus.Cancelled;
        _removeFromOpenJobs(jobId);

        (bool ok, ) = msg.sender.call{value: job.reward}("");
        require(ok, "refund failed");

        emit JobCancelled(jobId, msg.sender);
    }

    /// @notice Get all open job IDs
    function getOpenJobs() external view returns (uint256[] memory) {
        return _openJobIds;
    }

    /// @notice Get job details
    function getJob(uint256 jobId) external view returns (
        address buyer,
        address worker,
        string memory description,
        uint256 reward,
        uint256 preferredSkillId,
        JobStatus status,
        uint8 buyerRating,
        uint8 workerRating,
        uint256 createdAt
    ) {
        Job storage j = jobs[jobId];
        return (j.buyer, j.worker, j.description, j.reward, j.preferredSkillId, j.status, j.buyerRating, j.workerRating, j.createdAt);
    }

    /// @notice Withdraw accumulated fees (onlyOwner)
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "nothing to withdraw");
        (bool ok, ) = owner.call{value: balance}("");
        require(ok, "withdraw failed");
        emit Withdrawn(owner, balance);
    }

    // --- Internal ---

    function _removeFromOpenJobs(uint256 jobId) private {
        uint256 idx = _openJobIndex[jobId];
        uint256 lastIdx = _openJobIds.length - 1;
        if (idx != lastIdx) {
            uint256 lastJobId = _openJobIds[lastIdx];
            _openJobIds[idx] = lastJobId;
            _openJobIndex[lastJobId] = idx;
        }
        _openJobIds.pop();
        delete _openJobIndex[jobId];
    }
}
