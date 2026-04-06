// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {MaiatDojo} from "../src/dojo/MaiatDojo.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

/// @dev Mock USDC with 18 decimals (matches BSC bridged USDC)
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract MaiatDojoTest is Test {
    MaiatDojo public dojo;
    MockUSDC public usdc;

    address public admin = address(this);
    address public creator = address(0xC1);
    address public agent = address(0xA1);
    address public agent2 = address(0xA2);
    address public attacker = address(0xBAD);

    bytes32 constant VERTICAL_DOJO = bytes32("dojo");
    uint256 constant BUY_FEE = 1e18;        // $1
    uint256 constant PRICE_PER_CALL = 5e16;  // $0.05
    uint256 constant DEPOSIT = 5e18;         // $5

    event SkillCreated(uint256 indexed skillId, address indexed creator, bytes32 vertical);
    event AccessPurchased(uint256 indexed skillId, address indexed agent, uint256 fee);
    event JobOpened(uint256 indexed jobId, uint256 indexed skillId, address indexed agent, uint256 deposit);
    event CallRecorded(uint256 indexed jobId, uint256 callCount, uint256 spent);
    event JobSettled(uint256 indexed jobId, uint256 creatorPayout, uint256 agentRefund, uint256 dojoFee);
    event JobRefunded(uint256 indexed jobId, uint256 refundAmount);
    event Withdrawn(address indexed account, uint256 amount);
    event FeesWithdrawn(address indexed to, uint256 amount);

    function setUp() public {
        usdc = new MockUSDC();
        dojo = new MaiatDojo(admin, address(usdc), 30); // 30-day sunset

        // Fund agents
        usdc.mint(agent, 100e18);
        usdc.mint(agent2, 100e18);

        // Approve dojo
        vm.prank(agent);
        usdc.approve(address(dojo), type(uint256).max);
        vm.prank(agent2);
        usdc.approve(address(dojo), type(uint256).max);
    }

    /*//////////////////////////////////////////////////////////////
                        CONSTRUCTOR VALIDATION
    //////////////////////////////////////////////////////////////*/

    function test_Constructor_ZeroAdminReverts() public {
        vm.expectRevert(MaiatDojo.Dojo__ZeroAddress.selector);
        new MaiatDojo(address(0), address(usdc), 30);
    }

    function test_Constructor_ZeroUsdcReverts() public {
        vm.expectRevert(MaiatDojo.Dojo__ZeroAddress.selector);
        new MaiatDojo(admin, address(0), 30);
    }

    /*//////////////////////////////////////////////////////////////
                        SKILL CREATION
    //////////////////////////////////////////////////////////////*/

    function test_CreateSkill() public {
        vm.prank(creator);
        vm.expectEmit(true, true, false, true);
        emit SkillCreated(0, creator, VERTICAL_DOJO);
        uint256 id = dojo.createSkill(BUY_FEE, PRICE_PER_CALL, VERTICAL_DOJO);
        assertEq(id, 0);

        MaiatDojo.Skill memory skill = dojo.getSkill(0);
        assertEq(skill.creator, creator);
        assertEq(skill.buyFee, BUY_FEE);
        assertEq(skill.pricePerCall, PRICE_PER_CALL);
        assertEq(skill.vertical, VERTICAL_DOJO);
        assertTrue(skill.active);
    }

    function test_CreateSkill_IncrementingIds() public {
        vm.startPrank(creator);
        uint256 a = dojo.createSkill(0, 1e16, VERTICAL_DOJO);
        uint256 b = dojo.createSkill(0, 2e16, VERTICAL_DOJO);
        vm.stopPrank();
        assertEq(a, 0);
        assertEq(b, 1);
    }

    function test_DeactivateSkill() public {
        vm.prank(creator);
        dojo.createSkill(BUY_FEE, PRICE_PER_CALL, VERTICAL_DOJO);

        vm.prank(creator);
        dojo.deactivateSkill(0);
        assertFalse(dojo.getSkill(0).active);
    }

    function test_DeactivateSkill_NotCreatorReverts() public {
        vm.prank(creator);
        dojo.createSkill(BUY_FEE, PRICE_PER_CALL, VERTICAL_DOJO);

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(MaiatDojo.Dojo__NotCreator.selector, 0));
        dojo.deactivateSkill(0);
    }

    /*//////////////////////////////////////////////////////////////
                        BUY ACCESS
    //////////////////////////////////////////////////////////////*/

    function test_BuyAccess() public {
        vm.prank(creator);
        dojo.createSkill(BUY_FEE, PRICE_PER_CALL, VERTICAL_DOJO);

        vm.prank(agent);
        vm.expectEmit(true, true, false, true);
        emit AccessPurchased(0, agent, BUY_FEE);
        dojo.buyAccess(0);

        assertTrue(dojo.hasAccess(agent, 0));
        // buyFee is pull-payment: goes to pendingWithdrawals, not directly to creator
        assertEq(dojo.pendingWithdrawals(creator), BUY_FEE);
    }

    function test_BuyAccess_FreeFee() public {
        vm.prank(creator);
        dojo.createSkill(0, PRICE_PER_CALL, VERTICAL_DOJO); // free access

        vm.prank(agent);
        dojo.buyAccess(0);
        assertTrue(dojo.hasAccess(agent, 0));
    }

    function test_BuyAccess_AlreadyHasAccessReverts() public {
        vm.prank(creator);
        dojo.createSkill(BUY_FEE, PRICE_PER_CALL, VERTICAL_DOJO);

        vm.prank(agent);
        dojo.buyAccess(0);

        vm.prank(agent);
        vm.expectRevert(MaiatDojo.Dojo__AlreadyHasAccess.selector);
        dojo.buyAccess(0);
    }

    function test_BuyAccess_InactiveSkillReverts() public {
        vm.prank(creator);
        dojo.createSkill(BUY_FEE, PRICE_PER_CALL, VERTICAL_DOJO);
        vm.prank(creator);
        dojo.deactivateSkill(0);

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(MaiatDojo.Dojo__SkillInactive.selector, 0));
        dojo.buyAccess(0);
    }

    /*//////////////////////////////////////////////////////////////
                        SESSION (JOB) LIFECYCLE
    //////////////////////////////////////////////////////////////*/

    function _setupSkillAndAccess() internal returns (uint256 skillId) {
        vm.prank(creator);
        skillId = dojo.createSkill(BUY_FEE, PRICE_PER_CALL, VERTICAL_DOJO);
        vm.prank(agent);
        dojo.buyAccess(skillId);
    }

    function test_OpenSession() public {
        _setupSkillAndAccess();

        vm.prank(agent);
        vm.expectEmit(true, true, true, true);
        emit JobOpened(0, 0, agent, DEPOSIT);
        uint256 jobId = dojo.openSession(0, DEPOSIT);

        assertEq(jobId, 0);
        MaiatDojo.Job memory job = dojo.getJob(0);
        assertEq(job.skillId, 0);
        assertEq(job.agent, agent);
        assertEq(job.deposit, DEPOSIT);
        assertEq(job.callCount, 0);
        assertEq(job.spent, 0);
        assertEq(uint8(job.status), uint8(MaiatDojo.JobStatus.Open));
        assertEq(dojo.totalLocked(), DEPOSIT);
    }

    function test_OpenSession_NoAccessReverts() public {
        vm.prank(creator);
        dojo.createSkill(BUY_FEE, PRICE_PER_CALL, VERTICAL_DOJO);

        vm.prank(agent);
        vm.expectRevert(MaiatDojo.Dojo__NoAccess.selector);
        dojo.openSession(0, DEPOSIT);
    }

    function test_OpenSession_BudgetExceededReverts() public {
        _setupSkillAndAccess();

        vm.prank(agent);
        vm.expectRevert(MaiatDojo.Dojo__BudgetExceeded.selector);
        dojo.openSession(0, 11e18); // > MAX_SESSION_BUDGET
    }

    function test_OpenSession_TVLExceededReverts() public {
        _setupSkillAndAccess();

        // Mint enough USDC and open sessions until TVL cap
        usdc.mint(agent, 1000e18);
        vm.prank(agent);
        usdc.approve(address(dojo), type(uint256).max);

        for (uint256 i = 0; i < 50; i++) {
            vm.prank(agent);
            dojo.openSession(0, 10e18);
        }
        assertEq(dojo.totalLocked(), 500e18);

        vm.prank(agent);
        vm.expectRevert(MaiatDojo.Dojo__TVLExceeded.selector);
        dojo.openSession(0, 1e18);
    }

    function test_RecordCall() public {
        _setupSkillAndAccess();
        vm.prank(agent);
        dojo.openSession(0, DEPOSIT);

        // Admin has GATEWAY_ROLE
        dojo.recordCall(0);
        MaiatDojo.Job memory job = dojo.getJob(0);
        assertEq(job.callCount, 1);
        assertEq(job.spent, PRICE_PER_CALL);
    }

    function test_RecordCall_MultipleCalls() public {
        _setupSkillAndAccess();
        vm.prank(agent);
        dojo.openSession(0, DEPOSIT);

        dojo.recordCall(0);
        dojo.recordCall(0);
        dojo.recordCall(0);

        MaiatDojo.Job memory job = dojo.getJob(0);
        assertEq(job.callCount, 3);
        assertEq(job.spent, PRICE_PER_CALL * 3);
    }

    function test_RecordCall_ExceedsDepositReverts() public {
        _setupSkillAndAccess();
        vm.prank(agent);
        dojo.openSession(0, PRICE_PER_CALL * 2); // Only enough for 2 calls

        dojo.recordCall(0);
        dojo.recordCall(0);

        vm.expectRevert(MaiatDojo.Dojo__InsufficientDeposit.selector);
        dojo.recordCall(0); // 3rd call exceeds deposit
    }

    function test_RecordCall_NotGatewayReverts() public {
        _setupSkillAndAccess();
        vm.prank(agent);
        dojo.openSession(0, DEPOSIT);

        vm.prank(attacker);
        vm.expectRevert();
        dojo.recordCall(0);
    }

    /*//////////////////////////////////////////////////////////////
                        SETTLE
    //////////////////////////////////////////////////////////////*/

    function test_Settle() public {
        _setupSkillAndAccess();
        vm.prank(agent);
        dojo.openSession(0, DEPOSIT);

        // Record 20 calls: spent = 20 * 0.05 = $1.00
        for (uint256 i = 0; i < 20; i++) {
            dojo.recordCall(0);
        }

        uint256 creatorBefore = usdc.balanceOf(creator);
        uint256 agentBefore = usdc.balanceOf(agent);

        // Phase 0: dojoFee = 0%
        uint256 spent = PRICE_PER_CALL * 20; // 1e18
        uint256 expectedCreator = spent; // 0% fee
        uint256 expectedRefund = DEPOSIT - spent; // 4e18

        vm.prank(agent);
        vm.expectEmit(true, false, false, true);
        emit JobSettled(0, expectedCreator, expectedRefund, 0);
        dojo.settle(0);

        // Creator payout is pull-based — buyFee + session payout in pending withdrawals
        assertEq(dojo.pendingWithdrawals(creator), BUY_FEE + expectedCreator);
        assertEq(usdc.balanceOf(agent), agentBefore + expectedRefund);
        assertEq(dojo.totalLocked(), 0);

        // Creator withdraws (buyFee + session payout)
        uint256 totalPending = BUY_FEE + expectedCreator;
        vm.prank(creator);
        vm.expectEmit(true, false, false, true);
        emit Withdrawn(creator, totalPending);
        dojo.withdraw();
        assertEq(usdc.balanceOf(creator), creatorBefore + totalPending);
        assertEq(dojo.pendingWithdrawals(creator), 0);

        MaiatDojo.Job memory job = dojo.getJob(0);
        assertEq(uint8(job.status), uint8(MaiatDojo.JobStatus.Settled));
    }

    function test_Settle_ZeroCalls() public {
        _setupSkillAndAccess();
        vm.prank(agent);
        dojo.openSession(0, DEPOSIT);

        uint256 agentBefore = usdc.balanceOf(agent);

        vm.prank(agent);
        dojo.settle(0);

        // Full refund
        assertEq(usdc.balanceOf(agent), agentBefore + DEPOSIT);
    }

    function test_Settle_GatewayCanSettle() public {
        _setupSkillAndAccess();
        vm.prank(agent);
        dojo.openSession(0, DEPOSIT);

        dojo.recordCall(0);

        // Admin has GATEWAY_ROLE — should be able to settle
        dojo.settle(0);
        assertEq(uint8(dojo.getJob(0).status), uint8(MaiatDojo.JobStatus.Settled));
    }

    function test_Settle_AlreadySettledReverts() public {
        _setupSkillAndAccess();
        vm.prank(agent);
        dojo.openSession(0, DEPOSIT);
        vm.prank(agent);
        dojo.settle(0);

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(MaiatDojo.Dojo__JobNotOpen.selector, 0));
        dojo.settle(0);
    }

    function test_Settle_NotAgentOrGatewayReverts() public {
        _setupSkillAndAccess();
        vm.prank(agent);
        dojo.openSession(0, DEPOSIT);

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(MaiatDojo.Dojo__NotAgent.selector, 0));
        dojo.settle(0);
    }

    /*//////////////////////////////////////////////////////////////
                        REFUND
    //////////////////////////////////////////////////////////////*/

    function test_Refund_ZeroCalls() public {
        _setupSkillAndAccess();
        vm.prank(agent);
        dojo.openSession(0, DEPOSIT);

        uint256 agentBefore = usdc.balanceOf(agent);

        vm.prank(agent);
        vm.expectEmit(true, false, false, true);
        emit JobRefunded(0, DEPOSIT);
        dojo.refund(0);

        assertEq(usdc.balanceOf(agent), agentBefore + DEPOSIT);
        assertEq(dojo.totalLocked(), 0);
        assertEq(uint8(dojo.getJob(0).status), uint8(MaiatDojo.JobStatus.Refunded));
    }

    function test_Refund_AfterCallsReverts() public {
        _setupSkillAndAccess();
        vm.prank(agent);
        dojo.openSession(0, DEPOSIT);

        dojo.recordCall(0);

        vm.prank(agent);
        vm.expectRevert(MaiatDojo.Dojo__SpentNonZero.selector);
        dojo.refund(0);
    }

    function test_Refund_NotAgentReverts() public {
        _setupSkillAndAccess();
        vm.prank(agent);
        dojo.openSession(0, DEPOSIT);

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(MaiatDojo.Dojo__NotAgent.selector, 0));
        dojo.refund(0);
    }

    /*//////////////////////////////////////////////////////////////
                        WITHDRAW (PULL-PAYMENT)
    //////////////////////////////////////////////////////////////*/

    function test_Withdraw_NothingReverts() public {
        vm.prank(creator);
        vm.expectRevert(MaiatDojo.Dojo__NothingToWithdraw.selector);
        dojo.withdraw();
    }

    function test_Withdraw_AccumulatesMultipleSessions() public {
        _setupSkillAndAccess();

        // Session 1: 10 calls
        vm.prank(agent);
        dojo.openSession(0, 2e18);
        for (uint256 i = 0; i < 10; i++) { dojo.recordCall(0); }
        vm.prank(agent);
        dojo.settle(0);

        // Session 2: 5 calls
        vm.prank(agent);
        dojo.openSession(0, 1e18);
        for (uint256 i = 0; i < 5; i++) { dojo.recordCall(1); }
        vm.prank(agent);
        dojo.settle(1);

        // Creator should have accumulated buyFee + both session payouts
        uint256 sessionPayout = PRICE_PER_CALL * 15; // 0.75e18
        uint256 expected = BUY_FEE + sessionPayout;
        assertEq(dojo.pendingWithdrawals(creator), expected);

        uint256 balBefore = usdc.balanceOf(creator);
        vm.prank(creator);
        dojo.withdraw();
        assertEq(usdc.balanceOf(creator), balBefore + expected);
    }

    /*//////////////////////////////////////////////////////////////
                        SUNSET + PAUSE
    //////////////////////////////////////////////////////////////*/

    function test_Sunset_BlocksNewSkills() public {
        vm.warp(block.timestamp + 31 days);

        vm.prank(creator);
        vm.expectRevert(MaiatDojo.Dojo__Sunset.selector);
        dojo.createSkill(BUY_FEE, PRICE_PER_CALL, VERTICAL_DOJO);
    }

    function test_Sunset_ExtendWorks() public {
        dojo.extendSunset(30); // extend 30 more days

        vm.warp(block.timestamp + 50 days); // original 30 + 20 days into extension
        vm.prank(creator);
        dojo.createSkill(BUY_FEE, PRICE_PER_CALL, VERTICAL_DOJO); // should not revert
    }

    function test_Pause_BlocksOperations() public {
        dojo.pause();

        vm.prank(creator);
        vm.expectRevert();
        dojo.createSkill(BUY_FEE, PRICE_PER_CALL, VERTICAL_DOJO);
    }

    function test_Pause_OnlyAdmin() public {
        vm.prank(attacker);
        vm.expectRevert();
        dojo.pause();
    }

    /*//////////////////////////////////////////////////////////////
                        FULL SESSION FLOW
    //////////////////////////////////////////////////////////////*/

    function test_FullFlow_BuyOpenCallSettleRepeat() public {
        // Creator creates skill
        vm.prank(creator);
        dojo.createSkill(BUY_FEE, PRICE_PER_CALL, VERTICAL_DOJO);

        // Agent buys access
        vm.prank(agent);
        dojo.buyAccess(0);

        // Session 1: 10 calls
        vm.prank(agent);
        uint256 jobId1 = dojo.openSession(0, 2e18);

        for (uint256 i = 0; i < 10; i++) {
            dojo.recordCall(jobId1);
        }
        vm.prank(agent);
        dojo.settle(jobId1);

        // Session 2: no need to buy access again
        vm.prank(agent);
        uint256 jobId2 = dojo.openSession(0, 1e18);

        for (uint256 i = 0; i < 5; i++) {
            dojo.recordCall(jobId2);
        }
        vm.prank(agent);
        dojo.settle(jobId2);

        // Verify final state
        assertEq(dojo.totalLocked(), 0);
        assertEq(dojo.nextJobId(), 2);

        // Creator withdraws all accumulated payouts (buyFee + session payouts)
        uint256 expectedSessionPayout = PRICE_PER_CALL * 15; // 10 + 5 calls
        uint256 expectedTotal = BUY_FEE + expectedSessionPayout; // buyFee is also pull-payment now
        assertEq(dojo.pendingWithdrawals(creator), expectedTotal);
        vm.prank(creator);
        dojo.withdraw();
        assertEq(dojo.pendingWithdrawals(creator), 0);
    }

    /*//////////////////////////////////////////////////////////////
                        ADDITIONAL EDGE CASES
    //////////////////////////////////////////////////////////////*/

    function test_OpenSession_ZeroDepositReverts() public {
        _setupSkillAndAccess();

        vm.prank(agent);
        vm.expectRevert(MaiatDojo.Dojo__ZeroDeposit.selector);
        dojo.openSession(0, 0);
    }

    function test_CreateSkill_PricePerCallTooHighReverts() public {
        vm.prank(creator);
        vm.expectRevert(MaiatDojo.Dojo__PricePerCallTooHigh.selector);
        dojo.createSkill(0, 11e18, VERTICAL_DOJO); // > MAX_SESSION_BUDGET
    }

    function test_Settle_FullBudgetSpent() public {
        _setupSkillAndAccess();
        // Deposit exactly enough for 100 calls
        uint256 exactDeposit = PRICE_PER_CALL * 100; // 5e18
        vm.prank(agent);
        dojo.openSession(0, exactDeposit);

        for (uint256 i = 0; i < 100; i++) {
            dojo.recordCall(0);
        }

        uint256 agentBefore = usdc.balanceOf(agent);
        vm.prank(agent);
        dojo.settle(0);

        // spent == deposit → agent gets 0 refund, creator gets buyFee + full deposit
        assertEq(usdc.balanceOf(agent), agentBefore);
        assertEq(dojo.pendingWithdrawals(creator), BUY_FEE + exactDeposit);
        assertEq(dojo.totalLocked(), 0);
    }

    function test_Refund_AfterSettleReverts() public {
        _setupSkillAndAccess();
        vm.prank(agent);
        dojo.openSession(0, DEPOSIT);
        vm.prank(agent);
        dojo.settle(0);

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(MaiatDojo.Dojo__JobNotOpen.selector, 0));
        dojo.refund(0);
    }

    function test_ConcurrentSessions_TwoAgents() public {
        vm.prank(creator);
        dojo.createSkill(0, PRICE_PER_CALL, VERTICAL_DOJO); // free access to simplify accounting

        // Both agents buy access (free)
        vm.prank(agent);
        dojo.buyAccess(0);
        vm.prank(agent2);
        dojo.buyAccess(0);

        // Both open sessions
        vm.prank(agent);
        uint256 job1 = dojo.openSession(0, 2e18);
        vm.prank(agent2);
        uint256 job2 = dojo.openSession(0, 3e18);

        assertEq(dojo.totalLocked(), 5e18);

        // Record calls independently
        dojo.recordCall(job1);
        dojo.recordCall(job1);
        dojo.recordCall(job2);

        // Settle agent1 — should not affect agent2
        vm.prank(agent);
        dojo.settle(job1);

        MaiatDojo.Job memory j2 = dojo.getJob(job2);
        assertEq(uint8(j2.status), uint8(MaiatDojo.JobStatus.Open));
        assertEq(j2.callCount, 1);
        assertEq(dojo.totalLocked(), 3e18);

        // Settle agent2
        vm.prank(agent2);
        dojo.settle(job2);
        assertEq(dojo.totalLocked(), 0);
    }

    function test_WithdrawFees_AdminOnly() public {
        vm.prank(attacker);
        vm.expectRevert();
        dojo.withdrawFees(attacker);
    }

    function test_WithdrawFees_ZeroReverts() public {
        vm.expectRevert(MaiatDojo.Dojo__NothingToWithdraw.selector);
        dojo.withdrawFees(admin);
    }

    function test_WithdrawFees_ZeroAddressReverts() public {
        vm.expectRevert(MaiatDojo.Dojo__ZeroAddress.selector);
        dojo.withdrawFees(address(0));
    }

    /*//////////////////////////////////////////////////////////////
                        FUZZ
    //////////////////////////////////////////////////////////////*/

    /// @dev Fuzz the settle arithmetic: creatorPayout + agentRefund + dojoFee == deposit
    function testFuzz_SettleConservation(
        uint256 pricePerCall,
        uint256 deposit,
        uint256 numCalls
    ) public {
        // Bound inputs to reasonable ranges — cap numCalls to avoid gas limits
        pricePerCall = bound(pricePerCall, 1e14, 10e18);  // 0.0001 to MAX_SESSION_BUDGET
        deposit = bound(deposit, pricePerCall, 10e18);     // at least 1 call worth
        uint256 maxCalls = deposit / pricePerCall;
        if (maxCalls > 200) maxCalls = 200;                // gas cap
        numCalls = bound(numCalls, 0, maxCalls);

        // Setup
        vm.prank(creator);
        dojo.createSkill(0, pricePerCall, VERTICAL_DOJO); // free access
        vm.prank(agent);
        dojo.buyAccess(0);

        usdc.mint(agent, deposit);
        vm.prank(agent);
        usdc.approve(address(dojo), deposit);
        vm.prank(agent);
        dojo.openSession(0, deposit);

        for (uint256 i = 0; i < numCalls; i++) {
            dojo.recordCall(0);
        }

        uint256 agentBefore = usdc.balanceOf(agent);

        vm.prank(agent);
        dojo.settle(0);

        uint256 spent = pricePerCall * numCalls;
        uint256 dojoFee = (spent * 0) / 10_000; // Phase 0: 0%
        uint256 creatorPayout = spent - dojoFee;
        uint256 agentRefund = deposit - spent;

        // Conservation: everything adds up
        assertEq(creatorPayout + agentRefund + dojoFee, deposit);
        // Agent got refund
        assertEq(usdc.balanceOf(agent), agentBefore + agentRefund);
        // Creator payout in pending withdrawals (no buyFee since free access)
        assertEq(dojo.pendingWithdrawals(creator), creatorPayout);
        assertEq(dojo.totalLocked(), 0);
    }
}
