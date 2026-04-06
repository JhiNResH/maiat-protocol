// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import {Pausable} from "openzeppelin-contracts/contracts/utils/Pausable.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title MaiatDojo
/// @notice Agent Skill Marketplace — buy access + escrow sessions + settle
/// @dev Deployed on BSC mainnet. USDC is Binance-pegged (18 decimals).
contract MaiatDojo is AccessControl, Pausable {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                            CONSTANTS
    //////////////////////////////////////////////////////////////*/

    bytes32 public constant GATEWAY_ROLE = keccak256("GATEWAY_ROLE");

    uint256 public constant MAX_SESSION_BUDGET = 10e18;  // $10 USDC (18 decimals)
    uint256 public constant MAX_TOTAL_TVL = 500e18;      // $500 USDC
    uint256 public constant DOJO_FEE_BPS = 0;            // Phase 0: 0% fee (Phase 1: 500 = 5%)
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /*//////////////////////////////////////////////////////////////
                            STATE
    //////////////////////////////////////////////////////////////*/

    IERC20 public immutable usdc;
    uint256 public sunsetTimestamp;
    uint256 public totalLocked;
    uint256 public nextSkillId;
    uint256 public nextJobId;

    struct Skill {
        address creator;
        uint256 buyFee;       // one-time access fee (18 decimals)
        uint256 pricePerCall; // per-call fee (18 decimals)
        bytes32 vertical;
        bool active;
    }

    enum JobStatus { Open, Settled, Refunded }

    struct Job {
        uint256 skillId;
        address agent;
        uint256 deposit;
        uint256 callCount;
        uint256 spent;        // accumulated per-call fees
        JobStatus status;
    }

    mapping(uint256 => Skill) public skills;
    mapping(uint256 => Job) public jobs;
    /// @notice hasAccess[agent][skillId] = true after buying access
    mapping(address => mapping(uint256 => bool)) public hasAccess;
    /// @notice Pull-payment ledger for creator payouts (prevents blacklist DoS)
    mapping(address => uint256) public pendingWithdrawals;

    /*//////////////////////////////////////////////////////////////
                            EVENTS
    //////////////////////////////////////////////////////////////*/

    event SkillCreated(uint256 indexed skillId, address indexed creator, bytes32 vertical);
    event AccessPurchased(uint256 indexed skillId, address indexed agent, uint256 fee);
    event JobOpened(uint256 indexed jobId, uint256 indexed skillId, address indexed agent, uint256 deposit);
    event CallRecorded(uint256 indexed jobId, uint256 callCount, uint256 spent);
    event JobSettled(uint256 indexed jobId, uint256 creatorPayout, uint256 agentRefund, uint256 dojoFee);
    event JobRefunded(uint256 indexed jobId, uint256 refundAmount);
    event Withdrawn(address indexed account, uint256 amount);

    /*//////////////////////////////////////////////////////////////
                            ERRORS
    //////////////////////////////////////////////////////////////*/

    error Dojo__Sunset();
    error Dojo__TVLExceeded();
    error Dojo__BudgetExceeded();
    error Dojo__SkillInactive(uint256 skillId);
    error Dojo__AlreadyHasAccess();
    error Dojo__NoAccess();
    error Dojo__JobNotOpen(uint256 jobId);
    error Dojo__NotAgent(uint256 jobId);
    error Dojo__InsufficientDeposit();
    error Dojo__ZeroAddress();
    error Dojo__NothingToWithdraw();
    error Dojo__SpentNonZero();

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(address admin, address _usdc, uint256 sunsetDays) {
        if (admin == address(0) || _usdc == address(0)) revert Dojo__ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GATEWAY_ROLE, admin);
        usdc = IERC20(_usdc);
        sunsetTimestamp = block.timestamp + (sunsetDays * 1 days);
    }

    /*//////////////////////////////////////////////////////////////
                        CREATOR FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Register a new skill
    function createSkill(uint256 buyFee, uint256 pricePerCall, bytes32 vertical)
        external
        whenNotPaused
        returns (uint256 skillId)
    {
        _checkNotSunset();
        skillId = nextSkillId++;
        skills[skillId] = Skill({
            creator: msg.sender,
            buyFee: buyFee,
            pricePerCall: pricePerCall,
            vertical: vertical,
            active: true
        });
        emit SkillCreated(skillId, msg.sender, vertical);
    }

    /// @notice Creator can deactivate their skill
    function deactivateSkill(uint256 skillId) external {
        require(skills[skillId].creator == msg.sender, "not creator");
        skills[skillId].active = false;
    }

    /*//////////////////////////////////////////////////////////////
                        AGENT FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Buy access to a skill (one-time fee → 100% to creator)
    function buyAccess(uint256 skillId) external whenNotPaused {
        _checkNotSunset();
        Skill storage skill = skills[skillId];
        if (!skill.active) revert Dojo__SkillInactive(skillId);
        if (hasAccess[msg.sender][skillId]) revert Dojo__AlreadyHasAccess();

        hasAccess[msg.sender][skillId] = true;

        if (skill.buyFee > 0) {
            usdc.safeTransferFrom(msg.sender, skill.creator, skill.buyFee);
        }
        emit AccessPurchased(skillId, msg.sender, skill.buyFee);
    }

    /// @notice Open a session — deposit USDC into escrow
    function openSession(uint256 skillId, uint256 deposit) external whenNotPaused returns (uint256 jobId) {
        _checkNotSunset();
        if (!hasAccess[msg.sender][skillId]) revert Dojo__NoAccess();
        if (deposit > MAX_SESSION_BUDGET) revert Dojo__BudgetExceeded();
        if (totalLocked + deposit > MAX_TOTAL_TVL) revert Dojo__TVLExceeded();

        Skill storage skill = skills[skillId];
        if (!skill.active) revert Dojo__SkillInactive(skillId);

        jobId = nextJobId++;

        // Balance-delta check: defends against fee-on-transfer tokens
        uint256 balBefore = usdc.balanceOf(address(this));
        usdc.safeTransferFrom(msg.sender, address(this), deposit);
        uint256 received = usdc.balanceOf(address(this)) - balBefore;

        jobs[jobId] = Job({
            skillId: skillId,
            agent: msg.sender,
            deposit: received,
            callCount: 0,
            spent: 0,
            status: JobStatus.Open
        });
        totalLocked += received;

        emit JobOpened(jobId, skillId, msg.sender, received);
    }

    /// @notice Record a call within a session (gateway only)
    function recordCall(uint256 jobId) external onlyRole(GATEWAY_ROLE) whenNotPaused {
        Job storage job = jobs[jobId];
        if (job.status != JobStatus.Open) revert Dojo__JobNotOpen(jobId);

        uint256 fee = skills[job.skillId].pricePerCall;
        if (job.spent + fee > job.deposit) revert Dojo__InsufficientDeposit();

        job.callCount++;
        job.spent += fee;
        emit CallRecorded(jobId, job.callCount, job.spent);
    }

    /// @notice Settle a session — pay creator, refund agent, take Dojo fee
    function settle(uint256 jobId) external whenNotPaused {
        Job storage job = jobs[jobId];
        if (job.status != JobStatus.Open) revert Dojo__JobNotOpen(jobId);
        if (job.agent != msg.sender && !hasRole(GATEWAY_ROLE, msg.sender)) {
            revert Dojo__NotAgent(jobId);
        }

        job.status = JobStatus.Settled;
        totalLocked -= job.deposit;

        uint256 dojoFee = (job.spent * DOJO_FEE_BPS) / BPS_DENOMINATOR;
        uint256 creatorPayout = job.spent - dojoFee;
        uint256 agentRefund = job.deposit - job.spent;

        address creator = skills[job.skillId].creator;

        // Pull-payment for creator: prevents blacklisted-address DoS
        if (creatorPayout > 0) pendingWithdrawals[creator] += creatorPayout;
        // Push-payment for agent: agent controls their own address
        if (agentRefund > 0) usdc.safeTransfer(job.agent, agentRefund);
        // Phase 0: dojoFee = 0, no transfer needed

        emit JobSettled(jobId, creatorPayout, agentRefund, dojoFee);
    }

    /// @notice Emergency refund — agent can reclaim full deposit if no calls made
    function refund(uint256 jobId) external {
        Job storage job = jobs[jobId];
        if (job.status != JobStatus.Open) revert Dojo__JobNotOpen(jobId);
        if (job.agent != msg.sender) revert Dojo__NotAgent(jobId);
        if (job.spent > 0) revert Dojo__SpentNonZero();

        job.status = JobStatus.Refunded;
        totalLocked -= job.deposit;

        usdc.safeTransfer(msg.sender, job.deposit);
        emit JobRefunded(jobId, job.deposit);
    }

    /// @notice Creator withdraws accumulated payouts (pull-payment)
    function withdraw() external {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert Dojo__NothingToWithdraw();
        pendingWithdrawals[msg.sender] = 0;
        usdc.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    /*//////////////////////////////////////////////////////////////
                        VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function getSkill(uint256 skillId) external view returns (Skill memory) {
        return skills[skillId];
    }

    function getJob(uint256 jobId) external view returns (Job memory) {
        return jobs[jobId];
    }

    /*//////////////////////////////////////////////////////////////
                        ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function extendSunset(uint256 extraDays) external onlyRole(DEFAULT_ADMIN_ROLE) {
        sunsetTimestamp += extraDays * 1 days;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /*//////////////////////////////////////////////////////////////
                        INTERNAL
    //////////////////////////////////////////////////////////////*/

    function _checkNotSunset() internal view {
        if (block.timestamp > sunsetTimestamp) revert Dojo__Sunset();
    }
}
