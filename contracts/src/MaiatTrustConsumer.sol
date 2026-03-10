// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @title MaiatTrustConsumer
 * @notice CRE consumer contract — receives Chainlink signed reports and updates TrustScoreOracle
 * @dev Implements IReceiver pattern for Chainlink KeystoneForwarder delivery
 * @custom:security-contact security@maiat.xyz
 */

import {IERC165} from "openzeppelin-contracts/contracts/utils/introspection/IERC165.sol";
import {Ownable2Step, Ownable} from "openzeppelin-contracts/contracts/access/Ownable2Step.sol";

interface ITrustScoreOracle {
    function updateTokenScore(
        address token,
        uint256 score,
        uint256 reviewCount,
        uint256 avgRating
    ) external;

    function batchUpdateTokenScores(
        address[] calldata tokens,
        uint256[] calldata scores,
        uint256[] calldata reviewCounts,
        uint256[] calldata avgRatings
    ) external;
}

/// @notice Chainlink IReceiver interface
interface IReceiver is IERC165 {
    function onReport(bytes calldata metadata, bytes calldata report) external;
}

contract MaiatTrustConsumer is IReceiver, Ownable2Step {

    /*//////////////////////////////////////////////////////////////
                            STATE
    //////////////////////////////////////////////////////////////*/

    ITrustScoreOracle public oracle;
    address public forwarder;

    /// @notice Expected CRE workflow owner — reports from other owners are rejected
    address public expectedWorkflowOwner;

    /// @notice Tracks last block per workflowId for same-block replay protection
    mapping(bytes32 => uint256) public lastReportBlock;

    /// @notice Last report metadata for verification
    bytes32 public lastWorkflowId;
    uint256 public lastReportTimestamp;
    uint256 public reportCount;

    /// @notice Timelock for oracle updates (2 days)
    uint256 public constant ORACLE_UPDATE_DELAY = 2 days;
    address public pendingOracle;
    uint256 public pendingOracleTime;

    /*//////////////////////////////////////////////////////////////
                            EVENTS
    //////////////////////////////////////////////////////////////*/

    event ReportReceived(bytes32 indexed workflowId, uint256 tokensUpdated, uint256 timestamp);
    event ForwarderUpdated(address indexed oldForwarder, address indexed newForwarder);
    event OracleUpdateProposed(address indexed proposedOracle, uint256 executeAfter);
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);
    event ExpectedWorkflowOwnerUpdated(address indexed oldOwner, address indexed newOwner);

    /*//////////////////////////////////////////////////////////////
                            ERRORS
    //////////////////////////////////////////////////////////////*/

    error MaiatTrustConsumer__UnauthorizedForwarder(address caller);
    error MaiatTrustConsumer__ZeroAddress();
    error MaiatTrustConsumer__InvalidMetadataLength(uint256 length);
    error MaiatTrustConsumer__UnauthorizedWorkflowOwner(address workflowOwner);
    error MaiatTrustConsumer__DuplicateReport(bytes32 workflowId, uint256 blockNumber);
    error MaiatTrustConsumer__NoOraclePending();
    error MaiatTrustConsumer__OracleTimelockNotExpired(uint256 executeAfter);

    /*//////////////////////////////////////////////////////////////
                          CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @param _forwarder  Chainlink KeystoneForwarder address
    /// @param _oracle     TrustScoreOracle address
    /// @param _owner      Contract owner (Ownable2Step)
    /// @param _expectedWorkflowOwner  Expected CRE workflow owner address (address(0) = no check)
    constructor(
        address _forwarder,
        address _oracle,
        address _owner,
        address _expectedWorkflowOwner
    ) Ownable(_owner) {
        if (_forwarder == address(0) || _oracle == address(0)) revert MaiatTrustConsumer__ZeroAddress();
        forwarder = _forwarder;
        oracle = ITrustScoreOracle(_oracle);
        expectedWorkflowOwner = _expectedWorkflowOwner;
    }

    /*//////////////////////////////////////////////////////////////
                        IReceiver IMPLEMENTATION
    //////////////////////////////////////////////////////////////*/

    /// @notice Called by KeystoneForwarder after validating the CRE report signatures
    /// @param metadata Encoded: bytes32 workflowId, bytes10 workflowName, address workflowOwner
    /// @param report ABI-encoded trust score batch data
    function onReport(bytes calldata metadata, bytes calldata report) external override {
        if (msg.sender != forwarder) revert MaiatTrustConsumer__UnauthorizedForwarder(msg.sender);

        // Decode and validate metadata
        (bytes32 workflowId,, address workflowOwner) = _decodeMetadata(metadata);

        // Validate workflow owner if configured
        if (expectedWorkflowOwner != address(0) && workflowOwner != expectedWorkflowOwner) {
            revert MaiatTrustConsumer__UnauthorizedWorkflowOwner(workflowOwner);
        }

        // Same-block replay protection
        if (lastReportBlock[workflowId] == block.number) {
            revert MaiatTrustConsumer__DuplicateReport(workflowId, block.number);
        }

        // Decode report: batch of (address[] tokens, uint256[] scores, uint256[] reviewCounts, uint256[] avgRatings)
        (
            address[] memory tokens,
            uint256[] memory scores,
            uint256[] memory reviewCounts,
            uint256[] memory avgRatings
        ) = abi.decode(report, (address[], uint256[], uint256[], uint256[]));

        // CEI: mark block BEFORE external call to oracle (prevents same-block replay
        // if oracle or a downstream hook ever introduces a callback path).
        lastReportBlock[workflowId] = block.number;

        // Forward to TrustScoreOracle (external call — state already updated above)
        oracle.batchUpdateTokenScores(tokens, scores, reviewCounts, avgRatings);

        lastWorkflowId = workflowId;
        lastReportTimestamp = block.timestamp;
        reportCount++;

        emit ReportReceived(workflowId, tokens.length, block.timestamp);
    }

    /// @notice ERC165 — declare support for IReceiver
    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IReceiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }

    /*//////////////////////////////////////////////////////////////
                            ADMIN
    //////////////////////////////////////////////////////////////*/

    /// @notice Immediately update the forwarder address (owner only)
    function setForwarder(address _forwarder) external onlyOwner {
        if (_forwarder == address(0)) revert MaiatTrustConsumer__ZeroAddress();
        emit ForwarderUpdated(forwarder, _forwarder);
        forwarder = _forwarder;
    }

    /// @notice Propose an oracle update — takes effect after ORACLE_UPDATE_DELAY (2 days)
    function proposeOracle(address _oracle) external onlyOwner {
        if (_oracle == address(0)) revert MaiatTrustConsumer__ZeroAddress();
        pendingOracle = _oracle;
        pendingOracleTime = block.timestamp + ORACLE_UPDATE_DELAY;
        emit OracleUpdateProposed(_oracle, pendingOracleTime);
    }

    /// @notice Execute a previously proposed oracle update after the timelock expires
    function executeOracleUpdate() external onlyOwner {
        if (pendingOracle == address(0)) revert MaiatTrustConsumer__NoOraclePending();
        if (block.timestamp < pendingOracleTime) {
            revert MaiatTrustConsumer__OracleTimelockNotExpired(pendingOracleTime);
        }
        address oldOracle = address(oracle);
        oracle = ITrustScoreOracle(pendingOracle);
        pendingOracle = address(0);
        pendingOracleTime = 0;
        emit OracleUpdated(oldOracle, address(oracle));
    }

    /// @notice Update the expected workflow owner (owner only)
    /// @param _expectedWorkflowOwner Set to address(0) to disable the check
    function setExpectedWorkflowOwner(address _expectedWorkflowOwner) external onlyOwner {
        emit ExpectedWorkflowOwnerUpdated(expectedWorkflowOwner, _expectedWorkflowOwner);
        expectedWorkflowOwner = _expectedWorkflowOwner;
    }

    /*//////////////////////////////////////////////////////////////
                            INTERNAL
    //////////////////////////////////////////////////////////////*/

    /// @dev Decodes Chainlink CRE metadata (abi.encodePacked: bytes32 + bytes10 + address = 62 bytes)
    function _decodeMetadata(bytes calldata metadata)
        internal
        pure
        returns (bytes32 workflowId, bytes10 workflowName, address workflowOwner)
    {
        // metadata is abi.encodePacked(bytes32, bytes10, address)
        // Total: 32 + 10 + 20 = 62 bytes
        if (metadata.length < 62) revert MaiatTrustConsumer__InvalidMetadataLength(metadata.length);
        workflowId = bytes32(metadata[:32]);
        workflowName = bytes10(metadata[32:42]);
        workflowOwner = address(bytes20(metadata[42:62]));
    }
}
