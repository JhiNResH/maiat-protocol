// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {MaiatPassport} from "../src/MaiatPassport.sol";

contract MaiatPassportTest is Test {
    MaiatPassport passport;
    address admin = address(1);
    address user1 = address(2);
    address user2 = address(3);

    function setUp() public {
        passport = new MaiatPassport(admin);
    }

    function test_mint() public {
        vm.prank(admin);
        uint256 tokenId = passport.mint(user1);
        assertEq(tokenId, 1);
        assertEq(passport.ownerOf(1), user1);
        assertTrue(passport.hasPassport(user1));
        assertEq(passport.passportOf(user1), 1);
    }

    function test_mint_reverts_duplicate() public {
        vm.startPrank(admin);
        passport.mint(user1);
        vm.expectRevert(abi.encodeWithSelector(MaiatPassport.AlreadyHasPassport.selector, user1));
        passport.mint(user1);
        vm.stopPrank();
    }

    function test_mint_reverts_unauthorized() public {
        vm.prank(user1);
        vm.expectRevert();
        passport.mint(user1);
    }

    function test_updatePassport() public {
        vm.startPrank(admin);
        passport.mint(user1);
        passport.updatePassport(user1, 85, 42, 10);
        vm.stopPrank();

        (uint256 score, uint256 reviews, uint256 attestations, uint256 lastUpdated) = passport.passportData(1);
        assertEq(score, 85);
        assertEq(reviews, 42);
        assertEq(attestations, 10);
        assertGt(lastUpdated, 0);
    }

    function test_updatePassport_reverts_noPassport() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(MaiatPassport.NoPassport.selector, user1));
        passport.updatePassport(user1, 85, 42, 10);
    }

    function test_transfer_reverts_soulbound() public {
        vm.prank(admin);
        passport.mint(user1);

        vm.prank(user1);
        vm.expectRevert(MaiatPassport.SoulboundTransfer.selector);
        passport.transferFrom(user1, user2, 1);
    }

    function test_tokenURI_returns_valid_json() public {
        vm.startPrank(admin);
        passport.mint(user1);
        passport.updatePassport(user1, 75, 20, 5);
        vm.stopPrank();

        string memory uri = passport.tokenURI(1);
        // Check it starts with the data URI prefix
        assertTrue(bytes(uri).length > 29);
        // Verify prefix
        bytes memory prefix = "data:application/json;base64,";
        for (uint i = 0; i < prefix.length; i++) {
            assertEq(bytes(uri)[i], prefix[i]);
        }
    }
}
