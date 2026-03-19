// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title AgentIdentity (ERC-8004 compatible)
/// @notice On-chain agent identity registry with admin-delegated registration.
///         Each wallet can register once. Admin can register on behalf of agents.
///
/// @dev Security fixes (audit 2026-03-16):
///      AI-01: agentURI capped at MAX_URI_LENGTH to prevent event log spam
///      AI-02: Two-step ownership transfer (propose + accept) to prevent accidental lockout
///      AI-03: setAgentURI() added for post-registration URI updates
contract AgentIdentity {
    // ── Constants ──────────────────────────────────────────────────────
    /// @dev AI-01: Max agentURI length (2048 bytes = generous for data URIs)
    uint256 public constant MAX_URI_LENGTH = 2048;

    // ── State ──────────────────────────────────────────────────────────
    address public owner;
    /// @dev AI-02: Pending owner for two-step transfer
    address public pendingOwner;
    uint256 public nextAgentId = 1;

    struct Agent {
        uint256 agentId;
        string  agentURI;
    }

    /// wallet → Agent (agentId=0 means unregistered)
    mapping(address => Agent) public agents;
    /// agentId → wallet (reverse lookup)
    mapping(uint256 => address) public agentOwner;

    // ── Events ─────────────────────────────────────────────────────────
    event Registered(address indexed wallet, uint256 indexed agentId, string agentURI);
    event AgentURIUpdated(address indexed wallet, uint256 indexed agentId, string newURI);
    event OwnershipTransferred(address indexed prev, address indexed next);
    event OwnershipTransferProposed(address indexed currentOwner, address indexed proposedOwner);

    // ── Errors ─────────────────────────────────────────────────────────
    error AlreadyRegistered(address wallet);
    error NotOwner();
    error NotPendingOwner();
    error ZeroAddress();
    error URITooLong(uint256 length, uint256 max);
    error NotRegistered(address wallet);

    // ── Constructor ────────────────────────────────────────────────────
    constructor(address _owner) {
        if (_owner == address(0)) revert ZeroAddress();
        owner = _owner;
        emit OwnershipTransferred(address(0), _owner);
    }

    // ── Modifiers ──────────────────────────────────────────────────────
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // ── Self-register (ERC-8004 compatible) ────────────────────────────
    /// @notice Register msg.sender with the given URI.
    function register(string calldata agentURI) external returns (uint256) {
        return _register(msg.sender, agentURI);
    }

    // ── Admin-delegated register ───────────────────────────────────────
    /// @notice Owner registers `wallet` on their behalf.
    function registerFor(address wallet, string calldata agentURI) external onlyOwner returns (uint256) {
        if (wallet == address(0)) revert ZeroAddress();
        return _register(wallet, agentURI);
    }

    // ── AI-03: Update agentURI post-registration ───────────────────────
    /// @notice Agent or owner can update the agentURI after registration.
    function setAgentURI(string calldata newURI) external {
        if (bytes(newURI).length > MAX_URI_LENGTH) revert URITooLong(bytes(newURI).length, MAX_URI_LENGTH);
        Agent storage agent = agents[msg.sender];
        if (agent.agentId == 0) revert NotRegistered(msg.sender);
        agent.agentURI = newURI;
        emit AgentURIUpdated(msg.sender, agent.agentId, newURI);
    }

    /// @notice Owner can update URI for any registered wallet.
    function setAgentURIFor(address wallet, string calldata newURI) external onlyOwner {
        if (bytes(newURI).length > MAX_URI_LENGTH) revert URITooLong(bytes(newURI).length, MAX_URI_LENGTH);
        Agent storage agent = agents[wallet];
        if (agent.agentId == 0) revert NotRegistered(wallet);
        agent.agentURI = newURI;
        emit AgentURIUpdated(wallet, agent.agentId, newURI);
    }

    // ── Internal ───────────────────────────────────────────────────────
    function _register(address wallet, string calldata agentURI) internal returns (uint256 agentId) {
        // AI-01: Enforce URI length cap
        if (bytes(agentURI).length > MAX_URI_LENGTH) revert URITooLong(bytes(agentURI).length, MAX_URI_LENGTH);
        if (agents[wallet].agentId != 0) revert AlreadyRegistered(wallet);
        agentId = nextAgentId++;
        agents[wallet] = Agent(agentId, agentURI);
        agentOwner[agentId] = wallet;
        emit Registered(wallet, agentId, agentURI);
    }

    // ── Views ──────────────────────────────────────────────────────────
    function agentIdOf(address wallet) external view returns (uint256) {
        return agents[wallet].agentId;
    }

    function agentURIOf(address wallet) external view returns (string memory) {
        return agents[wallet].agentURI;
    }

    function isRegistered(address wallet) external view returns (bool) {
        return agents[wallet].agentId != 0;
    }

    function name() external pure returns (string memory) {
        return "AgentIdentity";
    }

    // ── AI-02: Two-step ownership transfer ─────────────────────────────
    /// @notice Step 1: Current owner proposes a new owner.
    ///         The new owner must call acceptOwnership() to complete the transfer.
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferProposed(owner, newOwner);
    }

    /// @notice Step 2: Proposed owner accepts ownership.
    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        emit OwnershipTransferred(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
    }

    /// @notice Cancel pending ownership transfer.
    function cancelOwnershipTransfer() external onlyOwner {
        pendingOwner = address(0);
    }
}
