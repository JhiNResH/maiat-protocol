// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {SkillRegistry} from "../src/xlayer/SkillRegistry.sol";
import {ReputationEngine} from "../src/xlayer/ReputationEngine.sol";
import {JobMarket} from "../src/xlayer/JobMarket.sol";

/**
 * @title XLayerTest
 * @notice Integration tests for X Layer Skill Marketplace contracts
 */
contract XLayerTest is Test {
    SkillRegistry public skillRegistry;
    ReputationEngine public reputationEngine;
    JobMarket public jobMarket;

    address public deployer = address(this);
    address public skillCreator = makeAddr("skillCreator");
    address public worker = makeAddr("worker");
    address public buyer = makeAddr("buyer");

    uint256 public constant SKILL_PRICE = 0.1 ether;
    uint256 public constant JOB_REWARD = 1 ether;

    function setUp() public {
        // Deploy contracts
        skillRegistry = new SkillRegistry();
        reputationEngine = new ReputationEngine(address(0));
        jobMarket = new JobMarket(address(reputationEngine), address(skillRegistry));

        // Link ReputationEngine to JobMarket
        reputationEngine.setJobMarket(address(jobMarket));

        // Fund test accounts
        vm.deal(skillCreator, 10 ether);
        vm.deal(worker, 10 ether);
        vm.deal(buyer, 10 ether);
    }

    // ─── SkillRegistry Tests ──────────────────────────────────────────────────

    function test_CreateSkill() public {
        vm.startPrank(skillCreator);

        uint256 skillId = skillRegistry.createSkill(
            "Solidity Development",
            "Expert in Solidity smart contract development",
            SKILL_PRICE,
            "" // metadataURI
        );

        assertEq(skillId, 1);

        (
            address creator,
            string memory name,
            string memory description,
            uint256 price,
            uint16 royaltyBps,
            uint256 totalBuyers
        ) = skillRegistry.getSkill(skillId);

        assertEq(creator, skillCreator);
        assertEq(name, "Solidity Development");
        assertEq(description, "Expert in Solidity smart contract development");
        assertEq(price, SKILL_PRICE);
        assertEq(royaltyBps, 1000);
        assertEq(totalBuyers, 0);

        vm.stopPrank();
    }

    function test_BuySkill() public {
        // Create skill
        vm.prank(skillCreator);
        uint256 skillId = skillRegistry.createSkill(
            "Solidity Development",
            "Expert in Solidity smart contract development",
            SKILL_PRICE,
            "" // metadataURI
        );

        // Buy skill
        uint256 creatorBalanceBefore = skillCreator.balance;
        vm.prank(worker);
        skillRegistry.buySkill{value: SKILL_PRICE}(skillId);

        // Verify worker owns skill
        assertTrue(skillRegistry.hasSkill(worker, skillId));
        assertEq(skillRegistry.balanceOf(worker, skillId), 1);

        // Verify creator received royalty (10% of price)
        uint256 expectedRoyalty = (SKILL_PRICE * 1000) / 10000;
        assertEq(skillCreator.balance, creatorBalanceBefore + expectedRoyalty);

        // Verify skill buyer count updated
        (, , , , , uint256 totalBuyers) = skillRegistry.getSkill(skillId);
        assertEq(totalBuyers, 1);
    }

    function test_GetAgentSkills() public {
        // Create multiple skills
        vm.startPrank(skillCreator);
        uint256 skill1 = skillRegistry.createSkill("Skill 1", "Desc 1", SKILL_PRICE, "");
        uint256 skill2 = skillRegistry.createSkill("Skill 2", "Desc 2", SKILL_PRICE, "");
        vm.stopPrank();

        // Worker buys both skills
        vm.startPrank(worker);
        skillRegistry.buySkill{value: SKILL_PRICE}(skill1);
        skillRegistry.buySkill{value: SKILL_PRICE}(skill2);
        vm.stopPrank();

        // Verify agent skills
        uint256[] memory skills = skillRegistry.getAgentSkills(worker);
        assertEq(skills.length, 2);
        assertEq(skills[0], skill1);
        assertEq(skills[1], skill2);
    }

    function test_BuySkill_RevertAlreadyOwns() public {
        vm.prank(skillCreator);
        uint256 skillId = skillRegistry.createSkill("Skill", "Desc", SKILL_PRICE, "");

        vm.startPrank(worker);
        skillRegistry.buySkill{value: SKILL_PRICE}(skillId);

        vm.expectRevert(SkillRegistry.AlreadyOwnsSkill.selector);
        skillRegistry.buySkill{value: SKILL_PRICE}(skillId);
        vm.stopPrank();
    }

    // ─── JobMarket Tests ──────────────────────────────────────────────────────

    function test_PostJob() public {
        vm.prank(buyer);
        uint256 jobId = jobMarket.postJob{value: JOB_REWARD}(
            "Build a DeFi dashboard",
            JOB_REWARD,
            0 // No skill requirement
        );

        assertEq(jobId, 1);

        (
            address jobBuyer,
            address jobWorker,
            string memory description,
            uint256 reward,
            uint256 preferredSkillId,
            JobMarket.JobStatus status,
            uint8 rating
        ) = jobMarket.getJob(jobId);

        assertEq(jobBuyer, buyer);
        assertEq(jobWorker, address(0));
        assertEq(description, "Build a DeFi dashboard");
        assertEq(reward, JOB_REWARD);
        assertEq(preferredSkillId, 0);
        assertEq(uint256(status), uint256(JobMarket.JobStatus.Open));
        assertEq(rating, 0);
    }

    function test_AcceptJob() public {
        vm.prank(buyer);
        uint256 jobId = jobMarket.postJob{value: JOB_REWARD}(
            "Build a DeFi dashboard",
            JOB_REWARD,
            0
        );

        vm.prank(worker);
        jobMarket.acceptJob(jobId);

        (, address jobWorker, , , , JobMarket.JobStatus status, ) = jobMarket.getJob(jobId);
        assertEq(jobWorker, worker);
        assertEq(uint256(status), uint256(JobMarket.JobStatus.InProgress));

        // Verify removed from open jobs
        uint256[] memory openJobs = jobMarket.getOpenJobs();
        assertEq(openJobs.length, 0);
    }

    function test_AcceptJob_WithSkillRequirement() public {
        // Create and buy required skill
        vm.prank(skillCreator);
        uint256 skillId = skillRegistry.createSkill("Required Skill", "Desc", SKILL_PRICE, "");

        vm.prank(worker);
        skillRegistry.buySkill{value: SKILL_PRICE}(skillId);

        // Post job with skill requirement
        vm.prank(buyer);
        uint256 jobId = jobMarket.postJob{value: JOB_REWARD}(
            "Skilled work needed",
            JOB_REWARD,
            skillId
        );

        // Worker with skill can accept
        vm.prank(worker);
        jobMarket.acceptJob(jobId);

        (, address jobWorker, , , , , ) = jobMarket.getJob(jobId);
        assertEq(jobWorker, worker);
    }

    function test_AcceptJob_RevertMissingSkill() public {
        // Create required skill (but worker doesn't have it)
        vm.prank(skillCreator);
        uint256 skillId = skillRegistry.createSkill("Required Skill", "Desc", SKILL_PRICE, "");

        // Post job with skill requirement
        vm.prank(buyer);
        uint256 jobId = jobMarket.postJob{value: JOB_REWARD}(
            "Skilled work needed",
            JOB_REWARD,
            skillId
        );

        // Worker without skill cannot accept
        vm.prank(worker);
        vm.expectRevert(JobMarket.MissingPreferredSkill.selector);
        jobMarket.acceptJob(jobId);
    }

    function test_CompleteJob() public {
        vm.prank(buyer);
        uint256 jobId = jobMarket.postJob{value: JOB_REWARD}(
            "Build a DeFi dashboard",
            JOB_REWARD,
            0
        );

        vm.prank(worker);
        jobMarket.acceptJob(jobId);

        uint256 workerBalanceBefore = worker.balance;

        vm.prank(worker);
        jobMarket.completeJob(jobId);

        (, , , , , JobMarket.JobStatus status, ) = jobMarket.getJob(jobId);
        assertEq(uint256(status), uint256(JobMarket.JobStatus.Completed));

        // Verify worker received reward
        assertEq(worker.balance, workerBalanceBefore + JOB_REWARD);
    }

    function test_RateJob() public {
        vm.prank(buyer);
        uint256 jobId = jobMarket.postJob{value: JOB_REWARD}(
            "Build a DeFi dashboard",
            JOB_REWARD,
            0
        );

        vm.prank(worker);
        jobMarket.acceptJob(jobId);

        vm.prank(worker);
        jobMarket.completeJob(jobId);

        vm.prank(buyer);
        jobMarket.rateJob(jobId, 5); // Excellent rating

        (, , , , , JobMarket.JobStatus status, uint8 rating) = jobMarket.getJob(jobId);
        assertEq(uint256(status), uint256(JobMarket.JobStatus.Rated));
        assertEq(rating, 5);
    }

    // ─── ReputationEngine Tests ───────────────────────────────────────────────

    function test_ReputationUpdatesOnRating() public {
        // Complete full job flow
        vm.prank(buyer);
        uint256 jobId = jobMarket.postJob{value: JOB_REWARD}(
            "Build a DeFi dashboard",
            JOB_REWARD,
            0
        );

        vm.prank(worker);
        jobMarket.acceptJob(jobId);

        vm.prank(worker);
        jobMarket.completeJob(jobId);

        // Rate with 5 stars
        vm.prank(buyer);
        jobMarket.rateJob(jobId, 5);

        // Check reputation increased
        // Default is 50, rating 5 adds +1000 bps (adjustment = (5-3)*500 = 1000)
        // New rep = 5000 + 1000 = 6000 bps = 60/100
        uint256 rep = reputationEngine.getReputation(worker, 1); // skillId 1 is default
        assertEq(rep, 60);
    }

    function test_ReputationDecreasesOnBadRating() public {
        // First job with good rating to establish baseline
        vm.prank(buyer);
        uint256 jobId1 = jobMarket.postJob{value: JOB_REWARD}("Job 1", JOB_REWARD, 0);
        vm.prank(worker);
        jobMarket.acceptJob(jobId1);
        vm.prank(worker);
        jobMarket.completeJob(jobId1);
        vm.prank(buyer);
        jobMarket.rateJob(jobId1, 3); // Neutral rating

        uint256 repBefore = reputationEngine.getReputationBps(worker, 1);

        // Second job with bad rating
        vm.prank(buyer);
        uint256 jobId2 = jobMarket.postJob{value: JOB_REWARD}("Job 2", JOB_REWARD, 0);
        vm.prank(worker);
        jobMarket.acceptJob(jobId2);
        vm.prank(worker);
        jobMarket.completeJob(jobId2);
        vm.prank(buyer);
        jobMarket.rateJob(jobId2, 1); // Bad rating

        uint256 repAfter = reputationEngine.getReputationBps(worker, 1);
        assertTrue(repAfter < repBefore);
    }

    function test_GlobalReputationCalculation() public {
        // Complete multiple jobs with different ratings
        for (uint256 i = 0; i < 3; i++) {
            vm.prank(buyer);
            uint256 jobId = jobMarket.postJob{value: JOB_REWARD}("Job", JOB_REWARD, 0);
            vm.prank(worker);
            jobMarket.acceptJob(jobId);
            vm.prank(worker);
            jobMarket.completeJob(jobId);
            vm.prank(buyer);
            jobMarket.rateJob(jobId, 4); // Good ratings
        }

        uint256 globalRep = reputationEngine.getGlobalReputation(worker);
        // Average rating is 4, which maps to 75/100
        assertEq(globalRep, 75);
    }

    function test_FeeCalculation() public {
        // New worker with default reputation (50) should have base fee
        uint256 baseFee = 500; // 5%
        uint256 fee = reputationEngine.calculateFee(worker, baseFee);
        assertEq(fee, baseFee); // 50-69 range = 100% of base fee

        // Build up excellent reputation
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(buyer);
            uint256 jobId = jobMarket.postJob{value: JOB_REWARD}("Job", JOB_REWARD, 0);
            vm.prank(worker);
            jobMarket.acceptJob(jobId);
            vm.prank(worker);
            jobMarket.completeJob(jobId);
            vm.prank(buyer);
            jobMarket.rateJob(jobId, 5); // Excellent ratings
        }

        // Worker should now have 90+ reputation and get 50% fee discount
        uint256 globalRep = reputationEngine.getGlobalReputation(worker);
        assertTrue(globalRep >= 90);

        uint256 discountedFee = reputationEngine.calculateFee(worker, baseFee);
        assertEq(discountedFee, (baseFee * 50) / 100); // 50% of base fee
    }

    function test_CancelJob() public {
        uint256 buyerBalanceBefore = buyer.balance;

        vm.prank(buyer);
        uint256 jobId = jobMarket.postJob{value: JOB_REWARD}("Job to cancel", JOB_REWARD, 0);

        vm.prank(buyer);
        jobMarket.cancelJob(jobId);

        (, , , , , JobMarket.JobStatus status, ) = jobMarket.getJob(jobId);
        assertEq(uint256(status), uint256(JobMarket.JobStatus.Cancelled));

        // Verify refund
        assertEq(buyer.balance, buyerBalanceBefore);
    }

    function test_GetOpenJobs() public {
        // Post multiple jobs
        vm.startPrank(buyer);
        jobMarket.postJob{value: JOB_REWARD}("Job 1", JOB_REWARD, 0);
        uint256 jobId2 = jobMarket.postJob{value: JOB_REWARD}("Job 2", JOB_REWARD, 0);
        jobMarket.postJob{value: JOB_REWARD}("Job 3", JOB_REWARD, 0);
        vm.stopPrank();

        uint256[] memory openJobs = jobMarket.getOpenJobs();
        assertEq(openJobs.length, 3);

        // Accept one job
        vm.prank(worker);
        jobMarket.acceptJob(jobId2);

        openJobs = jobMarket.getOpenJobs();
        assertEq(openJobs.length, 2);
    }
}
