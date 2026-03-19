// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {Ownable2Step, Ownable} from "openzeppelin-contracts/contracts/access/Ownable2Step.sol";

/**
 * @title ScarabToken
 * @notice Maiat Protocol reputation token — ERC-20 with configurable transfer tax.
 *
 * Design decisions:
 * - Transfer tax (default 5%) burns tokens on transfer → natural deflation
 * - Owner can adjust tax (0-20%) or disable entirely
 * - Owner-only mint/burn for batch-settle cron (DB → on-chain sync)
 * - Tax-exempt list for approved contracts (DEX pools, staking, etc.)
 * - NOT soulbound — free to transfer, but tax creates friction against speculation
 */
contract ScarabToken is ERC20, Ownable2Step {
    /// @notice Transfer tax in basis points (100 = 1%, 500 = 5%)
    uint256 public transferTaxBps = 500; // 5% default

    /// @notice Maximum allowed tax (20%)
    uint256 public constant MAX_TAX_BPS = 2000;

    /// @notice Addresses exempt from transfer tax (owner always exempt)
    mapping(address => bool) public taxExempt;

    event TransferTaxUpdated(uint256 oldBps, uint256 newBps);
    event TaxExemptUpdated(address indexed account, bool exempt);

    constructor() ERC20("Scarab", "SCARAB") Ownable(msg.sender) {
        // Owner (deployer) is always tax-exempt
        taxExempt[msg.sender] = true;
    }

    // ─── Admin Functions ─────────────────────────────────────────────────────

    /// @notice Mint tokens (only owner — used by batch-settle cron)
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /// @notice Burn tokens from an address (requires allowance to the owner)
    /// @dev Used by batch-settle cron. Users must approve the owner address.
    function adminBurn(address from, uint256 amount) external onlyOwner {
        _spendAllowance(from, msg.sender, amount);
        _burn(from, amount);
    }

    /// @notice Set transfer tax (0 to MAX_TAX_BPS)
    function setTransferTax(uint256 newBps) external onlyOwner {
        require(newBps <= MAX_TAX_BPS, "Tax exceeds maximum");
        uint256 old = transferTaxBps;
        transferTaxBps = newBps;
        emit TransferTaxUpdated(old, newBps);
    }

    /// @notice Add/remove address from tax-exempt list
    function setTaxExempt(address account, bool exempt) external onlyOwner {
        taxExempt[account] = exempt;
        emit TaxExemptUpdated(account, exempt);
    }

    // ─── Transfer Override ───────────────────────────────────────────────────

    /// @dev Override _update to apply transfer tax (burn portion on transfer)
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        // No tax on mint, burn, or if sender/receiver is exempt
        if (
            from == address(0) ||           // mint
            to == address(0) ||             // burn
            transferTaxBps == 0 ||          // tax disabled
            taxExempt[from] ||              // sender exempt
            taxExempt[to]                   // receiver exempt
        ) {
            super._update(from, to, amount);
            return;
        }

        // Calculate and burn tax
        uint256 taxAmount = (amount * transferTaxBps) / 10000;
        uint256 sendAmount = amount - taxAmount;

        // Burn the tax portion
        super._update(from, address(0), taxAmount);
        // Transfer the rest
        super._update(from, to, sendAmount);
    }
}
