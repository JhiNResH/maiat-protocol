// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @title ERC8004Integration.t.sol
 * @notice Fork tests for ERC-8004 Identity Registry (0x8004A169...)
 *
 * Tests the real deployed contract on Base mainnet via Forge fork.
 * Run with:
 *   forge test --match-contract ERC8004IntegrationTest --fork-url $BASE_RPC_URL -vvv
 *
 * What this covers (that unit mocks don't):
 * - Real contract ABI correctness (register function signature)
 * - Duplicate registration reverts on-chain
 * - setAgentURI update flow
 * - Event emission: AgentRegistered, AgentURIUpdated
 * - agentId auto-increment on real state
 */

import {Test, console2, Vm} from "forge-std/Test.sol";

// ─── Minimal ERC-8004 Interface ───────────────────────────────────────────────

interface IERC8004IdentityRegistry {
    event AgentRegistered(uint256 indexed agentId, address indexed owner, string agentURI);
    event AgentURIUpdated(uint256 indexed agentId, address indexed owner, string agentURI);

    function register(string calldata agentURI) external returns (uint256 agentId);
    function setAgentURI(uint256 agentId, string calldata agentURI) external;
    function getAgent(uint256 agentId) external view returns (address owner, string memory agentURI);
    function agentOf(address owner) external view returns (uint256 agentId);
    function ownerOf(uint256 agentId) external view returns (address owner);
}

// ─── Test Contract ────────────────────────────────────────────────────────────

contract ERC8004IntegrationTest is Test {

    IERC8004IdentityRegistry public registry;

    address public constant REGISTRY_ADDR = 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432;
    address public constant MAIAT_WALLET   = 0xE6ac05D2b50cd525F793024D75BB6f519a52Af5D;

    address public testAgent1;
    address public testAgent2;
    address public attacker;

    string public constant SAMPLE_URI = "data:application/json;base64,eyJ0eXBlIjoiaHR0cHM6Ly9laXBzLmV0aGVyZXVtLm9yZy9FSVBTLmVpcC04MDA0I3JlZ2lzdHJhdGlvbi12MSIsIm5hbWUiOiJUZXN0QWdlbnQiLCJkZXNjcmlwdGlvbiI6IkZvcmsgdGVzdCBhZ2VudCIsImltYWdlIjoiaHR0cHM6Ly9hcHAubWFpYXQuaW8vbG9nby5wbmciLCJzZXJ2aWNlcyI6W119";
    string public constant UPDATED_URI = "data:application/json;base64,eyJ0eXBlIjoiaHR0cHM6Ly9laXBzLmV0aGVyZXVtLm9yZy9FSVBTLmVpcC04MDA0I3JlZ2lzdHJhdGlvbi12MSIsIm5hbWUiOiJVcGRhdGVkQWdlbnQiLCJkZXNjcmlwdGlvbiI6IlVwZGF0ZWQgdXJpIiwiaW1hZ2UiOiIiLCJzZXJ2aWNlcyI6W119";

    /// @dev Skip all tests when not running with --fork-url
    modifier onlyFork() {
        if (block.chainid == 31337) {
            return; // local anvil — skip
        }
        _;
    }

    function setUp() public {
        // Fork Base mainnet — requires BASE_RPC_URL env var
        // forge test --match-contract ERC8004IntegrationTest --fork-url $BASE_RPC_URL -vvv
        if (block.chainid == 31337) {
            // Not forked — tests will be skipped via onlyFork modifier
            return;
        }

        registry = IERC8004IdentityRegistry(REGISTRY_ADDR);

        testAgent1 = makeAddr("testAgent1");
        testAgent2 = makeAddr("testAgent2");
        attacker   = makeAddr("attacker");

        // Fund test addresses with ETH for gas
        vm.deal(testAgent1, 1 ether);
        vm.deal(testAgent2, 1 ether);
        vm.deal(attacker,   1 ether);
    }

    // ─── Test 1: Maiat wallet is already registered ───────────────────────────

    /// @notice Confirms the real Maiat wallet (0xE6ac...) is registered on mainnet
    function test_MaiatWallet_AlreadyRegistered() public onlyFork {
        uint256 agentId = registry.agentOf(MAIAT_WALLET);
        assertGt(agentId, 0, "Maiat wallet should have a registered agentId > 0");

        (address owner, string memory uri) = registry.getAgent(agentId);
        assertEq(owner, MAIAT_WALLET, "Owner should be Maiat wallet");
        assertTrue(bytes(uri).length > 0, "agentURI should not be empty");

        console2.log("Maiat agentId:", agentId);
        console2.log("Maiat agentURI (first 100 chars):", _slice(uri, 100));
    }

    // ─── Test 2: Fresh address can register ───────────────────────────────────

    /// @notice New address successfully registers on the real contract
    function test_Register_FreshAddress_Success() public onlyFork {
        vm.prank(testAgent1);
        uint256 agentId = registry.register(SAMPLE_URI);

        assertGt(agentId, 0, "agentId should be > 0");
        assertEq(registry.agentOf(testAgent1), agentId, "agentOf should return registered id");

        (address owner, string memory uri) = registry.getAgent(agentId);
        assertEq(owner, testAgent1, "Owner should be testAgent1");
        assertEq(uri, SAMPLE_URI, "URI should match submitted URI");
    }

    // ─── Test 3: Duplicate registration reverts ───────────────────────────────

    /// @notice Registering the same address twice must revert
    function test_Register_Duplicate_Reverts() public onlyFork {
        vm.prank(testAgent1);
        registry.register(SAMPLE_URI);

        // Second registration should revert
        vm.prank(testAgent1);
        vm.expectRevert();
        registry.register(SAMPLE_URI);
    }

    // ─── Test 4: setAgentURI by owner succeeds ────────────────────────────────

    /// @notice Owner can update their agentURI after registration
    function test_SetAgentURI_Owner_Success() public onlyFork {
        vm.prank(testAgent1);
        uint256 agentId = registry.register(SAMPLE_URI);

        vm.prank(testAgent1);
        registry.setAgentURI(agentId, UPDATED_URI);

        (, string memory updatedUri) = registry.getAgent(agentId);
        assertEq(updatedUri, UPDATED_URI, "URI should be updated");
    }

    // ─── Test 5: setAgentURI by non-owner reverts ─────────────────────────────

    /// @notice Non-owner cannot update another agent's URI
    function test_SetAgentURI_NonOwner_Reverts() public onlyFork {
        vm.prank(testAgent1);
        uint256 agentId = registry.register(SAMPLE_URI);

        vm.prank(attacker);
        vm.expectRevert();
        registry.setAgentURI(agentId, UPDATED_URI);

        // URI unchanged
        (, string memory uri) = registry.getAgent(agentId);
        assertEq(uri, SAMPLE_URI, "URI should not be changed by attacker");
    }

    // ─── Test 6: AgentRegistered event emitted ───────────────────────────────

    /// @notice Registration must emit AgentRegistered event with correct args
    function test_Register_EmitsAgentRegisteredEvent() public onlyFork {
        // We can't predict agentId before the call, so just check it was emitted
        vm.recordLogs();

        vm.prank(testAgent1);
        uint256 agentId = registry.register(SAMPLE_URI);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool found = false;
        for (uint256 i = 0; i < logs.length; i++) {
            // AgentRegistered(uint256 indexed agentId, address indexed owner, string agentURI)
            // topic[0] = keccak256("AgentRegistered(uint256,address,string)")
            bytes32 expectedSig = keccak256("AgentRegistered(uint256,address,string)");
            if (logs[i].topics[0] == expectedSig) {
                found = true;
                // topic[1] = agentId (indexed)
                uint256 emittedId = uint256(logs[i].topics[1]);
                assertEq(emittedId, agentId, "Emitted agentId mismatch");
                // topic[2] = owner (indexed)
                address emittedOwner = address(uint160(uint256(logs[i].topics[2])));
                assertEq(emittedOwner, testAgent1, "Emitted owner mismatch");
                break;
            }
        }
        assertTrue(found, "AgentRegistered event not emitted");
    }

    // ─── Test 7: AgentURIUpdated event emitted ───────────────────────────────

    /// @notice setAgentURI must emit AgentURIUpdated event
    function test_SetAgentURI_EmitsEvent() public onlyFork {
        vm.prank(testAgent1);
        uint256 agentId = registry.register(SAMPLE_URI);

        vm.recordLogs();

        vm.prank(testAgent1);
        registry.setAgentURI(agentId, UPDATED_URI);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool found = false;
        for (uint256 i = 0; i < logs.length; i++) {
            bytes32 expectedSig = keccak256("AgentURIUpdated(uint256,address,string)");
            if (logs[i].topics[0] == expectedSig) {
                found = true;
                break;
            }
        }
        assertTrue(found, "AgentURIUpdated event not emitted");
    }

    // ─── Test 8: ownerOf lookup ───────────────────────────────────────────────

    /// @notice ownerOf(agentId) returns correct address
    function test_OwnerOf_ReturnsCorrectOwner() public onlyFork {
        vm.prank(testAgent1);
        uint256 agentId = registry.register(SAMPLE_URI);

        assertEq(registry.ownerOf(agentId), testAgent1);
    }

    // ─── Test 9: agentOf unregistered returns 0 ──────────────────────────────

    /// @notice Unregistered address should return 0 (or revert) from agentOf
    function test_AgentOf_UnregisteredAddress_ReturnsZeroOrReverts() public onlyFork {
        address unregistered = makeAddr("never_registered");
        // Contract either returns 0 or reverts — either is acceptable
        try registry.agentOf(unregistered) returns (uint256 id) {
            assertEq(id, 0, "Unregistered address should have agentId 0");
        } catch {
            // revert is also acceptable
        }
    }

    // ─── Test 10: Multiple agents get sequential IDs ─────────────────────────

    /// @notice agentIds should be sequential (or at least both > 0 and different)
    function test_MultipleRegistrations_UniqueIds() public onlyFork {
        vm.prank(testAgent1);
        uint256 id1 = registry.register(SAMPLE_URI);

        vm.prank(testAgent2);
        uint256 id2 = registry.register(UPDATED_URI);

        assertGt(id1, 0, "id1 should be > 0");
        assertGt(id2, 0, "id2 should be > 0");
        assertTrue(id1 != id2, "Two registrations must yield different agentIds");
        // On this contract, IDs are sequential
        assertEq(id2, id1 + 1, "agentIds should be sequential");
    }

    // ─── Test 11: Script calldata correctness ────────────────────────────────

    /// @notice Verifies the ABI used in register-erc8004.ts matches real contract
    /// The script uses: { name: "register", inputs: [{ name: "agentURI", type: "string" }] }
    function test_RegisterABI_MatchesRealContract() public onlyFork {
        // If the function selector is wrong, this call reverts with a different error
        // A successful register proves the ABI is correct
        vm.prank(testAgent1);
        uint256 agentId = registry.register(SAMPLE_URI);
        assertGt(agentId, 0);
    }

    // ─── Test 12: Fuzz — register with any valid data URI ────────────────────

    /// @notice Any string can be registered as agentURI (contract doesn't validate content)
    function testFuzz_Register_AnyURI(string calldata uri) public onlyFork {
        vm.assume(bytes(uri).length > 0);
        vm.assume(bytes(uri).length < 10_000); // realistic upper bound

        address freshAgent = makeAddr(uri);
        vm.deal(freshAgent, 1 ether);

        vm.prank(freshAgent);
        uint256 agentId = registry.register(uri);
        assertGt(agentId, 0);

        (, string memory storedUri) = registry.getAgent(agentId);
        assertEq(storedUri, uri, "URI should round-trip correctly");
    }

    // ─── Test 13: Maiat wallet cannot register again ─────────────────────────

    /// @notice Real Maiat wallet (already registered) reverts on second attempt
    function test_MaiatWallet_CannotRegisterAgain() public onlyFork {
        vm.deal(MAIAT_WALLET, 1 ether);
        vm.prank(MAIAT_WALLET);
        vm.expectRevert();
        registry.register(SAMPLE_URI);
    }

    // ─── Test 14: getAgent for non-existent agentId ──────────────────────────

    /// @notice getAgent for agentId=0 or very large id should revert or return zero address
    function test_GetAgent_NonExistentId_HandledGracefully() public onlyFork {
        try registry.getAgent(999_999_999) returns (address owner, string memory uri) {
            // If it returns, owner should be zero (no one owns it)
            assertEq(owner, address(0), "Non-existent agentId should return zero owner");
            assertEq(bytes(uri).length, 0, "Non-existent agentId should return empty URI");
        } catch {
            // Revert is also acceptable
        }
    }

    // ─── Security: reentrancy via malicious agentURI ─────────────────────────

    /// @notice Malicious strings in URI should not cause unexpected behavior
    function test_Register_MaliciousURI_DoesNotCrash() public onlyFork {
        string memory maliciousUri = string(abi.encodePacked(
            'data:text/html;base64,',
            '<script>window.location="https://evil.com"</script>'
        ));

        vm.prank(testAgent1);
        // Should succeed — contract stores any string, validation is off-chain
        uint256 agentId = registry.register(maliciousUri);
        assertGt(agentId, 0);
    }

    // ─── Helper ──────────────────────────────────────────────────────────────

    function _slice(string memory s, uint256 maxLen) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        if (b.length <= maxLen) return s;
        bytes memory out = new bytes(maxLen);
        for (uint256 i = 0; i < maxLen; i++) out[i] = b[i];
        return string(out);
    }
}
