// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC721} from "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import {Strings} from "openzeppelin-contracts/contracts/utils/Strings.sol";
import {Base64} from "openzeppelin-contracts/contracts/utils/Base64.sol";

/// @title MaiatPassport
/// @notice Soulbound ERC-721 — one per wallet, non-transferable
contract MaiatPassport is ERC721, AccessControl {
    using Strings for uint256;
    using Strings for address;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant UPDATER_ROLE = keccak256("UPDATER_ROLE");

    struct PassportData {
        uint256 trustScore;
        uint256 totalReviews;
        uint256 attestationCount;
        uint256 lastUpdated;
    }

    /// @notice Internal counter for token IDs. Starts at 0, first minted ID is 1.
    uint256 private _nextTokenId;

    /// @notice token ID for a given holder
    mapping(address => uint256) public passportOf;
    /// @notice whether an address holds a passport
    mapping(address => bool) public hasPassport;
    /// @notice passport data per token
    mapping(uint256 => PassportData) public passportData;

    error AlreadyHasPassport(address holder);
    error NoPassport(address holder);
    error SoulboundTransfer();

    event PassportUpdated(address indexed holder, uint256 trustScore, uint256 totalReviews, uint256 attestationCount);

    constructor(address admin) ERC721("Maiat Passport", "MPPT") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(UPDATER_ROLE, admin);
    }

    function mint(address to) external onlyRole(MINTER_ROLE) returns (uint256) {
        if (hasPassport[to]) revert AlreadyHasPassport(to);
        uint256 tokenId = ++_nextTokenId;
        hasPassport[to] = true;
        passportOf[to] = tokenId;
        _safeMint(to, tokenId);
        return tokenId;
    }

    function updatePassport(
        address holder,
        uint256 score,
        uint256 reviews,
        uint256 attestations
    ) external onlyRole(UPDATER_ROLE) {
        if (!hasPassport[holder]) revert NoPassport(holder);
        uint256 tokenId = passportOf[holder];
        passportData[tokenId] = PassportData({
            trustScore: score,
            totalReviews: reviews,
            attestationCount: attestations,
            lastUpdated: block.timestamp
        });
        emit PassportUpdated(holder, score, reviews, attestations);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        PassportData memory data = passportData[tokenId];

        string memory svg = _buildSVG(tokenId, data);
        string memory imageUri = string(abi.encodePacked("data:image/svg+xml;base64,", Base64.encode(bytes(svg))));

        string memory json = string(abi.encodePacked(
            '{"name":"Maiat Passport #', tokenId.toString(),
            '","description":"Soulbound identity passport for the Maiat Protocol",',
            '"image":"', imageUri, '"}'
        ));

        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));
    }

    function _buildSVG(uint256 tokenId, PassportData memory data) internal view returns (string memory) {
        string memory part1 = string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" style="background:#1a1a2e">',
            '<text x="200" y="50" font-size="24" fill="#e94560" text-anchor="middle" font-family="monospace">Maiat Passport</text>',
            '<text x="200" y="120" font-size="64" fill="#0f3460" text-anchor="middle" font-family="monospace">', data.trustScore.toString(), '</text>',
            '<text x="200" y="160" font-size="14" fill="#16213e" text-anchor="middle" font-family="monospace">Trust Score</text>'
        ));
        string memory part2 = string(abi.encodePacked(
            '<text x="200" y="220" font-size="16" fill="#e94560" text-anchor="middle" font-family="monospace">Reviews: ', data.totalReviews.toString(), '</text>',
            '<text x="200" y="260" font-size="16" fill="#e94560" text-anchor="middle" font-family="monospace">Attestations: ', data.attestationCount.toString(), '</text>',
            '<text x="200" y="340" font-size="10" fill="#533483" text-anchor="middle" font-family="monospace">', Strings.toHexString(ownerOf(tokenId)), '</text>',
            '</svg>'
        ));
        return string(abi.encodePacked(part1, part2));
    }

    /// @dev Prevent all transfers except minting (from = address(0)) and burning (to = address(0))
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert SoulboundTransfer();
        
        // If burning, clear the passport state so the user can mint a new one in the future if needed
        if (to == address(0) && from != address(0)) {
            hasPassport[from] = false;
            delete passportOf[from];
            delete passportData[tokenId];
        }
        
        return super._update(to, tokenId, auth);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
