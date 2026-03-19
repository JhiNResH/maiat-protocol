// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @title MaiatACPHook
 * @notice ERC-8183 IACPHook implementation — trust-gated job lifecycle.
 *         Intercepts fund/submit/complete/reject transitions to enforce trust checks
 *         and record outcomes for Maiat's trust oracle.
 *
 *         Hook points:
 *         - beforeAction(fund)    → Check client trust score, block low-trust buyers
 *         - beforeAction(submit)  → Check provider trust score
 *         - afterAction(complete) → Record positive outcome, emit for off-chain indexing
 *         - afterAction(reject)   → Record negative outcome
 *
 * @dev Implements IACPHook from erc-8183/base-contracts reference implementation.
 *      Must be whitelisted via AgenticCommerce.setHookWhitelist(address, true) by admin.
 * @custom:security-contact security@maiat.xyz
 */

import {Ownable2Step, Ownable} from "openzeppelin-contracts/contracts/access/Ownable2Step.sol";
import {IERC165} from "openzeppelin-contracts/contracts/utils/introspection/IERC165.sol";

/// @notice Minimal IACPHook interface from ERC-8183 reference
interface IACPHook is IERC165 {
    function beforeAction(uint256 jobId, bytes4 selector, bytes calldata data) external;
    function afterAction(uint256 jobId, bytes4 selector, bytes calldata data) external;
}

/// @notice Minimal interface for reading trust scores
interface ITrustOracle {
    struct UserReputation {
        uint256 reputationScore;
        uint256 totalReviews;
        uint256 scarabPoints;
        uint256 feeBps;
        bool initialized;
        uint256 lastUpdated;
    }
    function getUserData(address user) external view returns (UserReputation memory);
}

/// @notice Minimal interface to read job data from AgenticCommerce
interface IAgenticCommerceReader {
    struct Job {
        uint256 id;
        address client;
        address provider;
        address evaluator;
        string description;
        uint256 budget;
        uint256 expiredAt;
        uint8 status;
        address hook;
    }
    function getJob(uint256 jobId) external view returns (Job memory);
}

/*//////////////////////////////////////////////////////////////
                        ERRORS
//////////////////////////////////////////////////////////////*/

error MaiatACPHook__ClientTrustTooLow(uint256 jobId, address client, uint256 score, uint256 threshold);
error MaiatACPHook__ProviderTrustTooLow(uint256 jobId, address provider, uint256 score, uint256 threshold);
error MaiatACPHook__ClientNotInitialized(uint256 jobId, address client);
error MaiatACPHook__ZeroAddress();
error MaiatACPHook__ThresholdOutOfRange(uint256 value);

/*//////////////////////////////////////////////////////////////
                        CONTRACT
//////////////////////////////////////////////////////////////*/

