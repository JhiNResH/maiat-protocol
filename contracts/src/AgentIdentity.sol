// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title AgentIdentity (ERC-8004 compatible)
/// @notice On-chain agent identity registry with admin-delegated registration.
///         Each wallet can register once. Admin can register on behalf of agents.
contract AgentIdentity {
    // ── State ──────────────────────────────────────────────────────────
    address public owner;
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
    event OwnershipTransferred(address indexed prev, address indexed next);

    // ── Errors ─────────────────────────────────────────────────────────
    error AlreadyRegistered(address wallet);
    error NotOwner();
    error ZeroAddress();

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

    // ── Internal ───────────────────────────────────────────────────────
    function _register(address wallet, string calldata agentURI) internal returns (uint256 agentId) {
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

    // ── Owner management ───────────────────────────────────────────────
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
