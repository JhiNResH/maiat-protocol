// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ScarabToken.sol";

contract ScarabTokenTest is Test {
    ScarabToken token;
    address owner;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address charlie = makeAddr("charlie");

    function setUp() public {
        owner = address(this);
        token = new ScarabToken();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Basic Setup
    // ═══════════════════════════════════════════════════════════════════════

    function test_name() public view {
        assertEq(token.name(), "Scarab");
    }

    function test_symbol() public view {
        assertEq(token.symbol(), "SCARAB");
    }

    function test_decimals() public view {
        assertEq(token.decimals(), 18);
    }

    function test_initialTax() public view {
        assertEq(token.transferTaxBps(), 500); // 5%
    }

    function test_ownerIsTaxExempt() public view {
        assertTrue(token.taxExempt(owner));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Mint / Burn
    // ═══════════════════════════════════════════════════════════════════════

    function test_mint() public {
        token.mint(alice, 1000e18);
        assertEq(token.balanceOf(alice), 1000e18);
        assertEq(token.totalSupply(), 1000e18);
    }

    function test_mint_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        token.mint(alice, 1000e18);
    }

    function test_burnFrom() public {
        token.mint(alice, 1000e18);
        vm.prank(alice);
        token.approve(address(this), 400e18);
        token.adminBurn(alice, 400e18);
        assertEq(token.balanceOf(alice), 600e18);
        assertEq(token.totalSupply(), 600e18);
    }

    function test_burnFrom_onlyOwner() public {
        token.mint(alice, 1000e18);
        vm.prank(alice);
        token.approve(address(this), 100e18);
        vm.prank(alice);
        vm.expectRevert();
        token.adminBurn(alice, 100e18);
    }

    function test_burnFrom_exceedsBalance() public {
        token.mint(alice, 100e18);
        vm.prank(alice);
        token.approve(address(this), 200e18);
        vm.expectRevert();
        token.adminBurn(alice, 200e18);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Transfer Tax
    // ═══════════════════════════════════════════════════════════════════════

    function test_transferWithTax() public {
        token.mint(alice, 1000e18);

        vm.prank(alice);
        token.transfer(bob, 100e18);

        // Bob gets 95% (5% burned)
        assertEq(token.balanceOf(bob), 95e18);
        // Alice lost 100
        assertEq(token.balanceOf(alice), 900e18);
        // 5 burned → total supply decreased
        assertEq(token.totalSupply(), 995e18);
    }

    function test_transferFromExemptSender_noTax() public {
        // Owner is tax exempt
        token.mint(owner, 1000e18);
        token.transfer(bob, 100e18);

        // No tax — bob gets full 100
        assertEq(token.balanceOf(bob), 100e18);
        assertEq(token.totalSupply(), 1000e18);
    }

    function test_transferToExemptReceiver_noTax() public {
        token.setTaxExempt(bob, true);
        token.mint(alice, 1000e18);

        vm.prank(alice);
        token.transfer(bob, 100e18);

        // No tax — bob gets full 100
        assertEq(token.balanceOf(bob), 100e18);
    }

    function test_transferWithZeroTax() public {
        token.setTransferTax(0);
        token.mint(alice, 1000e18);

        vm.prank(alice);
        token.transfer(bob, 100e18);

        assertEq(token.balanceOf(bob), 100e18);
        assertEq(token.totalSupply(), 1000e18);
    }

    function test_transferWithMaxTax() public {
        token.setTransferTax(2000); // 20%
        token.mint(alice, 1000e18);

        vm.prank(alice);
        token.transfer(bob, 100e18);

        assertEq(token.balanceOf(bob), 80e18); // 20% burned
        assertEq(token.totalSupply(), 980e18);
    }

    function test_taxOnTransferFrom() public {
        token.mint(alice, 1000e18);

        vm.prank(alice);
        token.approve(charlie, 200e18);

        vm.prank(charlie);
        token.transferFrom(alice, bob, 100e18);

        assertEq(token.balanceOf(bob), 95e18); // 5% tax
        assertEq(token.balanceOf(alice), 900e18);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Admin: Tax Config
    // ═══════════════════════════════════════════════════════════════════════

    function test_setTransferTax() public {
        token.setTransferTax(1000); // 10%
        assertEq(token.transferTaxBps(), 1000);
    }

    function test_setTransferTax_exceedsMax() public {
        vm.expectRevert("Tax exceeds maximum");
        token.setTransferTax(2001);
    }

    function test_setTransferTax_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        token.setTransferTax(100);
    }

    function test_setTransferTax_emitsEvent() public {
        vm.expectEmit(false, false, false, true);
        emit ScarabToken.TransferTaxUpdated(500, 1000);
        token.setTransferTax(1000);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Admin: Tax Exempt
    // ═══════════════════════════════════════════════════════════════════════

    function test_setTaxExempt() public {
        token.setTaxExempt(alice, true);
        assertTrue(token.taxExempt(alice));

        token.setTaxExempt(alice, false);
        assertFalse(token.taxExempt(alice));
    }

    function test_setTaxExempt_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        token.setTaxExempt(alice, true);
    }

    function test_setTaxExempt_emitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit ScarabToken.TaxExemptUpdated(alice, true);
        token.setTaxExempt(alice, true);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Edge Cases
    // ═══════════════════════════════════════════════════════════════════════

    function test_transferZeroAmount() public {
        token.mint(alice, 1000e18);
        vm.prank(alice);
        token.transfer(bob, 0);
        assertEq(token.balanceOf(bob), 0);
    }

    function test_mintToZeroAddress_reverts() public {
        vm.expectRevert();
        token.mint(address(0), 100e18);
    }

    function test_selfTransfer_stillTaxed() public {
        token.mint(alice, 1000e18);
        vm.prank(alice);
        token.transfer(alice, 100e18);
        // Self-transfer still burns 5%
        assertEq(token.balanceOf(alice), 995e18);
        assertEq(token.totalSupply(), 995e18);
    }

    function test_multipleTaxedTransfers_deflation() public {
        token.mint(alice, 1000e18);

        // Transfer 3 times: alice → bob → charlie → alice
        vm.prank(alice);
        token.transfer(bob, 1000e18); // bob gets 950, 50 burned

        vm.prank(bob);
        token.transfer(charlie, 950e18); // charlie gets 902.5, 47.5 burned

        vm.prank(charlie);
        token.transfer(alice, 902e18); // alice gets 856.9, 45.1 burned

        // Total supply should be less than 1000 after 3 hops
        assertTrue(token.totalSupply() < 1000e18);
        // Roughly: 1000 - 50 - 47.5 - 45.1 = ~857.4
        assertTrue(token.totalSupply() < 860e18);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Fuzz Tests
    // ═══════════════════════════════════════════════════════════════════════

    function testFuzz_mintAndTransfer(uint256 mintAmount, uint256 transferAmount) public {
        mintAmount = bound(mintAmount, 1, type(uint128).max);
        transferAmount = bound(transferAmount, 0, mintAmount);

        token.mint(alice, mintAmount);

        vm.prank(alice);
        token.transfer(bob, transferAmount);

        uint256 expectedTax = (transferAmount * 500) / 10000;
        uint256 expectedReceived = transferAmount - expectedTax;

        assertEq(token.balanceOf(bob), expectedReceived);
        assertEq(token.balanceOf(alice), mintAmount - transferAmount);
        assertEq(token.totalSupply(), mintAmount - expectedTax);
    }

    function testFuzz_taxRateChange(uint256 newTaxBps) public {
        newTaxBps = bound(newTaxBps, 0, 2000);

        token.setTransferTax(newTaxBps);
        assertEq(token.transferTaxBps(), newTaxBps);

        token.mint(alice, 10000e18);
        vm.prank(alice);
        token.transfer(bob, 1000e18);

        uint256 expectedTax = (1000e18 * newTaxBps) / 10000;
        uint256 expectedReceived = 1000e18 - expectedTax;

        assertEq(token.balanceOf(bob), expectedReceived);
        assertEq(token.totalSupply(), 10000e18 - expectedTax);
    }

    function testFuzz_exemptBypass(address exemptAddr, uint256 amount) public {
        vm.assume(exemptAddr != address(0));
        vm.assume(exemptAddr != owner);
        amount = bound(amount, 1, type(uint128).max);

        token.setTaxExempt(exemptAddr, true);
        token.mint(exemptAddr, amount);

        vm.prank(exemptAddr);
        token.transfer(bob, amount);

        // No tax for exempt sender
        assertEq(token.balanceOf(bob), amount);
        assertEq(token.totalSupply(), amount); // no burn
    }

    function testFuzz_burnNeverExceedsBalance(uint256 mintAmt, uint256 burnAmt) public {
        mintAmt = bound(mintAmt, 0, type(uint128).max);
        burnAmt = bound(burnAmt, 0, type(uint128).max);

        token.mint(alice, mintAmt);

        vm.prank(alice);
        token.approve(address(this), burnAmt);

        if (burnAmt > mintAmt) {
            vm.expectRevert();
            token.adminBurn(alice, burnAmt);
        } else {
            token.adminBurn(alice, burnAmt);
            assertEq(token.balanceOf(alice), mintAmt - burnAmt);
        }
    }

    function testFuzz_taxExceedsMaxReverts(uint256 taxBps) public {
        taxBps = bound(taxBps, 2001, type(uint256).max);
        vm.expectRevert("Tax exceeds maximum");
        token.setTransferTax(taxBps);
    }

    // Invariant: totalSupply == sum of all balances (no tokens lost/created)
    function testFuzz_supplyConservation(uint256 amount, uint256 transferAmt) public {
        amount = bound(amount, 1, type(uint128).max);
        transferAmt = bound(transferAmt, 0, amount);

        token.mint(alice, amount);

        vm.prank(alice);
        token.transfer(bob, transferAmt);

        uint256 taxBurned = (transferAmt * 500) / 10000;
        // totalSupply = minted - burned
        assertEq(token.totalSupply(), amount - taxBurned);
        // sum of balances = totalSupply
        assertEq(token.balanceOf(alice) + token.balanceOf(bob), amount - taxBurned);
    }
}
