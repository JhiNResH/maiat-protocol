// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {MaiatPassport} from "../src/core/MaiatPassport.sol";
import {IERC721} from "openzeppelin-contracts/contracts/token/ERC721/IERC721.sol";
import {IAccessControl} from "openzeppelin-contracts/contracts/access/IAccessControl.sol";

contract MaiatPassportTest is Test {
    MaiatPassport public passport;

    address public admin   = address(1);
    address public user1   = address(2);
    address public user2   = address(3);
    address public user3   = address(4);
    address public updater = address(5);
    address public attacker = address(0xBAD);

    event PassportUpdated(
        address indexed holder,
        uint256 trustScore,
        uint256 totalReviews,
        uint256 attestationCount
    );

    function setUp() public {
        passport = new MaiatPassport(admin);
    }

    // ─── Helpers ───────────────────────────────────────────────

    function _mint(address to) internal returns (uint256) {
        vm.prank(admin);
        return passport.mint(to);
    }

    function _update(address holder, uint256 score, uint256 reviews, uint256 attestations) internal {
        vm.prank(admin);
        passport.updatePassport(holder, score, reviews, attestations);
    }

    // ─── Constructor & Roles ───────────────────────────────────

    function test_Constructor_AdminHasAllRoles() public view {
        assertTrue(passport.hasRole(passport.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(passport.hasRole(passport.MINTER_ROLE(), admin));
        assertTrue(passport.hasRole(passport.UPDATER_ROLE(), admin));
    }

    function test_Constructor_NameAndSymbol() public view {
        assertEq(passport.name(), "Maiat Passport");
        assertEq(passport.symbol(), "MPPT");
    }

    // ─── Mint ──────────────────────────────────────────────────

    function test_Mint_Success() public {
        uint256 tokenId = _mint(user1);
        assertEq(tokenId, 1);
        assertEq(passport.ownerOf(1), user1);
        assertTrue(passport.hasPassport(user1));
        assertEq(passport.passportOf(user1), 1);
    }

    function test_Mint_RevertsDuplicate() public {
        _mint(user1);
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(MaiatPassport.AlreadyHasPassport.selector, user1));
        passport.mint(user1);
    }

    function test_Mint_RevertsUnauthorized() public {
        vm.prank(attacker);
        vm.expectRevert();
        passport.mint(attacker);
    }

    function test_Mint_SequentialTokenIds() public {
        uint256 id1 = _mint(user1);
        uint256 id2 = _mint(user2);
        uint256 id3 = _mint(user3);
        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(id3, 3);
        assertEq(passport.passportOf(user1), 1);
        assertEq(passport.passportOf(user2), 2);
        assertEq(passport.passportOf(user3), 3);
    }

    function test_HasPassport_FalseBeforeMint() public view {
        assertFalse(passport.hasPassport(user1));
        assertFalse(passport.hasPassport(attacker));
    }

    // ─── UPDATER_ROLE delegation ───────────────────────────────

    function test_UpdaterRoleDelegation_Success() public {
        // Cache role hash BEFORE vm.prank — otherwise prank is consumed by UPDATER_ROLE() call
        bytes32 updaterRole = passport.UPDATER_ROLE();
        vm.prank(admin);
        passport.grantRole(updaterRole, updater);

        _mint(user1);

        // Updater can now update the passport
        vm.prank(updater);
        passport.updatePassport(user1, 77, 33, 7);

        (uint256 score, uint256 reviews, uint256 attestations,) = passport.passportData(1);
        assertEq(score, 77);
        assertEq(reviews, 33);
        assertEq(attestations, 7);
    }

    // ─── updatePassport ────────────────────────────────────────

    function test_UpdatePassport_Success() public {
        _mint(user1);
        _update(user1, 85, 42, 10);

        (uint256 score, uint256 reviews, uint256 attestations, uint256 lastUpdated) = passport.passportData(1);
        assertEq(score, 85);
        assertEq(reviews, 42);
        assertEq(attestations, 10);
        assertGt(lastUpdated, 0);
    }

    function test_UpdatePassport_RevertsNoPassport() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(MaiatPassport.NoPassport.selector, user1));
        passport.updatePassport(user1, 85, 42, 10);
    }

    function test_UpdatePassport_RevertsUnauthorized() public {
        _mint(user1);
        vm.prank(attacker);
        vm.expectRevert();
        passport.updatePassport(user1, 85, 42, 10);
    }

    function test_UpdatePassport_Overwrite() public {
        _mint(user1);
        _update(user1, 50, 10, 2);
        _update(user1, 90, 99, 20);

        (uint256 score, uint256 reviews, uint256 attestations,) = passport.passportData(1);
        assertEq(score, 90);
        assertEq(reviews, 99);
        assertEq(attestations, 20);
    }

    function test_UpdatePassport_EmitsEvent() public {
        _mint(user1);

        vm.expectEmit(true, false, false, true);
        emit PassportUpdated(user1, 85, 42, 10);

        vm.prank(admin);
        passport.updatePassport(user1, 85, 42, 10);
    }

    // ─── tokenURI ──────────────────────────────────────────────

    function test_TokenURI_BeforeUpdate_Score0() public {
        _mint(user1);
        // tokenURI should work even with score=0 (default)
        string memory uri = passport.tokenURI(1);
        assertTrue(bytes(uri).length > 0);
        // Verify data URI prefix
        bytes memory prefix = "data:application/json;base64,";
        for (uint256 i = 0; i < prefix.length; i++) {
            assertEq(bytes(uri)[i], prefix[i]);
        }
    }

    function test_TokenURI_AfterUpdate_Valid() public {
        _mint(user1);
        _update(user1, 75, 20, 5);

        string memory uri = passport.tokenURI(1);
        assertTrue(bytes(uri).length > 29);
        bytes memory prefix = "data:application/json;base64,";
        for (uint256 i = 0; i < prefix.length; i++) {
            assertEq(bytes(uri)[i], prefix[i]);
        }
    }

    // ─── MP-01: Soulbound approve overrides ───────────────────

    function test_Approve_RevertsSoulbound() public {
        _mint(user1);
        vm.prank(user1);
        vm.expectRevert(MaiatPassport.SoulboundTransfer.selector);
        passport.approve(user2, 1);
    }

    function test_SetApprovalForAll_RevertsSoulbound() public {
        vm.prank(user1);
        vm.expectRevert(MaiatPassport.SoulboundTransfer.selector);
        passport.setApprovalForAll(user2, true);
    }

    // ─── MP-02: trustScore bounds ──────────────────────────────

    function test_UpdatePassport_RevertsScoreAbove100() public {
        _mint(user1);
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(MaiatPassport.TrustScoreOutOfRange.selector, 101));
        passport.updatePassport(user1, 101, 0, 0);
    }

    function test_UpdatePassport_Score100_Succeeds() public {
        _mint(user1);
        _update(user1, 100, 0, 0);
        (uint256 score,,,) = passport.passportData(1);
        assertEq(score, 100);
    }

    function test_UpdatePassport_Score0_Succeeds() public {
        _mint(user1);
        _update(user1, 0, 0, 0);
        (uint256 score,,,) = passport.passportData(1);
        assertEq(score, 0);
    }

    function testFuzz_UpdatePassport_ScoreAbove100_Reverts(uint256 score) public {
        vm.assume(score > 100);
        _mint(user1);
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(MaiatPassport.TrustScoreOutOfRange.selector, score));
        passport.updatePassport(user1, score, 0, 0);
    }

    // ─── Soulbound transfer ────────────────────────────────────

    function test_Transfer_RevertsSoulbound() public {
        _mint(user1);

        vm.prank(user1);
        vm.expectRevert(MaiatPassport.SoulboundTransfer.selector);
        passport.transferFrom(user1, user2, 1);
    }

    function test_SafeTransfer_RevertsSoulbound() public {
        _mint(user1);

        vm.prank(user1);
        vm.expectRevert(MaiatPassport.SoulboundTransfer.selector);
        passport.safeTransferFrom(user1, user2, 1);
    }

    // ─── supportsInterface ─────────────────────────────────────

    function test_SupportsInterface_ERC721() public view {
        assertTrue(passport.supportsInterface(type(IERC721).interfaceId));
    }

    function test_SupportsInterface_AccessControl() public view {
        assertTrue(passport.supportsInterface(type(IAccessControl).interfaceId));
    }

    function test_SupportsInterface_UnknownReturnsFalse() public view {
        assertFalse(passport.supportsInterface(0xdeadbeef));
    }

    // ─── Fuzz ──────────────────────────────────────────────────

    function testFuzz_Mint_UniqueUsers(address user) public {
        // Skip addresses that conflict with test setup
        vm.assume(user != address(0));
        vm.assume(user != address(this));
        vm.assume(user.code.length == 0);
        vm.assume(user != admin);
        vm.assume(user != user1);
        vm.assume(user != user2);
        vm.assume(user != user3);
        // Skip precompiles and the passport contract itself
        vm.assume(user > address(9));
        vm.assume(user != address(passport));

        assertFalse(passport.hasPassport(user));

        vm.prank(admin);
        passport.mint(user);

        assertTrue(passport.hasPassport(user));
        assertEq(passport.ownerOf(passport.passportOf(user)), user);
    }

    function testFuzz_UpdatePassport(uint256 score, uint256 reviews, uint256 attestations) public {
        vm.assume(score <= 100); // MP-02: score bounded
        _mint(user1);
        _update(user1, score, reviews, attestations);

        uint256 tokenId = passport.passportOf(user1);
        (uint256 s, uint256 r, uint256 a, uint256 ts) = passport.passportData(tokenId);
        assertEq(s, score);
        assertEq(r, reviews);
        assertEq(a, attestations);
        assertGt(ts, 0);
    }
}
