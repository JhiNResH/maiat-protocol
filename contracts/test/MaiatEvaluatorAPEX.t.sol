// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {MaiatEvaluatorAPEX, ITrustScoreOracle, IERC8183} from "../src/acp/MaiatEvaluatorAPEX.sol";

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
                    MOCK: ERC-8183 (BNB APEX)
//////////////////////////////////////////////////////////////*/

contract MockERC8183 is IERC8183 {
    mapping(uint256 => Job) public jobs;
    uint256 public nextId = 1;

    function createMockJob(
        address client,
        address provider,
        address evaluator,
        uint256 budget
    ) external returns (uint256) {
        uint256 id = nextId++;
        jobs[id] = Job({
            client: client,
            provider: provider,
            evaluator: evaluator,
            hook: address(0),
            budget: budget,
            expiredAt: block.timestamp + 7 days,
            status: Status.Submitted,
            deliverable: keccak256("test-deliverable"),
            description: "Test job"
        });
        return id;
    }

    function setJobStatus(uint256 jobId, Status status) external {
        jobs[jobId].status = status;
    }

    function getJob(uint256 jobId) external view returns (Job memory) {
        return jobs[jobId];
    }

    function complete(uint256 jobId, bytes32, bytes calldata) external {
        jobs[jobId].status = Status.Completed;
    }

    function reject(uint256 jobId, bytes32, bytes calldata) external {
        jobs[jobId].status = Status.Rejected;
    }
}

/*//////////////////////////////////////////////////////////////
                    TEST SUITE
//////////////////////////////////////////////////////////////*/

