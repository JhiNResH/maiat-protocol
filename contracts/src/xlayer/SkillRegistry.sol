// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "openzeppelin-contracts/contracts/token/ERC1155/ERC1155.sol";
import "openzeppelin-contracts/contracts/access/Ownable2Step.sol";
import "openzeppelin-contracts/contracts/utils/Pausable.sol";

/**
 * @title SkillRegistry — Dojo Skill NFT Marketplace
 * @notice ERC-1155 skill NFTs for the Maiat Dojo.
 *         Creators earn royalties on every sale. Protocol takes a fee.
 *         Supports minting to ERC-6551 TBA (agent wallet) or directly to buyer.
 *
 * @dev Updated 2026-03-30:
 *      - Added Pausable (emergency stop)
 *      - Added Ownable2Step (two-step ownership transfer)
 *      - Added configurable protocolFeeBps + creatorRoyaltyBps
 *      - Added mintToTBA() for 6551 integration
 *      - Added skill deactivation
 *      - Self-purchase blocked (creator != buyer)
 */
contract SkillRegistry is ERC1155, Ownable2Step, Pausable {
    // ── Structs ────────────────────────────────────────────────────
    struct Skill {
        address creator;
        string name;
        string description;
        string metadataURI;   // IPFS/Arweave URI for skill file
        uint256 price;
        uint256 totalBuyers;
        bool exists;
        bool active;          // can be deactivated by creator or owner
    }

    // ── State ──────────────────────────────────────────────────────
    uint256 public nextSkillId = 1;
    mapping(uint256 => Skill) public skills;
    mapping(address => uint256[]) private _agentSkills;
    mapping(address => mapping(uint256 => bool)) public hasSkill;

    /// @notice Configurable fee splits (basis points, 10000 = 100%)
    uint16 public protocolFeeBps = 1000;      // 10%
    uint16 public creatorRoyaltyBps = 8500;   // 85%
    // Remaining 5% stays in contract (evaluator reserve)

    // ── Events ─────────────────────────────────────────────────────
    event SkillCreated(uint256 indexed skillId, address indexed creator, string name, uint256 price);
    event SkillPurchased(uint256 indexed skillId, address indexed buyer, address indexed creator, uint256 pricePaid);
    event SkillDeactivated(uint256 indexed skillId);
    event SkillReactivated(uint256 indexed skillId);
    event FeesUpdated(uint16 protocolFeeBps, uint16 creatorRoyaltyBps);

    // ── Errors ─────────────────────────────────────────────────────
    error SkillNotFound(uint256 skillId);
    error SkillNotActive(uint256 skillId);
    error AlreadyOwned(address buyer, uint256 skillId);
    error InsufficientPayment(uint256 sent, uint256 required);
    error CannotBuyOwnSkill(address creator);
    error InvalidFees(uint16 protocol, uint16 creator);
    error TransferFailed();
    error NotCreatorOrOwner();

    // ── Constructor ────────────────────────────────────────────────
    constructor() ERC1155("") Ownable(msg.sender) {}

    // ── Creator Functions ──────────────────────────────────────────

    /// @notice Anyone can create a skill NFT type
    function createSkill(
        string calldata name,
        string calldata description,
        uint256 price,
        string calldata metadataURI
    ) external whenNotPaused returns (uint256 skillId) {
        skillId = nextSkillId++;
        skills[skillId] = Skill({
            creator: msg.sender,
            name: name,
            description: description,
            metadataURI: metadataURI,
            price: price,
            totalBuyers: 0,
            exists: true,
            active: true
        });
        emit SkillCreated(skillId, msg.sender, name, price);
    }

    // ── Buy Functions ──────────────────────────────────────────────

    /// @notice Buy a skill NFT — mints to msg.sender
    function buySkill(uint256 skillId) external payable whenNotPaused {
        _buySkill(skillId, msg.sender);
    }

    /// @notice Buy a skill NFT — mints to a TBA (6551 agent wallet)
    /// @param skillId The skill to buy
    /// @param tba The ERC-6551 Token Bound Account to mint to
    function buySkillToTBA(uint256 skillId, address tba) external payable whenNotPaused {
        _buySkill(skillId, tba);
    }

    function _buySkill(uint256 skillId, address recipient) internal {
        Skill storage s = skills[skillId];
        if (!s.exists) revert SkillNotFound(skillId);
        if (!s.active) revert SkillNotActive(skillId);
        if (hasSkill[recipient][skillId]) revert AlreadyOwned(recipient, skillId);
        if (msg.value < s.price) revert InsufficientPayment(msg.value, s.price);
        if (msg.sender == s.creator) revert CannotBuyOwnSkill(s.creator);

        // Mint ERC-1155 token to recipient (could be EOA or TBA)
        _mint(recipient, skillId, 1, "");

        // Track ownership
        hasSkill[recipient][skillId] = true;
        _agentSkills[recipient].push(skillId);
        s.totalBuyers++;

        // Split payment
        uint256 creatorAmount = (s.price * creatorRoyaltyBps) / 10000;
        // protocolAmount + remainder stays in contract (evaluator reserve)
        // uint256 protocolAmount = (s.price * protocolFeeBps) / 10000;

        // Pay creator
        if (creatorAmount > 0) {
            (bool ok, ) = s.creator.call{value: creatorAmount}("");
            if (!ok) revert TransferFailed();
        }

        // Refund excess
        uint256 excess = msg.value - s.price;
        if (excess > 0) {
            (bool ok2, ) = msg.sender.call{value: excess}("");
            if (!ok2) revert TransferFailed();
        }

        emit SkillPurchased(skillId, recipient, s.creator, s.price);
    }

    // ── View Functions ─────────────────────────────────────────────

    /// @notice Get skill metadata
    function getSkill(uint256 skillId) external view returns (
        address creator,
        string memory name,
        string memory description,
        string memory metadataURI,
        uint256 price,
        uint256 totalBuyers,
        bool active
    ) {
        Skill storage s = skills[skillId];
        if (!s.exists) revert SkillNotFound(skillId);
        return (s.creator, s.name, s.description, s.metadataURI, s.price, s.totalBuyers, s.active);
    }

    /// @notice Get all skills owned by an address (EOA or TBA)
    function getAgentSkills(address agent) external view returns (uint256[] memory) {
        return _agentSkills[agent];
    }

    // ── Admin Functions ────────────────────────────────────────────

    /// @notice Update fee split (owner only)
    function setFees(uint16 _protocolFeeBps, uint16 _creatorRoyaltyBps) external onlyOwner {
        if (_protocolFeeBps + _creatorRoyaltyBps > 10000) {
            revert InvalidFees(_protocolFeeBps, _creatorRoyaltyBps);
        }
        protocolFeeBps = _protocolFeeBps;
        creatorRoyaltyBps = _creatorRoyaltyBps;
        emit FeesUpdated(_protocolFeeBps, _creatorRoyaltyBps);
    }

    /// @notice Deactivate a skill (creator or owner)
    function deactivateSkill(uint256 skillId) external {
        Skill storage s = skills[skillId];
        if (!s.exists) revert SkillNotFound(skillId);
        if (msg.sender != s.creator && msg.sender != owner()) revert NotCreatorOrOwner();
        s.active = false;
        emit SkillDeactivated(skillId);
    }

    /// @notice Reactivate a skill (creator or owner)
    function reactivateSkill(uint256 skillId) external {
        Skill storage s = skills[skillId];
        if (!s.exists) revert SkillNotFound(skillId);
        if (msg.sender != s.creator && msg.sender != owner()) revert NotCreatorOrOwner();
        s.active = true;
        emit SkillReactivated(skillId);
    }

    /// @notice Pause all operations (emergency)
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Withdraw protocol fees (evaluator reserve)
    function withdraw() external onlyOwner {
        (bool ok, ) = owner().call{value: address(this).balance}("");
        if (!ok) revert TransferFailed();
    }
}
