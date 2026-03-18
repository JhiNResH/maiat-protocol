// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {MaiatEvaluator, ITrustScoreOracle, IAgenticCommerce} from "../src/MaiatEvaluator.sol";

/*//////////////////////////////////////////////////////////////
                    MOCK: TrustScoreOracle
//////////////////////////////////////////////////////////////*/

contract MockOracle is ITrustScoreOracle {
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

/*//////////////////////////////////////////////////////////////
                    MOCK: AgenticCommerce (ERC-8183)
//////////////////////////////////////////////////////////////*/

contract MockACP is IAgenticCommerce {
    mapping(uint256 => Job) public jobs;
    uint256 public nextJobId;

    // Track calls for assertions
    uint256 public lastCompletedJobId;
    bytes32 public lastCompleteReason;
    uint256 public lastRejectedJobId;
    bytes32 public lastRejectReason;

    function createMockJob(
        address client,
        address provider,
        address evaluator,
        uint256 budget
    ) external returns (uint256 jobId) {
        jobId = nextJobId++;
        jobs[jobId] = Job({ id: jobId,
            client: client,
            provider: provider,
            evaluator: evaluator,
            description: "test job",
            budget: budget,
            expiredAt: block.timestamp + 7 days,
            status: JobStatus.Submitted,
            hook: address(0)
        });
    }

    function setJobStatus(uint256 jobId, JobStatus status) external {
        jobs[jobId].status = status;
    }

    function getJob(uint256 jobId) external view returns (Job memory) {
        return jobs[jobId];
    }

    function complete(uint256 jobId, bytes32 reason, bytes calldata) external {
        jobs[jobId].status = JobStatus.Completed;
        lastCompletedJobId = jobId;
        lastCompleteReason = reason;
    }

    function reject(uint256 jobId, bytes32 reason, bytes calldata) external {
        jobs[jobId].status = JobStatus.Rejected;
        lastRejectedJobId = jobId;
        lastRejectReason = reason;
    }
}

/*//////////////////////////////////////////////////////////////
                    TEST CONTRACT
//////////////////////////////////////////////////////////////*/

contract MaiatEvaluatorTest is Test {
    MaiatEvaluator public evaluator;
    MockOracle public oracle;
    MockACP public acp;

    address public owner = address(this);
    address public client = address(0xC11E);
    address public provider = address(0xA10);
    address public attacker = address(0xBAD);

    uint256 public constant DEFAULT_THRESHOLD = 30;
    uint256 public constant DEFAULT_THREAT_THRESHOLD = 3;

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

    function setUp() public {
        oracle = new MockOracle();
        acp = new MockACP();
        evaluator = new MaiatEvaluator(
            address(oracle),
            DEFAULT_THRESHOLD,
            DEFAULT_THREAT_THRESHOLD,
            owner
        );
    }

    /*//////////////////////////////////////////////////////////////
                    CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    function test_constructor_setsValues() public view {
        assertEq(address(evaluator.oracle()), address(oracle));
        assertEq(evaluator.threshold(), DEFAULT_THRESHOLD);
        assertEq(evaluator.threatThreshold(), DEFAULT_THREAT_THRESHOLD);
        assertEq(evaluator.owner(), owner);
    }

    function test_constructor_revertsZeroOracle() public {
        vm.expectRevert(abi.encodeWithSignature("MaiatEvaluator__ZeroAddress()"));
        new MaiatEvaluator(address(0), 30, 3, owner);
    }

    function test_constructor_revertsThresholdTooHigh() public {
        vm.expectRevert(abi.encodeWithSignature("MaiatEvaluator__ThresholdOutOfRange(uint256)", 101));
        new MaiatEvaluator(address(oracle), 101, 3, owner);
    }

    /*//////////////////////////////////////////////////////////////
                    EVALUATE: COMPLETE PATH
    //////////////////////////////////////////////////////////////*/

    function test_evaluate_completesWhenScoreAboveThreshold() public {
        oracle.setUserData(provider, 50, true);
        uint256 jobId = acp.createMockJob(client, provider, address(evaluator), 0.02 ether);

        vm.expectEmit(true, true, true, true);
        emit EvaluationResult(address(acp), jobId, provider, 50, true, bytes32(uint256(50)));

        evaluator.evaluate(address(acp), jobId);

        assertEq(uint8(acp.getJob(jobId).status), uint8(IAgenticCommerce.JobStatus.Completed));
        assertEq(acp.lastCompletedJobId(), jobId);
        assertEq(evaluator.totalEvaluations(), 1);
        assertEq(evaluator.totalCompleted(), 1);
        assertEq(evaluator.totalRejected(), 0);
    }

    function test_evaluate_completesAtExactThreshold() public {
        oracle.setUserData(provider, DEFAULT_THRESHOLD, true);
        uint256 jobId = acp.createMockJob(client, provider, address(evaluator), 0.02 ether);

        evaluator.evaluate(address(acp), jobId);

        assertEq(uint8(acp.getJob(jobId).status), uint8(IAgenticCommerce.JobStatus.Completed));
    }

    function test_evaluate_completesWithMaxScore() public {
        oracle.setUserData(provider, 200, true); // reputationScore can exceed 100
        uint256 jobId = acp.createMockJob(client, provider, address(evaluator), 0.02 ether);

        evaluator.evaluate(address(acp), jobId);

        // Score capped at 100 in event
        assertEq(uint8(acp.getJob(jobId).status), uint8(IAgenticCommerce.JobStatus.Completed));
    }

    /*//////////////////////////////////////////////////////////////
                    EVALUATE: REJECT PATH
    //////////////////////////////////////////////////////////////*/

    function test_evaluate_rejectsWhenScoreBelowThreshold() public {
        oracle.setUserData(provider, 10, true);
        uint256 jobId = acp.createMockJob(client, provider, address(evaluator), 0.02 ether);

        evaluator.evaluate(address(acp), jobId);

        assertEq(uint8(acp.getJob(jobId).status), uint8(IAgenticCommerce.JobStatus.Rejected));
        assertEq(acp.lastRejectReason(), evaluator.REASON_LOW_TRUST());
        assertEq(evaluator.totalRejected(), 1);
    }

    function test_evaluate_rejectsUninitializedProvider() public {
        // Don't set oracle data → uninitialized
        uint256 jobId = acp.createMockJob(client, provider, address(evaluator), 0.02 ether);

        evaluator.evaluate(address(acp), jobId);

        assertEq(uint8(acp.getJob(jobId).status), uint8(IAgenticCommerce.JobStatus.Rejected));
        assertEq(acp.lastRejectReason(), evaluator.REASON_UNINITIALIZED());
    }

    function test_evaluate_rejectsScoreZero() public {
        oracle.setUserData(provider, 0, true);
        uint256 jobId = acp.createMockJob(client, provider, address(evaluator), 0.02 ether);

        evaluator.evaluate(address(acp), jobId);

        assertEq(uint8(acp.getJob(jobId).status), uint8(IAgenticCommerce.JobStatus.Rejected));
        assertEq(acp.lastRejectReason(), evaluator.REASON_LOW_TRUST());
    }

    /*//////////////////////////////////////////////////////////////
                    EVALUATE: THREAT PATH
    //////////////////////////////////////////////////////////////*/

    function test_evaluate_rejectsFlaggedAgent() public {
        oracle.setUserData(provider, 90, true); // High score but flagged
        uint256 jobId = acp.createMockJob(client, provider, address(evaluator), 0.02 ether);

        // Report 3 threats
        evaluator.reportThreat(provider);
        evaluator.reportThreat(provider);
        evaluator.reportThreat(provider);

        evaluator.evaluate(address(acp), jobId);

        assertEq(uint8(acp.getJob(jobId).status), uint8(IAgenticCommerce.JobStatus.Rejected));
        assertEq(acp.lastRejectReason(), evaluator.REASON_FLAGGED());
    }

    function test_evaluate_passesWithThreatsUnderThreshold() public {
        oracle.setUserData(provider, 50, true);
        uint256 jobId = acp.createMockJob(client, provider, address(evaluator), 0.02 ether);

        // Only 2 threats (threshold is 3)
        evaluator.reportThreat(provider);
        evaluator.reportThreat(provider);

        evaluator.evaluate(address(acp), jobId);

        assertEq(uint8(acp.getJob(jobId).status), uint8(IAgenticCommerce.JobStatus.Completed));
    }

    function test_evaluate_threatThresholdZeroDisablesCheck() public {
        evaluator.setThreatThreshold(0);
        oracle.setUserData(provider, 50, true);
        uint256 jobId = acp.createMockJob(client, provider, address(evaluator), 0.02 ether);

        // Even with 100 threats, threatThreshold=0 disables the check
        for (uint256 i = 0; i < 5; i++) evaluator.reportThreat(provider);

        evaluator.evaluate(address(acp), jobId);

        assertEq(uint8(acp.getJob(jobId).status), uint8(IAgenticCommerce.JobStatus.Completed));
    }

    /*//////////////////////////////////////////////////////////////
                    EVALUATE: REVERTS
    //////////////////////////////////////////////////////////////*/

    function test_evaluate_revertsNotSubmitted() public {
        oracle.setUserData(provider, 50, true);
        uint256 jobId = acp.createMockJob(client, provider, address(evaluator), 0.02 ether);
        acp.setJobStatus(jobId, IAgenticCommerce.JobStatus.Funded);

        vm.expectRevert(
            abi.encodeWithSignature("MaiatEvaluator__JobNotSubmitted(uint256,uint8)", jobId, 1)
        );
        evaluator.evaluate(address(acp), jobId);
    }

    function test_evaluate_revertsNotEvaluator() public {
        oracle.setUserData(provider, 50, true);
        // Create job with different evaluator
        uint256 jobId = acp.createMockJob(client, provider, address(0xDEAD), 0.02 ether);

        vm.expectRevert(
            abi.encodeWithSignature(
                "MaiatEvaluator__NotJobEvaluator(uint256,address,address)",
                jobId,
                address(evaluator),
                address(0xDEAD)
            )
        );
        evaluator.evaluate(address(acp), jobId);
    }

    function test_evaluate_revertsZeroACP() public {
        vm.expectRevert(abi.encodeWithSignature("MaiatEvaluator__ZeroAddress()"));
        evaluator.evaluate(address(0), 0);
    }

    function test_evaluate_revertsDoubleEvaluation() public {
        oracle.setUserData(provider, 50, true);
        uint256 jobId = acp.createMockJob(client, provider, address(evaluator), 0.02 ether);

        evaluator.evaluate(address(acp), jobId);

        vm.expectRevert(abi.encodeWithSignature("MaiatEvaluator__AlreadyEvaluated(uint256)", jobId));
        evaluator.evaluate(address(acp), jobId);
    }

    /*//////////////////////////////////////////////////////////////
                    PRE-CHECK
    //////////////////////////////////////////////////////////////*/

    function test_preCheck_returnsCorrectly() public {
        oracle.setUserData(provider, 50, true);

        (uint256 score, bool wouldPass) = evaluator.preCheck(provider);
        assertEq(score, 50);
        assertTrue(wouldPass);
    }

    function test_preCheck_failsUninitialized() public view {
        (uint256 score, bool wouldPass) = evaluator.preCheck(provider);
        assertEq(score, 0);
        assertFalse(wouldPass);
    }

    function test_preCheck_failsBelowThreshold() public {
        oracle.setUserData(provider, 10, true);

        (uint256 score, bool wouldPass) = evaluator.preCheck(provider);
        assertEq(score, 10);
        assertFalse(wouldPass);
    }

    function test_preCheck_failsWhenFlagged() public {
        oracle.setUserData(provider, 90, true);
        evaluator.reportThreat(provider);
        evaluator.reportThreat(provider);
        evaluator.reportThreat(provider);

        (uint256 score, bool wouldPass) = evaluator.preCheck(provider);
        assertEq(score, 90);
        assertFalse(wouldPass); // Flagged overrides score
    }

    function test_preCheck_capsScoreAt100() public {
        oracle.setUserData(provider, 200, true);

        (uint256 score, bool wouldPass) = evaluator.preCheck(provider);
        assertEq(score, 100); // Capped
        assertTrue(wouldPass);
    }

    /*//////////////////////////////////////////////////////////////
                    ADMIN: setThreshold
    //////////////////////////////////////////////////////////////*/

    function test_setThreshold_works() public {
        vm.expectEmit(false, false, false, true);
        emit ThresholdUpdated(DEFAULT_THRESHOLD, 50);

        evaluator.setThreshold(50);
        assertEq(evaluator.threshold(), 50);
    }

    function test_setThreshold_revertsNonOwner() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", attacker));
        evaluator.setThreshold(50);
    }

    function test_setThreshold_revertsOutOfRange() public {
        vm.expectRevert(abi.encodeWithSignature("MaiatEvaluator__ThresholdOutOfRange(uint256)", 101));
        evaluator.setThreshold(101);
    }

    function test_setThreshold_allowsZero() public {
        evaluator.setThreshold(0);
        assertEq(evaluator.threshold(), 0);
    }

    function test_setThreshold_allows100() public {
        evaluator.setThreshold(100);
        assertEq(evaluator.threshold(), 100);
    }

    /*//////////////////////////////////////////////////////////////
                    ADMIN: setThreatThreshold
    //////////////////////////////////////////////////////////////*/

    function test_setThreatThreshold_works() public {
        vm.expectEmit(false, false, false, true);
        emit ThreatThresholdUpdated(DEFAULT_THREAT_THRESHOLD, 5);

        evaluator.setThreatThreshold(5);
        assertEq(evaluator.threatThreshold(), 5);
    }

    function test_setThreatThreshold_revertsNonOwner() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", attacker));
        evaluator.setThreatThreshold(5);
    }

    /*//////////////////////////////////////////////////////////////
                    ADMIN: setOracle
    //////////////////////////////////////////////////////////////*/

    function test_setOracle_works() public {
        address newOracle = address(0x999);
        vm.expectEmit(false, false, false, true);
        emit OracleUpdated(address(oracle), newOracle);

        evaluator.setOracle(newOracle);
        assertEq(address(evaluator.oracle()), newOracle);
    }

    function test_setOracle_revertsZero() public {
        vm.expectRevert(abi.encodeWithSignature("MaiatEvaluator__ZeroAddress()"));
        evaluator.setOracle(address(0));
    }

    function test_setOracle_revertsNonOwner() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", attacker));
        evaluator.setOracle(address(0x999));
    }

    /*//////////////////////////////////////////////////////////////
                    ADMIN: THREATS
    //////////////////////////////////////////////////////////////*/

    function test_reportThreat_increments() public {
        evaluator.reportThreat(provider);
        assertEq(evaluator.threatReports(provider), 1);

        evaluator.reportThreat(provider);
        assertEq(evaluator.threatReports(provider), 2);
    }

    function test_reportThreat_revertsNonOwner() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", attacker));
        evaluator.reportThreat(provider);
    }

    function test_reportThreat_revertsZeroAddress() public {
        vm.expectRevert(abi.encodeWithSignature("MaiatEvaluator__ZeroAddress()"));
        evaluator.reportThreat(address(0));
    }

    function test_reportThreats_batch() public {
        address[] memory providers = new address[](3);
        providers[0] = address(0x111);
        providers[1] = address(0x222);
        providers[2] = address(0x333);

        evaluator.reportThreats(providers);

        assertEq(evaluator.threatReports(address(0x111)), 1);
        assertEq(evaluator.threatReports(address(0x222)), 1);
        assertEq(evaluator.threatReports(address(0x333)), 1);
    }

    function test_clearThreats_works() public {
        evaluator.reportThreat(provider);
        evaluator.reportThreat(provider);
        evaluator.reportThreat(provider);
        assertEq(evaluator.threatReports(provider), 3);

        evaluator.clearThreats(provider);
        assertEq(evaluator.threatReports(provider), 0);
    }

    /*//////////////////////////////////////////////////////////////
                    STATS
    //////////////////////////////////////////////////////////////*/

    function test_stats_trackCorrectly() public {
        // Complete one
        oracle.setUserData(provider, 50, true);
        uint256 job1 = acp.createMockJob(client, provider, address(evaluator), 0.02 ether);
        evaluator.evaluate(address(acp), job1);

        // Reject one
        address badProvider = address(0xBAD2);
        oracle.setUserData(badProvider, 5, true);
        uint256 job2 = acp.createMockJob(client, badProvider, address(evaluator), 0.02 ether);
        evaluator.evaluate(address(acp), job2);

        assertEq(evaluator.totalEvaluations(), 2);
        assertEq(evaluator.totalCompleted(), 1);
        assertEq(evaluator.totalRejected(), 1);
    }
}