contract MaiatEvaluatorAPEXTest is Test {
    MaiatEvaluatorAPEX public evaluator;
    MockOracle public oracle;
    MockERC8183 public erc8183;

    address public owner = address(this);
    address public client = address(0xC1);
    address public provider = address(0xBEEF);

    uint256 public constant DEFAULT_THRESHOLD = 30;
    uint256 public constant DEFAULT_THREAT_THRESHOLD = 3;

    function setUp() public {
        oracle = new MockOracle();
        erc8183 = new MockERC8183();
        evaluator = new MaiatEvaluatorAPEX(
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
        vm.expectRevert(abi.encodeWithSignature("MaiatEvaluatorAPEX__ZeroAddress()"));
        new MaiatEvaluatorAPEX(address(0), 30, 3, owner);
    }

    function test_constructor_revertsThresholdTooHigh() public {
        vm.expectRevert(abi.encodeWithSignature("MaiatEvaluatorAPEX__ThresholdOutOfRange(uint256)", 101));
        new MaiatEvaluatorAPEX(address(oracle), 101, 3, owner);
    }

    function test_constructor_revertsZeroThreatThreshold() public {
        vm.expectRevert(abi.encodeWithSignature("MaiatEvaluatorAPEX__ThreatThresholdCannotBeZero()"));
        new MaiatEvaluatorAPEX(address(oracle), 30, 0, owner);
    }

    /*//////////////////////////////////////////////////////////////
                    EVALUATE: COMPLETE PATH
    //////////////////////////////////////////////////////////////*/

    function test_evaluate_completesAboveThreshold() public {
        oracle.setUserData(provider, 50, true);
        uint256 jobId = erc8183.createMockJob(client, provider, address(evaluator), 0.02 ether);

        evaluator.evaluate(address(erc8183), jobId);

        assertEq(uint8(erc8183.getJob(jobId).status), uint8(IERC8183.Status.Completed));
    }

    function test_evaluate_completesAtExactThreshold() public {
        oracle.setUserData(provider, DEFAULT_THRESHOLD, true);
        uint256 jobId = erc8183.createMockJob(client, provider, address(evaluator), 0.02 ether);

        evaluator.evaluate(address(erc8183), jobId);

        assertEq(uint8(erc8183.getJob(jobId).status), uint8(IERC8183.Status.Completed));
    }

    /*//////////////////////////////////////////////////////////////
                    EVALUATE: REJECT PATH
    //////////////////////////////////////////////////////////////*/

    function test_evaluate_rejectsBelowThreshold() public {
        oracle.setUserData(provider, DEFAULT_THRESHOLD - 1, true);
        uint256 jobId = erc8183.createMockJob(client, provider, address(evaluator), 0.02 ether);

        evaluator.evaluate(address(erc8183), jobId);

        assertEq(uint8(erc8183.getJob(jobId).status), uint8(IERC8183.Status.Rejected));
    }

    function test_evaluate_rejectsUninitialized() public {
        // Don't set oracle data — provider is uninitialized
        uint256 jobId = erc8183.createMockJob(client, provider, address(evaluator), 0.02 ether);

        evaluator.evaluate(address(erc8183), jobId);

        assertEq(uint8(erc8183.getJob(jobId).status), uint8(IERC8183.Status.Rejected));
    }

    function test_evaluate_rejectsFlaggedProvider() public {
        oracle.setUserData(provider, 100, true);
        uint256 jobId = erc8183.createMockJob(client, provider, address(evaluator), 0.02 ether);

        // Report enough threats
        for (uint256 i = 0; i < DEFAULT_THREAT_THRESHOLD; i++) {
            evaluator.reportThreat(provider);
        }

        evaluator.evaluate(address(erc8183), jobId);

        assertEq(uint8(erc8183.getJob(jobId).status), uint8(IERC8183.Status.Rejected));
    }

    /*//////////////////////////////////////////////////////////////
                    EVALUATE: REVERTS
    //////////////////////////////////////////////////////////////*/

    function test_evaluate_revertsNotSubmitted() public {
        oracle.setUserData(provider, 50, true);
        uint256 jobId = erc8183.createMockJob(client, provider, address(evaluator), 0.02 ether);
        erc8183.setJobStatus(jobId, IERC8183.Status.Funded);

        vm.expectRevert(
            abi.encodeWithSignature("MaiatEvaluatorAPEX__JobNotSubmitted(uint256,uint8)", jobId, 1)
        );
        evaluator.evaluate(address(erc8183), jobId);
    }

    function test_evaluate_revertsNotEvaluator() public {
        oracle.setUserData(provider, 50, true);
        uint256 jobId = erc8183.createMockJob(client, provider, address(0xDEAD), 0.02 ether);

        vm.expectRevert(
            abi.encodeWithSignature(
                "MaiatEvaluatorAPEX__NotJobEvaluator(uint256,address,address)",
                jobId, address(evaluator), address(0xDEAD)
            )
        );
        evaluator.evaluate(address(erc8183), jobId);
    }

    function test_evaluate_revertsZeroAddress() public {
        vm.expectRevert(abi.encodeWithSignature("MaiatEvaluatorAPEX__ZeroAddress()"));
        evaluator.evaluate(address(0), 1);
    }

    function test_evaluate_revertsDoubleEvaluation() public {
        oracle.setUserData(provider, 50, true);
        uint256 jobId = erc8183.createMockJob(client, provider, address(evaluator), 0.02 ether);
        evaluator.evaluate(address(erc8183), jobId);

        vm.expectRevert(abi.encodeWithSignature("MaiatEvaluatorAPEX__AlreadyEvaluated(uint256)", jobId));
        evaluator.evaluate(address(erc8183), jobId);
    }

    /*//////////////////////////////////////////////////////////////
                    CALLER RESTRICTION
    //////////////////////////////////////////////////////////////*/

    function test_callerRestriction_blocksUnauthorized() public {
        oracle.setUserData(provider, 50, true);
        uint256 jobId = erc8183.createMockJob(client, provider, address(evaluator), 0.02 ether);

        evaluator.setCallerRestriction(true);

        vm.prank(address(0xCAFE));
        vm.expectRevert(
            abi.encodeWithSignature("MaiatEvaluatorAPEX__CallerNotAllowed(address)", address(0xCAFE))
        );
        evaluator.evaluate(address(erc8183), jobId);
    }

    function test_callerRestriction_allowsWhitelisted() public {
        oracle.setUserData(provider, 50, true);
        uint256 jobId = erc8183.createMockJob(client, provider, address(evaluator), 0.02 ether);

        evaluator.setCallerRestriction(true);
        evaluator.setAllowedCaller(address(0xCAFE), true);

        vm.prank(address(0xCAFE));
        evaluator.evaluate(address(erc8183), jobId);
        assertEq(uint8(erc8183.getJob(jobId).status), uint8(IERC8183.Status.Completed));
    }

    /*//////////////////////////////////////////////////////////////
                    JOB CONTRACT RESTRICTION
    //////////////////////////////////////////////////////////////*/

    function test_jobContractRestriction_blocksFake() public {
        oracle.setUserData(provider, 50, true);
        uint256 jobId = erc8183.createMockJob(client, provider, address(evaluator), 0.02 ether);

        evaluator.setJobContractRestriction(true);

        vm.expectRevert(
            abi.encodeWithSignature("MaiatEvaluatorAPEX__JobContractNotAllowed(address)", address(erc8183))
        );
        evaluator.evaluate(address(erc8183), jobId);
    }

    function test_jobContractRestriction_allowsWhitelisted() public {
        oracle.setUserData(provider, 50, true);
        uint256 jobId = erc8183.createMockJob(client, provider, address(evaluator), 0.02 ether);

        evaluator.setJobContractRestriction(true);
        evaluator.setAllowedJobContract(address(erc8183), true);

        evaluator.evaluate(address(erc8183), jobId);
        assertEq(uint8(erc8183.getJob(jobId).status), uint8(IERC8183.Status.Completed));
    }

    /*//////////////////////////////////////////////////////////////
                    THREAT THRESHOLD
    //////////////////////////////////////////////////////////////*/

    function test_setThreatThreshold_revertsOnZero() public {
        vm.expectRevert(abi.encodeWithSignature("MaiatEvaluatorAPEX__ThreatThresholdCannotBeZero()"));
        evaluator.setThreatThreshold(0);
    }

    /*//////////////////////////////////////////////////////////////
                    STATS
    //////////////////////////////////////////////////////////////*/

    function test_stats_trackCorrectly() public {
        // Complete one
        oracle.setUserData(provider, 50, true);
        uint256 job1 = erc8183.createMockJob(client, provider, address(evaluator), 0.02 ether);
        evaluator.evaluate(address(erc8183), job1);

        // Reject one
        address badProvider = address(0xBAD2);
        oracle.setUserData(badProvider, 5, true);
        uint256 job2 = erc8183.createMockJob(client, badProvider, address(evaluator), 0.02 ether);
        evaluator.evaluate(address(erc8183), job2);

        assertEq(evaluator.totalEvaluations(), 2);
        assertEq(evaluator.totalCompleted(), 1);
        assertEq(evaluator.totalRejected(), 1);
    }
}
