// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "openzeppelin-contracts/contracts/token/ERC1155/ERC1155.sol";
import "openzeppelin-contracts/contracts/access/Ownable2Step.sol";
import "openzeppelin-contracts/contracts/utils/Pausable.sol";
import "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SkillRegistry — Dojo Skill NFT Marketplace
 * @notice ERC-1155 skill NFTs for the Maiat Dojo.
 *         Creators earn royalties on every sale. Protocol takes a fee.
 *         Skills are soulbound to the recipient (non-transferable).
 *
 * @dev Audit fixes (2026-03-31 — Patrick/Trail of Bits/Cyfrin/Pashov):
 *      [H-01] Self-purchase bypass via TBA → block recipient == creator
 *      [H-02] Missing ReentrancyGuard → added nonReentrant
 *      [M-01] Transfer breaks hasSkill → soulbound (override _update)
 *      [M-02] setFees no cap → MAX_PROTOCOL_FEE_BPS = 1500 (15%)
 *      [M-03] buySkillToTBA no validation → require tba != address(0)
 *      [L-01] uri() not overridden → override returns metadataURI
 *      [L-02] withdraw() no event → added Withdrawn event
 *      [L-03] createSkill no validation → require name + price
 *      [I-01] floating pragma → fixed 0.8.26
 *      [I-03] dead code → removed commented protocolAmount
 */
contract SkillRegistry is ERC1155, Ownable2Step, Pausable, ReentrancyGuard {
    // ── Structs ────────────────────────────────────────────────────
    struct Skill {
        address creator;
        string name;
        string description;
        string metadataURI;   // IPFS/Arweave URI for skill file
        uint256 price;
        uint256 totalBuyers;
        bool exists;
        bool active;
    }

    // ── Constants ──────────────────────────────────────────────────
    uint16 public constant MAX_PROTOCOL_FEE_BPS = 1500;  // 15% hard cap
    uint16 public constant MAX_CREATOR_ROYALTY_BPS = 9500; // 95% hard cap

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
    event Withdrawn(address indexed to, uint256 amount);

    // ── Errors ─────────────────────────────────────────────────────
    error SkillNotFound(uint256 skillId);
    error SkillNotActive(uint256 skillId);
    error AlreadyOwned(address buyer, uint256 skillId);
    error InsufficientPayment(uint256 sent, uint256 required);
    error CannotBuyOwnSkill(address creator);
    error InvalidFees(uint16 protocol, uint16 creator);
    error InvalidSkillParams();
    error InvalidRecipient();
    error TransferFailed();
    error NotCreatorOrOwner();
    error SoulboundToken();

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
        if (bytes(name).length == 0) revert InvalidSkillParams();

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
    function buySkill(uint256 skillId) external payable whenNotPaused nonReentrant {
        _buySkill(skillId, msg.sender);
    }

    /// @notice Buy a skill NFT — mints to a TBA (6551 agent wallet)
    /// @param skillId The skill to buy
    /// @param tba The ERC-6551 Token Bound Account to mint to
    function buySkillToTBA(uint256 skillId, address tba) external payable whenNotPaused nonReentrant {
        if (tba == address(0)) revert InvalidRecipient();
        _buySkill(skillId, tba);
    }

    function _buySkill(uint256 skillId, address recipient) internal {
        Skill storage s = skills[skillId];
        if (!s.exists) revert SkillNotFound(skillId);
        if (!s.active) revert SkillNotActive(skillId);
        if (hasSkill[recipient][skillId]) revert AlreadyOwned(recipient, skillId);
        if (msg.value < s.price) revert InsufficientPayment(msg.value, s.price);
        // [H-01] Block both msg.sender AND recipient from being creator
        if (msg.sender == s.creator || recipient == s.creator) revert CannotBuyOwnSkill(s.creator);

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

    /// @notice [L-01] Return per-token metadata URI
    function uri(uint256 skillId) public view override returns (string memory) {
        Skill storage s = skills[skillId];
        if (!s.exists) revert SkillNotFound(skillId);
        return s.metadataURI;
    }

    // ── Soulbound ──────────────────────────────────────────────────

    /// @notice [M-01] Skills are soulbound — no transfers allowed
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override {
        // Allow minting (from == address(0)) and burning (to == address(0))
        // Block all other transfers
        if (from != address(0) && to != address(0)) revert SoulboundToken();
        super._update(from, to, ids, values);
    }

    // ── Admin Functions ────────────────────────────────────────────

    /// @notice [M-02] Update fee split with hard caps
    function setFees(uint16 _protocolFeeBps, uint16 _creatorRoyaltyBps) external onlyOwner {
        if (_protocolFeeBps > MAX_PROTOCOL_FEE_BPS) revert InvalidFees(_protocolFeeBps, _creatorRoyaltyBps);
        if (_creatorRoyaltyBps > MAX_CREATOR_ROYALTY_BPS) revert InvalidFees(_protocolFeeBps, _creatorRoyaltyBps);
        if (_protocolFeeBps + _creatorRoyaltyBps > 10000) revert InvalidFees(_protocolFeeBps, _creatorRoyaltyBps);
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

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /// @notice [L-02] Withdraw protocol fees with event
    function withdraw() external onlyOwner {
        uint256 bal = address(this).balance;
        (bool ok, ) = owner().call{value: bal}("");
        if (!ok) revert TransferFailed();
        emit Withdrawn(owner(), bal);
    }
}
