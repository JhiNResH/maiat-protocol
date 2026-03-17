// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {AgentIdentity} from "../src/AgentIdentity.sol";

contract AgentIdentityTest is Test {
    AgentIdentity public registry;

    address public admin   = address(1);
    address public agent1  = address(2);
    address public agent2  = address(3);
    address public attacker = address(0xBAD);

    string constant VALID_URI = "https://app.maiat.io/agent/0x0000000000000000000000000000000000000002";
    string constant LONG_URI  = "https://example.com/"; // padded below

    function setUp() public {
        registry = new AgentIdentity(admin);
    }

    // ─── Constructor ───────────────────────────────────────────────────

    function test_Constructor_SetsOwner() public view {
        assertEq(registry.owner(), admin);
    }

    function test_Constructor_RevertsZeroAddress() public {
        vm.expectRevert(AgentIdentity.ZeroAddress.selector);
        new AgentIdentity(address(0));
    }

    // ─── register ──────────────────────────────────────────────────────

    function test_Register_Success() public {
        vm.prank(agent1);
        uint256 id = registry.register(VALID_URI);
        assertEq(id, 1);
        assertTrue(registry.isRegistered(agent1));
        assertEq(registry.agentIdOf(agent1), 1);
        assertEq(registry.agentURIOf(agent1), VALID_URI);
    }

    function test_Register_SequentialIds() public {
        vm.prank(agent1);
        uint256 id1 = registry.register(VALID_URI);
        vm.prank(agent2);
        uint256 id2 = registry.register(VALID_URI);
        assertEq(id1, 1);
        assertEq(id2, 2);
    }

    function test_Register_RevertsDuplicate() public {
        vm.prank(agent1);
        registry.register(VALID_URI);
        vm.prank(agent1);
        vm.expectRevert(abi.encodeWithSelector(AgentIdentity.AlreadyRegistered.selector, agent1));
        registry.register(VALID_URI);
    }

    // ─── AI-01: URI length cap ─────────────────────────────────────────

    function test_Register_RevertsURITooLong() public {
        string memory tooLong = _repeat("x", 2049);
        vm.prank(agent1);
        vm.expectRevert(); // URITooLong
        registry.register(tooLong);
    }

    function test_Register_ExactMaxLengthSucceeds() public {
        string memory exactMax = _repeat("x", 2048);
        vm.prank(agent1);
        uint256 id = registry.register(exactMax);
        assertGt(id, 0);
    }

    function testFuzz_Register_URITooLong(uint256 extra) public {
        vm.assume(extra > 0 && extra < 10_000);
        string memory tooLong = _repeat("x", 2048 + extra);
        vm.prank(agent1);
        vm.expectRevert();
        registry.register(tooLong);
    }

    // ─── registerFor ───────────────────────────────────────────────────

    function test_RegisterFor_Success() public {
        vm.prank(admin);
        uint256 id = registry.registerFor(agent1, VALID_URI);
        assertEq(id, 1);
        assertTrue(registry.isRegistered(agent1));
    }

    function test_RegisterFor_RevertsUnauthorized() public {
        vm.prank(attacker);
        vm.expectRevert(AgentIdentity.NotOwner.selector);
        registry.registerFor(agent1, VALID_URI);
    }

    function test_RegisterFor_RevertsZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert(AgentIdentity.ZeroAddress.selector);
        registry.registerFor(address(0), VALID_URI);
    }

    // ─── AI-03: setAgentURI ────────────────────────────────────────────

    function test_SetAgentURI_Success() public {
        vm.prank(agent1);
        registry.register(VALID_URI);

        string memory newURI = "https://app.maiat.io/agent/updated";
        vm.prank(agent1);
        registry.setAgentURI(newURI);

        assertEq(registry.agentURIOf(agent1), newURI);
    }

    function test_SetAgentURI_RevertsNotRegistered() public {
        vm.prank(agent1);
        vm.expectRevert(abi.encodeWithSelector(AgentIdentity.NotRegistered.selector, agent1));
        registry.setAgentURI(VALID_URI);
    }

    function test_SetAgentURI_RevertsTooLong() public {
        vm.prank(agent1);
        registry.register(VALID_URI);

        string memory tooLong = _repeat("x", 2049);
        vm.prank(agent1);
        vm.expectRevert();
        registry.setAgentURI(tooLong);
    }

    function test_SetAgentURIFor_OwnerSuccess() public {
        vm.prank(agent1);
        registry.register(VALID_URI);

        string memory newURI = "https://updated.uri";
        vm.prank(admin);
        registry.setAgentURIFor(agent1, newURI);

        assertEq(registry.agentURIOf(agent1), newURI);
    }

    function test_SetAgentURIFor_RevertsUnauthorized() public {
        vm.prank(agent1);
        registry.register(VALID_URI);

        vm.prank(attacker);
        vm.expectRevert(AgentIdentity.NotOwner.selector);
        registry.setAgentURIFor(agent1, "https://evil.com");
    }

    // ─── AI-02: Two-step ownership ─────────────────────────────────────

    function test_TransferOwnership_TwoStep() public {
        // Step 1: propose
        vm.prank(admin);
        registry.transferOwnership(agent1);

        assertEq(registry.pendingOwner(), agent1);
        assertEq(registry.owner(), admin); // still admin

        // Step 2: accept
        vm.prank(agent1);
        registry.acceptOwnership();

        assertEq(registry.owner(), agent1);
        assertEq(registry.pendingOwner(), address(0));
    }

    function test_AcceptOwnership_RevertsWrongCaller() public {
        vm.prank(admin);
        registry.transferOwnership(agent1);

        vm.prank(attacker);
        vm.expectRevert(AgentIdentity.NotPendingOwner.selector);
        registry.acceptOwnership();
    }

    function test_CancelOwnershipTransfer() public {
        vm.prank(admin);
        registry.transferOwnership(agent1);
        assertEq(registry.pendingOwner(), agent1);

        vm.prank(admin);
        registry.cancelOwnershipTransfer();
        assertEq(registry.pendingOwner(), address(0));
    }

    function test_TransferOwnership_RevertsZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert(AgentIdentity.ZeroAddress.selector);
        registry.transferOwnership(address(0));
    }

    function test_TransferOwnership_RevertsUnauthorized() public {
        vm.prank(attacker);
        vm.expectRevert(AgentIdentity.NotOwner.selector);
        registry.transferOwnership(agent1);
    }

    // ─── Invariants ────────────────────────────────────────────────────

    function testFuzz_Register_UniqueIds(address user) public {
        vm.assume(user != address(0));
        vm.assume(user != agent1);
        vm.assume(!registry.isRegistered(user));

        vm.prank(agent1);
        uint256 id1 = registry.register(VALID_URI);
        vm.prank(user);
        uint256 id2 = registry.register(VALID_URI);

        assertTrue(id1 != id2);
        assertGt(id2, id1);
    }

    function testFuzz_AgentIdIsNonZeroAfterRegister(address user) public {
        vm.assume(user != address(0));
        vm.prank(user);
        registry.register(VALID_URI);
        assertGt(registry.agentIdOf(user), 0);
    }

    // ─── Helper ────────────────────────────────────────────────────────

    function _repeat(string memory s, uint256 n) internal pure returns (string memory) {
        bytes memory result = new bytes(n);
        bytes memory src = bytes(s);
        for (uint256 i = 0; i < n; i++) {
            result[i] = src[i % src.length];
        }
        return string(result);
    }
}