contract MaiatACPHook is IACPHook, Ownable2Step {

    /*//////////////////////////////////////////////////////////////
                            CONSTANTS
    //////////////////////////////////////////////////////////////*/

    uint256 public constant MAX_SCORE = 100;

    /// @dev AgenticCommerce function selectors we care about
    /// These match the reference implementation's function signatures
    bytes4 public constant FUND_SELECTOR = bytes4(keccak256("fund(uint256,bytes)"));
    bytes4 public constant SUBMIT_SELECTOR = bytes4(keccak256("submit(uint256,bytes32,bytes)"));
    bytes4 public constant COMPLETE_SELECTOR = bytes4(keccak256("complete(uint256,bytes32,bytes)"));
    bytes4 public constant REJECT_SELECTOR = bytes4(keccak256("reject(uint256,bytes32,bytes)"));
    bytes4 public constant SET_BUDGET_SELECTOR = bytes4(keccak256("setBudget(uint256,uint256,bytes)"));

    /*//////////////////////////////////////////////////////////////
                            STATE
    //////////////////////////////////////////////////////////////*/

    /// @notice Trust score oracle
    ITrustOracle public oracle;

    /// @notice AgenticCommerce contract (to read job data)
    IAgenticCommerceReader public acpContract;

    /// @notice Minimum client trust score to fund a job (0-100)
    uint256 public clientThreshold;

    /// @notice Minimum provider trust score to submit work (0-100)
    uint256 public providerThreshold;

    /// @notice Whether to allow uninitialized users (new agents with no history)
    bool public allowUninitialized;

    /// @notice Total jobs processed through this hook
    uint256 public totalFundGated;
    uint256 public totalCompleted;
    uint256 public totalRejected;

    /*//////////////////////////////////////////////////////////////
                            EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted when a fund action is gated (checked and passed)
    event FundGated(uint256 indexed jobId, address indexed client, uint256 score, bool allowed);

    /// @notice Emitted when a submit action is checked
    event SubmitChecked(uint256 indexed jobId, address indexed provider, uint256 score, bool allowed);

    /// @notice Emitted after job completion — off-chain indexer picks this up
    event JobOutcomeRecorded(
        uint256 indexed jobId,
        address indexed provider,
        address indexed client,
        bool completed,
        uint256 providerScore,
        uint256 clientScore
    );

    /// @notice Config updated
    event ThresholdsUpdated(uint256 clientThreshold, uint256 providerThreshold);
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);
    event ACPContractUpdated(address indexed oldAcp, address indexed newAcp);

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(
        address _oracle,
        address _acpContract,
        uint256 _clientThreshold,
        uint256 _providerThreshold,
        bool _allowUninitialized,
        address _owner
    ) Ownable(_owner) {
        if (_oracle == address(0) || _acpContract == address(0)) revert MaiatACPHook__ZeroAddress();
        if (_clientThreshold > MAX_SCORE) revert MaiatACPHook__ThresholdOutOfRange(_clientThreshold);
        if (_providerThreshold > MAX_SCORE) revert MaiatACPHook__ThresholdOutOfRange(_providerThreshold);

        oracle = ITrustOracle(_oracle);
        acpContract = IAgenticCommerceReader(_acpContract);
        clientThreshold = _clientThreshold;
        providerThreshold = _providerThreshold;
        allowUninitialized = _allowUninitialized;
    }

    /*//////////////////////////////////////////////////////////////
                    IACPHook: beforeAction
    //////////////////////////////////////////////////////////////*/

    /// @notice Called BEFORE state transitions. Can revert to block.
    /// @dev Gates fund() by checking client trust score.
    ///      Gates submit() by checking provider trust score.
    function beforeAction(uint256 jobId, bytes4 selector, bytes calldata data) external override {
        if (selector == FUND_SELECTOR) {
            _checkClientTrust(jobId, data);
        } else if (selector == SUBMIT_SELECTOR) {
            _checkProviderTrust(jobId, data);
        }
        // setBudget, etc. — pass through without gating
    }

    /*//////////////////////////////////////////////////////////////
                    IACPHook: afterAction
    //////////////////////////////////////////////////////////////*/

    /// @notice Called AFTER state transitions. Records outcomes for indexing.
    function afterAction(uint256 jobId, bytes4 selector, bytes calldata /* data */) external override {
        if (selector == COMPLETE_SELECTOR) {
            _recordOutcome(jobId, true);
        } else if (selector == REJECT_SELECTOR) {
            _recordOutcome(jobId, false);
        }
    }

    /*//////////////////////////////////////////////////////////////
                    ERC-165: supportsInterface
    //////////////////////////////////////////////////////////////*/

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IACPHook).interfaceId || interfaceId == type(IERC165).interfaceId;
    }

    /*//////////////////////////////////////////////////////////////
                    INTERNAL: Trust Checks
    //////////////////////////////////////////////////////////////*/

    function _checkClientTrust(uint256 jobId, bytes calldata data) internal {
        // data = abi.encode(caller, optParams) per 8183 spec
        (address caller,) = abi.decode(data, (address, bytes));

        ITrustOracle.UserReputation memory rep = oracle.getUserData(caller);

        uint256 score = rep.initialized ? rep.reputationScore : 0;
        uint256 cappedScore = score > MAX_SCORE ? MAX_SCORE : score;

        if (!rep.initialized && !allowUninitialized) {
            revert MaiatACPHook__ClientNotInitialized(jobId, caller);
        } else if (rep.initialized && cappedScore < clientThreshold) {
            emit FundGated(jobId, caller, cappedScore, false);
            revert MaiatACPHook__ClientTrustTooLow(jobId, caller, cappedScore, clientThreshold);
        }

        totalFundGated++;
        emit FundGated(jobId, caller, cappedScore, true);
    }

    function _checkProviderTrust(uint256 jobId, bytes calldata data) internal {
        (address caller,,) = abi.decode(data, (address, bytes32, bytes));

        ITrustOracle.UserReputation memory rep = oracle.getUserData(caller);

        uint256 score = rep.initialized ? rep.reputationScore : 0;
        uint256 cappedScore = score > MAX_SCORE ? MAX_SCORE : score;

        if (rep.initialized && cappedScore < providerThreshold) {
            emit SubmitChecked(jobId, caller, cappedScore, false);
            revert MaiatACPHook__ProviderTrustTooLow(jobId, caller, cappedScore, providerThreshold);
        }

        emit SubmitChecked(jobId, caller, cappedScore, true);
    }

    /*//////////////////////////////////////////////////////////////
                    INTERNAL: Outcome Recording
    //////////////////////////////////////////////////////////////*/

    function _recordOutcome(uint256 jobId, bool completed) internal {
        // Read job data to get provider and client addresses
        IAgenticCommerceReader.Job memory job = acpContract.getJob(jobId);

        // Get current scores for both parties
        ITrustOracle.UserReputation memory providerRep = oracle.getUserData(job.provider);
        ITrustOracle.UserReputation memory clientRep = oracle.getUserData(job.client);

        uint256 providerScore = providerRep.initialized ? providerRep.reputationScore : 0;
        uint256 clientScore = clientRep.initialized ? clientRep.reputationScore : 0;

        if (completed) {
            totalCompleted++;
        } else {
            totalRejected++;
        }

        // Emit event — off-chain indexer (Wadjet) picks this up for ML training
        emit JobOutcomeRecorded(
            jobId,
            job.provider,
            job.client,
            completed,
            providerScore,
            clientScore
        );
    }

    /*//////////////////////////////////////////////////////////////
                    ADMIN: Configuration
    //////////////////////////////////////////////////////////////*/

    function setThresholds(uint256 _clientThreshold, uint256 _providerThreshold) external onlyOwner {
        if (_clientThreshold > MAX_SCORE) revert MaiatACPHook__ThresholdOutOfRange(_clientThreshold);
        if (_providerThreshold > MAX_SCORE) revert MaiatACPHook__ThresholdOutOfRange(_providerThreshold);
        clientThreshold = _clientThreshold;
        providerThreshold = _providerThreshold;
        emit ThresholdsUpdated(_clientThreshold, _providerThreshold);
    }

    function setOracle(address _oracle) external onlyOwner {
        if (_oracle == address(0)) revert MaiatACPHook__ZeroAddress();
        address old = address(oracle);
        oracle = ITrustOracle(_oracle);
        emit OracleUpdated(old, _oracle);
    }

    function setACPContract(address _acpContract) external onlyOwner {
        if (_acpContract == address(0)) revert MaiatACPHook__ZeroAddress();
        address old = address(acpContract);
        acpContract = IAgenticCommerceReader(_acpContract);
        emit ACPContractUpdated(old, _acpContract);
    }

    function setAllowUninitialized(bool _allow) external onlyOwner {
        allowUninitialized = _allow;
    }
}
