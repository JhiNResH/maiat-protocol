// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @title MaiatTrustConsumer
 * @notice CRE consumer contract — receives Chainlink signed reports and updates TrustScoreOracle
 * @dev Implements IReceiver pattern for Chainlink KeystoneForwarder delivery
 * @custom:security-contact security@maiat.xyz
 */

import {IERC165} from "openzeppelin-contracts/contracts/utils/introspection/IERC165.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

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

contract MaiatTrustConsumer is IReceiver, Ownable {

    /*//////////////////////////////////////////////////////////////
                            STATE
    //////////////////////////////////////////////////////////////*/

    ITrustScoreOracle public oracle;
    address public forwarder;

    /// @notice Last report metadata for verification
    bytes32 public lastWorkflowId;
    uint256 public lastReportTimestamp;
    uint256 public reportCount;

    /*//////////////////////////////////////////////////////////////
                            EVENTS
    //////////////////////////////////////////////////////////////*/

    event ReportReceived(bytes32 indexed workflowId, uint256 tokensUpdated, uint256 timestamp);
    event ForwarderUpdated(address indexed oldForwarder, address indexed newForwarder);
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);

    /*//////////////////////////////////////////////////////////////
                            ERRORS
    //////////////////////////////////////////////////////////////*/

    error MaiatTrustConsumer__UnauthorizedForwarder(address caller);
    error MaiatTrustConsumer__ZeroAddress();

    /*//////////////////////////////////////////////////////////////
                          CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(
        address _forwarder,
        address _oracle,
        address _owner
    ) Ownable(_owner) {
        if (_forwarder == address(0) || _oracle == address(0)) revert MaiatTrustConsumer__ZeroAddress();
        forwarder = _forwarder;
        oracle = ITrustScoreOracle(_oracle);
    }

    /*//////////////////////////////////////////////////////////////
                        IReceiver IMPLEMENTATION
    //////////////////////////////////////////////////////////////*/

    /// @notice Called by KeystoneForwarder after validating the CRE report signatures
    /// @param metadata Encoded: bytes32 workflowId, bytes10 workflowName, address workflowOwner
    /// @param report ABI-encoded trust score batch data
    function onReport(bytes calldata metadata, bytes calldata report) external override {
        if (msg.sender != forwarder) revert MaiatTrustConsumer__UnauthorizedForwarder(msg.sender);

        // Decode metadata
        (bytes32 workflowId,,) = _decodeMetadata(metadata);

        // Decode report: batch of (address[] tokens, uint256[] scores, uint256[] reviewCounts, uint256[] avgRatings)
        (
            address[] memory tokens,
            uint256[] memory scores,
            uint256[] memory reviewCounts,
            uint256[] memory avgRatings
        ) = abi.decode(report, (address[], uint256[], uint256[], uint256[]));

        // Forward to TrustScoreOracle
        oracle.batchUpdateTokenScores(tokens, scores, reviewCounts, avgRatings);

        // Update state
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

    function setForwarder(address _forwarder) external onlyOwner {
        if (_forwarder == address(0)) revert MaiatTrustConsumer__ZeroAddress();
        emit ForwarderUpdated(forwarder, _forwarder);
        forwarder = _forwarder;
    }

    function setOracle(address _oracle) external onlyOwner {
        if (_oracle == address(0)) revert MaiatTrustConsumer__ZeroAddress();
        emit OracleUpdated(address(oracle), _oracle);
        oracle = ITrustScoreOracle(_oracle);
    }

    /*//////////////////////////////////////////////////////////////
                            INTERNAL
    //////////////////////////////////////////////////////////////*/

    function _decodeMetadata(bytes calldata metadata)
        internal
        pure
        returns (bytes32 workflowId, bytes10 workflowName, address workflowOwner)
    {
        // metadata is abi.encodePacked(bytes32, bytes10, address)
        // Total: 32 + 10 + 20 = 62 bytes
        workflowId = bytes32(metadata[:32]);
        workflowName = bytes10(metadata[32:42]);
        workflowOwner = address(bytes20(metadata[42:62]));
    }
}
