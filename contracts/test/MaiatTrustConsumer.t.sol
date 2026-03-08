// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {MaiatTrustConsumer} from "../src/MaiatTrustConsumer.sol";
import {IERC165} from "openzeppelin-contracts/contracts/utils/introspection/IERC165.sol";

// ─── Interfaces (mirrored from MaiatTrustConsumer.sol) ─────────────────────────

/// @dev Chainlink IReceiver interface as declared in MaiatTrustConsumer
interface IReceiver is IERC165 {
    function onReport(bytes calldata metadata, bytes calldata report) external;
}

// ─── MockOracle ─────────────────────────────────────────────────────────────────

/// @notice Mock oracle that accepts batchUpdateTokenScores WITHOUT DataSource param
///         (matches MaiatTrustConsumer's internal ITrustScoreOracle interface)
contract MockOracle {
    uint256 public callCount;
    address[] public lastTokens;
    uint256[] public lastScores;

    function updateTokenScore(
        address,
        uint256,
        uint256,
        uint256
    ) external {}

    function batchUpdateTokenScores(
        address[] calldata tokens,
        uint256[] calldata scores,
        uint256[] calldata,
        uint256[] calldata
    ) external {
        callCount++;
        delete lastTokens;
        delete lastScores;
        for (uint256 i = 0; i < tokens.length; i++) {
            lastTokens.push(tokens[i]);
            lastScores.push(scores[i]);
        }
    }
}

// ─── MaiatTrustConsumerTest ──────────────────────────────────────────────────────

