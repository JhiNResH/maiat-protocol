// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {MaiatEvaluator, ITrustScoreOracle, IAgenticCommerce} from "../src/acp/MaiatEvaluator.sol";

/*//////////////////////////////////////////////////////////////
                    MOCK CONTRACTS (same as unit tests)
//////////////////////////////////////////////////////////////*/

contract FuzzMockOracle is ITrustScoreOracle {
    mapping(address => UserReputation) public reps;

    function setUserData(address user, uint256 score, bool initialized) external {
        reps[user] = UserReputation({
            reputationScore: score,
            totalReviews: 1,
            scarabPoints: 0,
            feeBps: 50,
            initialized: initialized,
            lastUpdated: block.timestamp
        });
    }

    function getUserData(address user) external view returns (UserReputation memory) {
        return reps[user];
    }
}

contract FuzzMockACP is IAgenticCommerce {
    mapping(uint256 => Job) public jobs;
    uint256 public nextJobId;
    uint256 public completedCount;
    uint256 public rejectedCount;

    function createMockJob(address client, address provider, address evaluator) external returns (uint256 jobId) {
        jobId = nextJobId++;
        jobs[jobId] = Job({ id: jobId,
            client: client,
            provider: provider,
            evaluator: evaluator,
            description: "fuzz",
            budget: 0.02 ether,
            expiredAt: block.timestamp + 7 days,
            status: JobStatus.Submitted,
            hook: address(0)
        });
    }

    function getJob(uint256 jobId) external view returns (Job memory) {
        return jobs[jobId];
    }

    function complete(uint256 jobId, bytes32, bytes calldata) external {
        jobs[jobId].status = JobStatus.Completed;
        completedCount++;
    }

    function reject(uint256 jobId, bytes32, bytes calldata) external {
        jobs[jobId].status = JobStatus.Rejected;
        rejectedCount++;
    }
}

/*//////////////////////////////////////////////////////////////
                    FUZZ TESTS
//////////////////////////////////////////////////////////////*/

contract MaiatEvaluatorFuzzTest is Test {
    MaiatEvaluator public evaluator;
    FuzzMockOracle public oracle;
    FuzzMockACP public acp;

    address public owner = address(this);
    address public client = address(0xC11E);

    function setUp() public {
        oracle = new FuzzMockOracle();
        acp = new FuzzMockACP();
        evaluator = new MaiatEvaluator(address(oracle), 30, 3, owner);
    }

    /// @notice Fuzz: threshold boundary — if score >= threshold → complete, else reject
    function testFuzz_evaluate_thresholdBoundary(uint256 score, uint256 threshold) public {
        // Bound inputs
        score = bound(score, 0, 200);
        threshold = bound(threshold, 0, 100);

        evaluator.setThreshold(threshold);

        address provider = address(uint160(uint256(keccak256(abi.encode(score, threshold)))));
        oracle.setUserData(provider, score, true);

        uint256 jobId = acp.createMockJob(client, provider, address(evaluator));
        evaluator.evaluate(address(acp), jobId);

        uint256 cappedScore = score > 100 ? 100 : score;

        if (cappedScore >= threshold) {
            assertEq(
                uint8(acp.getJob(jobId).status),
                uint8(IAgenticCommerce.JobStatus.Completed),
                "Should complete when score >= threshold"
            );
        } else {
            assertEq(
                uint8(acp.getJob(jobId).status),
                uint8(IAgenticCommerce.JobStatus.Rejected),
                "Should reject when score < threshold"
            );
        }
    }

    /// @notice Fuzz: threat count vs threshold — flagged always rejects
    function testFuzz_evaluate_threatOverride(uint256 threats, uint256 threatThreshold) public {
        threats = bound(threats, 0, 20);
        threatThreshold = bound(threatThreshold, 1, 10); // >0 to enable check

        evaluator.setThreatThreshold(threatThreshold);

        address provider = address(uint160(uint256(keccak256(abi.encode(threats, threatThreshold)))));
        oracle.setUserData(provider, 99, true); // High score

        // Report threats
        for (uint256 i = 0; i < threats; i++) {
            evaluator.reportThreat(provider);
        }

        uint256 jobId = acp.createMockJob(client, provider, address(evaluator));
        evaluator.evaluate(address(acp), jobId);

        if (threats >= threatThreshold) {
            assertEq(
                uint8(acp.getJob(jobId).status),
                uint8(IAgenticCommerce.JobStatus.Rejected),
                "Should reject when threats >= threatThreshold"
            );
        } else {
            assertEq(
                uint8(acp.getJob(jobId).status),
                uint8(IAgenticCommerce.JobStatus.Completed),
                "Should complete when threats < threatThreshold and score is high"
            );
        }
    }

    /// @notice Fuzz: setThreshold only accepts 0-100
    function testFuzz_setThreshold_range(uint256 value) public {
        if (value > 100) {
            vm.expectRevert(
                abi.encodeWithSignature("MaiatEvaluator__ThresholdOutOfRange(uint256)", value)
            );
            evaluator.setThreshold(value);
        } else {
            evaluator.setThreshold(value);
            assertEq(evaluator.threshold(), value);
        }
    }

    /// @notice Fuzz: preCheck consistency with evaluate
    function testFuzz_preCheck_matchesEvaluate(uint256 score, uint256 threshold) public {
        score = bound(score, 0, 200);
        threshold = bound(threshold, 0, 100);

        evaluator.setThreshold(threshold);

        address provider = address(uint160(uint256(keccak256(abi.encode(score, threshold, "precheck")))));
        oracle.setUserData(provider, score, true);

        // Pre-check
        (, bool wouldPass) = evaluator.preCheck(provider);

        // Evaluate
        uint256 jobId = acp.createMockJob(client, provider, address(evaluator));
        evaluator.evaluate(address(acp), jobId);

        bool didComplete = acp.getJob(jobId).status == IAgenticCommerce.JobStatus.Completed;

        assertEq(wouldPass, didComplete, "preCheck must match evaluate outcome");
    }

    /// @notice Fuzz: multiple evaluations increment stats correctly
    function testFuzz_stats_accumulate(uint8 numJobs) public {
        numJobs = uint8(bound(numJobs, 1, 50));

        uint256 expectedComplete;
        uint256 expectedReject;

        for (uint256 i = 0; i < numJobs; i++) {
            address provider = address(uint160(uint256(keccak256(abi.encode(i)))));
            uint256 score = i % 2 == 0 ? 50 : 10; // Alternate pass/fail
            oracle.setUserData(provider, score, true);

            uint256 jobId = acp.createMockJob(client, provider, address(evaluator));
            evaluator.evaluate(address(acp), jobId);

            if (score >= evaluator.threshold()) {
                expectedComplete++;
            } else {
                expectedReject++;
            }
        }

        assertEq(evaluator.totalEvaluations(), numJobs);
        assertEq(evaluator.totalCompleted(), expectedComplete);
        assertEq(evaluator.totalRejected(), expectedReject);
    }
}