contract MaiatTrustConsumerTest is Test {
    MaiatTrustConsumer public consumer;
    MockOracle public mockOracle;

    address public owner     = address(this);
    address public forwarder = address(0xF01);
    address public workflowOwner = address(0xBEEF);
    address public attacker  = address(0xBAD);

    bytes32 public constant WORKFLOW_ID   = keccak256("test-workflow");
    bytes10 public constant WORKFLOW_NAME = bytes10("testflow0");

    // ─── Events mirrored for expectEmit ────────────────────────
    event ReportReceived(bytes32 indexed workflowId, uint256 tokensUpdated, uint256 timestamp);
    event ForwarderUpdated(address indexed oldForwarder, address indexed newForwarder);
    event OracleUpdateProposed(address indexed proposedOracle, uint256 executeAfter);
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);
    event ExpectedWorkflowOwnerUpdated(address indexed oldOwner, address indexed newOwner);

    function setUp() public {
        mockOracle = new MockOracle();
        consumer = new MaiatTrustConsumer(
            forwarder,
            address(mockOracle),
            owner,
            workflowOwner
        );
    }

    // ─── Helpers ────────────────────────────────────────────────

    /// @dev Build 62-byte CRE metadata: bytes32 workflowId | bytes10 workflowName | address workflowOwner
    function _buildMetadata(
        bytes32 wfId,
        bytes10 wfName,
        address wfOwner
    ) internal pure returns (bytes memory) {
        return abi.encodePacked(wfId, wfName, wfOwner);
    }

    /// @dev Build ABI-encoded report
    function _buildReport(
        address[] memory tokens,
        uint256[] memory scores,
        uint256[] memory reviewCounts,
        uint256[] memory avgRatings
    ) internal pure returns (bytes memory) {
        return abi.encode(tokens, scores, reviewCounts, avgRatings);
    }

    /// @dev Convenience: single-token report
    function _singleReport(address token, uint256 score) internal pure returns (bytes memory) {
        address[] memory tokens = new address[](1);
        uint256[] memory scores = new uint256[](1);
        uint256[] memory reviewCounts = new uint256[](1);
        uint256[] memory avgRatings = new uint256[](1);
        tokens[0] = token;
        scores[0] = score;
        return _buildReport(tokens, scores, reviewCounts, avgRatings);
    }

    function _validMetadata() internal view returns (bytes memory) {
        return _buildMetadata(WORKFLOW_ID, WORKFLOW_NAME, workflowOwner);
    }

    // ─── Constructor ────────────────────────────────────────────

    function test_Constructor_StoresForwarder() public view {
        assertEq(consumer.forwarder(), forwarder);
    }

    function test_Constructor_StoresOracle() public view {
        assertEq(address(consumer.oracle()), address(mockOracle));
    }

    function test_Constructor_StoresOwner() public view {
        assertEq(consumer.owner(), owner);
    }

    function test_Constructor_StoresWorkflowOwner() public view {
        assertEq(consumer.expectedWorkflowOwner(), workflowOwner);
    }

    function test_Constructor_ZeroForwarderReverts() public {
        vm.expectRevert(MaiatTrustConsumer.MaiatTrustConsumer__ZeroAddress.selector);
        new MaiatTrustConsumer(address(0), address(mockOracle), owner, workflowOwner);
    }

    function test_Constructor_ZeroOracleReverts() public {
        vm.expectRevert(MaiatTrustConsumer.MaiatTrustConsumer__ZeroAddress.selector);
        new MaiatTrustConsumer(forwarder, address(0), owner, workflowOwner);
    }

    function test_Constructor_ZeroOwnerReverts() public {
        // Ownable reverts on zero owner
        vm.expectRevert();
        new MaiatTrustConsumer(forwarder, address(mockOracle), address(0), workflowOwner);
    }

    function test_Constructor_ZeroWorkflowOwner_AllowedForNoCheck() public {
        // address(0) expectedWorkflowOwner is legal (disables check)
        MaiatTrustConsumer c = new MaiatTrustConsumer(forwarder, address(mockOracle), owner, address(0));
        assertEq(c.expectedWorkflowOwner(), address(0));
    }

    function test_Constructor_ReportCountZero() public view {
        assertEq(consumer.reportCount(), 0);
    }

    // ─── supportsInterface ──────────────────────────────────────

    function test_SupportsInterface_IReceiver() public view {
        // IReceiver's interfaceId = XOR of its own declared selectors
        // IReceiver declares onReport(bytes,bytes) in addition to inheriting IERC165
        bytes4 iReceiverInterfaceId = type(IReceiver).interfaceId;
        assertTrue(consumer.supportsInterface(iReceiverInterfaceId));
    }

    function test_SupportsInterface_IERC165() public view {
        assertTrue(consumer.supportsInterface(type(IERC165).interfaceId));
    }

    function test_SupportsInterface_UnknownReturnsFalse() public view {
        assertFalse(consumer.supportsInterface(0xdeadbeef));
    }

    // ─── onReport: success ──────────────────────────────────────

    function test_OnReport_Success() public {
        bytes memory metadata = _validMetadata();
        bytes memory report = _singleReport(address(0x100), 80);

        vm.expectEmit(true, false, false, true);
        emit ReportReceived(WORKFLOW_ID, 1, block.timestamp);

        vm.prank(forwarder);
        consumer.onReport(metadata, report);

        assertEq(consumer.reportCount(), 1);
        assertEq(consumer.lastWorkflowId(), WORKFLOW_ID);
        assertEq(consumer.lastReportTimestamp(), block.timestamp);
        assertEq(consumer.lastReportBlock(WORKFLOW_ID), block.number);
        assertEq(mockOracle.callCount(), 1);
    }

    function test_OnReport_IncrementsReportCount() public {
        bytes memory metadata = _validMetadata();
        bytes memory report = _singleReport(address(0x100), 80);

        vm.prank(forwarder);
        consumer.onReport(metadata, report);
        assertEq(consumer.reportCount(), 1);

        // Roll to next block to avoid duplicate check
        vm.roll(block.number + 1);

        vm.prank(forwarder);
        consumer.onReport(metadata, report);
        assertEq(consumer.reportCount(), 2);
    }

    // ─── onReport: unauthorized forwarder ───────────────────────

    function test_OnReport_UnauthorizedForwarder_Reverts() public {
        bytes memory metadata = _validMetadata();
        bytes memory report = _singleReport(address(0x100), 80);

        vm.prank(attacker);
        vm.expectRevert(
            abi.encodeWithSelector(
                MaiatTrustConsumer.MaiatTrustConsumer__UnauthorizedForwarder.selector,
                attacker
            )
        );
        consumer.onReport(metadata, report);
    }

    function test_OnReport_DirectCall_Reverts() public {
        bytes memory metadata = _validMetadata();
        bytes memory report = _singleReport(address(0x100), 80);

        vm.expectRevert(
            abi.encodeWithSelector(
                MaiatTrustConsumer.MaiatTrustConsumer__UnauthorizedForwarder.selector,
                address(this)
            )
        );
        consumer.onReport(metadata, report);
    }

    // ─── onReport: invalid metadata ─────────────────────────────

    function test_OnReport_MetadataTooShort_Reverts() public {
        bytes memory shortMetadata = abi.encodePacked(WORKFLOW_ID); // only 32 bytes, need 62

        vm.prank(forwarder);
        vm.expectRevert(
            abi.encodeWithSelector(
                MaiatTrustConsumer.MaiatTrustConsumer__InvalidMetadataLength.selector,
                32
            )
        );
        consumer.onReport(shortMetadata, _singleReport(address(0x100), 80));
    }

    function test_OnReport_EmptyMetadata_Reverts() public {
        vm.prank(forwarder);
        vm.expectRevert(
            abi.encodeWithSelector(
                MaiatTrustConsumer.MaiatTrustConsumer__InvalidMetadataLength.selector,
                0
            )
        );
        consumer.onReport(new bytes(0), _singleReport(address(0x100), 80));
    }

    // ─── onReport: wrong workflow owner ─────────────────────────

    function test_OnReport_WrongWorkflowOwner_Reverts() public {
        address wrongOwner = address(0x1234);
        bytes memory metadata = _buildMetadata(WORKFLOW_ID, WORKFLOW_NAME, wrongOwner);

        vm.prank(forwarder);
        vm.expectRevert(
            abi.encodeWithSelector(
                MaiatTrustConsumer.MaiatTrustConsumer__UnauthorizedWorkflowOwner.selector,
                wrongOwner
            )
        );
        consumer.onReport(metadata, _singleReport(address(0x100), 80));
    }

    // ─── onReport: null workflow owner skips check ──────────────

    function test_OnReport_NullExpectedWorkflowOwner_SkipsCheck() public {
        // Deploy consumer with no workflow owner check
        MaiatTrustConsumer openConsumer = new MaiatTrustConsumer(
            forwarder,
            address(mockOracle),
            owner,
            address(0) // no check
        );

        // Report from any workflow owner should succeed
        bytes memory metadata = _buildMetadata(WORKFLOW_ID, WORKFLOW_NAME, address(0xABCD));
        bytes memory report = _singleReport(address(0x100), 80);

        vm.prank(forwarder);
        openConsumer.onReport(metadata, report); // must not revert

        assertEq(openConsumer.reportCount(), 1);
    }

    // ─── onReport: duplicate same block ─────────────────────────

    function test_OnReport_DuplicateSameBlock_Reverts() public {
        bytes memory metadata = _validMetadata();
        bytes memory report = _singleReport(address(0x100), 80);

        vm.prank(forwarder);
        consumer.onReport(metadata, report);

        // Same block → duplicate
        vm.prank(forwarder);
        vm.expectRevert(
            abi.encodeWithSelector(
                MaiatTrustConsumer.MaiatTrustConsumer__DuplicateReport.selector,
                WORKFLOW_ID,
                block.number
            )
        );
        consumer.onReport(metadata, report);
    }

    // ─── onReport: different block succeeds ─────────────────────

    function test_OnReport_DifferentBlock_Succeeds() public {
        bytes memory metadata = _validMetadata();
        bytes memory report = _singleReport(address(0x100), 80);

        vm.prank(forwarder);
        consumer.onReport(metadata, report);
        assertEq(consumer.reportCount(), 1);

        // Roll to next block
        vm.roll(block.number + 1);

        vm.prank(forwarder);
        consumer.onReport(metadata, report);
        assertEq(consumer.reportCount(), 2);
    }

    // ─── setForwarder ────────────────────────────────────────────

    function test_SetForwarder_Success() public {
        address newForwarder = address(0xF02);

        vm.expectEmit(true, true, false, false);
        emit ForwarderUpdated(forwarder, newForwarder);

        consumer.setForwarder(newForwarder);
        assertEq(consumer.forwarder(), newForwarder);
    }

    function test_SetForwarder_ZeroReverts() public {
        vm.expectRevert(MaiatTrustConsumer.MaiatTrustConsumer__ZeroAddress.selector);
        consumer.setForwarder(address(0));
    }

    function test_SetForwarder_NonOwnerReverts() public {
        vm.prank(attacker);
        vm.expectRevert();
        consumer.setForwarder(address(0xF02));
    }

    function test_SetForwarder_NewForwarderCanDeliver() public {
        address newForwarder = address(0xF02);
        consumer.setForwarder(newForwarder);

        bytes memory metadata = _validMetadata();
        bytes memory report = _singleReport(address(0x100), 80);

        // Old forwarder should now be rejected
        vm.prank(forwarder);
        vm.expectRevert(
            abi.encodeWithSelector(
                MaiatTrustConsumer.MaiatTrustConsumer__UnauthorizedForwarder.selector,
                forwarder
            )
        );
        consumer.onReport(metadata, report);

        // New forwarder should succeed
        vm.prank(newForwarder);
        consumer.onReport(metadata, report);
        assertEq(consumer.reportCount(), 1);
    }

    // ─── proposeOracle + executeOracleUpdate ─────────────────────

    function test_ProposeOracle_Success() public {
        address newOracle = address(new MockOracle());
        uint256 expectedExecuteAfter = block.timestamp + consumer.ORACLE_UPDATE_DELAY();

        vm.expectEmit(true, false, false, true);
        emit OracleUpdateProposed(newOracle, expectedExecuteAfter);

        consumer.proposeOracle(newOracle);

        assertEq(consumer.pendingOracle(), newOracle);
        assertEq(consumer.pendingOracleTime(), expectedExecuteAfter);
    }

    function test_ProposeOracle_ZeroReverts() public {
        vm.expectRevert(MaiatTrustConsumer.MaiatTrustConsumer__ZeroAddress.selector);
        consumer.proposeOracle(address(0));
    }

    function test_ProposeOracle_NonOwnerReverts() public {
        // Pre-create oracle so vm.prank isn't consumed by contract creation
        address newOracle = address(new MockOracle());
        vm.prank(attacker);
        vm.expectRevert();
        consumer.proposeOracle(newOracle);
    }

    function test_ExecuteOracleUpdate_SuccessFlow() public {
        address newOracle = address(new MockOracle());
        address oldOracle = address(consumer.oracle());

        consumer.proposeOracle(newOracle);

        // Fast-forward 2 days
        vm.warp(block.timestamp + consumer.ORACLE_UPDATE_DELAY());

        vm.expectEmit(true, true, false, false);
        emit OracleUpdated(oldOracle, newOracle);

        consumer.executeOracleUpdate();

        assertEq(address(consumer.oracle()), newOracle);
        assertEq(consumer.pendingOracle(), address(0));
        assertEq(consumer.pendingOracleTime(), 0);
    }

    function test_ExecuteOracleUpdate_NoPendingReverts() public {
        vm.expectRevert(MaiatTrustConsumer.MaiatTrustConsumer__NoOraclePending.selector);
        consumer.executeOracleUpdate();
    }

    function test_ExecuteOracleUpdate_TimelockNotExpiredReverts() public {
        address newOracle = address(new MockOracle());
        consumer.proposeOracle(newOracle);

        // Only 1 day elapsed — not enough
        vm.warp(block.timestamp + 1 days);

        uint256 executeAfter = consumer.pendingOracleTime();
        vm.expectRevert(
            abi.encodeWithSelector(
                MaiatTrustConsumer.MaiatTrustConsumer__OracleTimelockNotExpired.selector,
                executeAfter
            )
        );
        consumer.executeOracleUpdate();
    }

    function test_ExecuteOracleUpdate_ExactlyAtTimelock_Succeeds() public {
        address newOracle = address(new MockOracle());
        consumer.proposeOracle(newOracle);

        // Exactly at the timelock boundary
        vm.warp(consumer.pendingOracleTime());
        consumer.executeOracleUpdate();

        assertEq(address(consumer.oracle()), newOracle);
    }

    function test_ExecuteOracleUpdate_NonOwnerReverts() public {
        address newOracle = address(new MockOracle());
        consumer.proposeOracle(newOracle);
        vm.warp(block.timestamp + consumer.ORACLE_UPDATE_DELAY());

        vm.prank(attacker);
        vm.expectRevert();
        consumer.executeOracleUpdate();
    }

    // ─── setExpectedWorkflowOwner ────────────────────────────────

    function test_SetExpectedWorkflowOwner_Success() public {
        address newOwner = address(0x5678);
        address oldOwner = consumer.expectedWorkflowOwner();

        vm.expectEmit(true, true, false, false);
        emit ExpectedWorkflowOwnerUpdated(oldOwner, newOwner);

        consumer.setExpectedWorkflowOwner(newOwner);
        assertEq(consumer.expectedWorkflowOwner(), newOwner);
    }

    function test_SetExpectedWorkflowOwner_ToZeroDisablesCheck() public {
        consumer.setExpectedWorkflowOwner(address(0));
        assertEq(consumer.expectedWorkflowOwner(), address(0));

        // Now any workflow owner passes
        bytes memory metadata = _buildMetadata(WORKFLOW_ID, WORKFLOW_NAME, address(0xDEAD));
        vm.prank(forwarder);
        consumer.onReport(metadata, _singleReport(address(0x100), 80));
        assertEq(consumer.reportCount(), 1);
    }

    function test_SetExpectedWorkflowOwner_NonOwnerReverts() public {
        vm.prank(attacker);
        vm.expectRevert();
        consumer.setExpectedWorkflowOwner(address(0x5678));
    }

    function test_SetExpectedWorkflowOwner_ThenOnReportEnforcesNewOwner() public {
        address newExpected = address(0x9999);
        consumer.setExpectedWorkflowOwner(newExpected);

        // Old workflowOwner should now be rejected
        bytes memory oldMetadata = _validMetadata(); // workflowOwner = workflowOwner (old)
        vm.prank(forwarder);
        vm.expectRevert(
            abi.encodeWithSelector(
                MaiatTrustConsumer.MaiatTrustConsumer__UnauthorizedWorkflowOwner.selector,
                workflowOwner
            )
        );
        consumer.onReport(oldMetadata, _singleReport(address(0x100), 80));

        // New expected owner should succeed
        bytes memory newMetadata = _buildMetadata(WORKFLOW_ID, WORKFLOW_NAME, newExpected);
        vm.prank(forwarder);
        consumer.onReport(newMetadata, _singleReport(address(0x100), 80));
        assertEq(consumer.reportCount(), 1);
    }

    // ─── Fuzz ────────────────────────────────────────────────────

    function testFuzz_OnReport_MetadataTooShort(uint8 length) public {
        // Only test lengths strictly less than 62
        vm.assume(length < 62);
        bytes memory shortMeta = new bytes(length);

        vm.prank(forwarder);
        vm.expectRevert(
            abi.encodeWithSelector(
                MaiatTrustConsumer.MaiatTrustConsumer__InvalidMetadataLength.selector,
                uint256(length)
            )
        );
        consumer.onReport(shortMeta, _singleReport(address(0x100), 80));
    }

    function testFuzz_OnReport_BatchSize(uint8 size) public {
        // Test with batches of varying size (0–50)
        uint256 batchSize = bound(uint256(size), 0, 50);

        address[] memory tokens      = new address[](batchSize);
        uint256[] memory scores      = new uint256[](batchSize);
        uint256[] memory reviewCounts = new uint256[](batchSize);
        uint256[] memory avgRatings  = new uint256[](batchSize);

        for (uint256 i = 0; i < batchSize; i++) {
            tokens[i]       = address(uint160(i + 1));
            scores[i]       = 50;
            reviewCounts[i] = 10;
            avgRatings[i]   = 400;
        }

        bytes memory metadata = _validMetadata();
        bytes memory report   = _buildReport(tokens, scores, reviewCounts, avgRatings);

        vm.prank(forwarder);
        consumer.onReport(metadata, report);

        assertEq(consumer.reportCount(), 1);
        assertEq(mockOracle.callCount(), 1);
    }
}
