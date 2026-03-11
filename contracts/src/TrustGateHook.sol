// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @custom:security-contact security@maiat.xyz
 */
import {BaseHook} from "./base/BaseHook.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/types/BeforeSwapDelta.sol";
import {LPFeeLibrary} from "v4-core/libraries/LPFeeLibrary.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {SwapParams} from "v4-core/types/PoolOperation.sol";
import {TrustScoreOracle} from "./TrustScoreOracle.sol";
import {Ownable2Step, Ownable} from "openzeppelin-contracts/contracts/access/Ownable2Step.sol";
import {ECDSA} from "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "openzeppelin-contracts/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title TrustGateHook
/// @notice Uniswap V4 hook: trust-gated swaps + reputation-based dynamic fees
/// @dev Two modes of operation:
///
/// MODE 1 — EIP-712 Signed Scores (production, zero oracle gas):
///   Swapper calls Maiat API → gets signed score → includes in hookData.
///   Hook verifies signature on-chain via ecrecover. No oracle lookup needed.
///   This eliminates the need for cron-based oracle updates entirely.
///
/// MODE 2 — Oracle Lookup (fallback):
///   If hookData doesn't contain signed scores, falls back to TrustScoreOracle.
///   Oracle is fed by a cron that pushes Wadjet ML + Protocol scores on-chain.
///
/// Fee tiers (from TrustScoreOracle):
///   Guardian (200+ rep): 0% fee
///   Verified (50+ rep):  0.1% fee
///   Trusted (10+ rep):   0.3% fee
///   New (0-9 rep):       0.5% fee
///
/// hookData format for signed scores (MODE 1):
///   abi.encode(
///     address feeTarget,       // user address for fee discount (or address(0) for sender)
///     uint256 score0,          // trust score for currency0 (0-100)
///     uint256 timestamp0,      // when score0 was signed
///     bytes   signature0,      // EIP-712 signature for (token0, score0, timestamp0)
///     uint256 score1,          // trust score for currency1 (0-100)
///     uint256 timestamp1,      // when score1 was signed
///     bytes   signature1       // EIP-712 signature for (token1, score1, timestamp1)
///   )
///
/// hookData format for legacy fee override (MODE 2):
///   abi.encode(address feeTarget)  // exactly 32 bytes
///
/// @dev SENDER NOTE: `sender` in hook callbacks is the ROUTER, not the end user.
contract TrustGateHook is BaseHook, Ownable2Step {
    using BeforeSwapDeltaLibrary for BeforeSwapDelta;
    using LPFeeLibrary for uint24;
    using ECDSA for bytes32;

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    TrustScoreOracle public immutable oracle;
    uint256 public trustThreshold;

    /// @notice The address authorized to sign trust scores off-chain.
    ///         Set to the Protocol's ORACLE_UPDATER wallet.
    address public trustedSigner;

    address public pendingTrustedSigner;
    uint256 public pendingTrustedSignerTime;

    /// @notice Maximum age of a signed score before it's rejected (5 minutes).
    uint256 public constant SIGNED_SCORE_MAX_AGE = 5 minutes;

    uint256 public constant MIN_THRESHOLD = 1;
    uint256 public constant THRESHOLD_UPDATE_DELAY = 1 days;

    mapping(address => bool) public allowedRouters;

    uint256 public pendingThreshold;
    uint256 public pendingThresholdTime;

    /*//////////////////////////////////////////////////////////////
                           EIP-712 CONSTANTS
    //////////////////////////////////////////////////////////////*/

    bytes32 public constant SCORE_TYPEHASH =
        keccak256("TrustScore(address user,address token,uint256 score,uint256 timestamp,uint256 nonce)");

    bytes32 public immutable DOMAIN_SEPARATOR;

    /// @notice Track used nonces to prevent replay attacks.
    ///         Key: keccak256(token, nonce)
    mapping(bytes32 => bool) public usedNonces;

    /*//////////////////////////////////////////////////////////////
                            HOOKDATA MAGIC
    //////////////////////////////////////////////////////////////*/

    /// @notice hookData length threshold to distinguish signed scores from legacy fee target.
    ///         Legacy: exactly 32 bytes (one abi-encoded address).
    ///         Signed: >> 32 bytes (fee target + 2x score/timestamp/signature).
    uint256 private constant LEGACY_HOOKDATA_LEN = 32;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event TrustGateChecked(address indexed token, uint256 score, bool passed);
    event ThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    event ThresholdProposed(uint256 newThreshold, uint256 executeAfter);
    event DynamicFeeApplied(address indexed router, uint256 feeBps);
    event RouterAllowanceUpdated(address indexed router, bool allowed);
    event TrustedSignerUpdated(address indexed oldSigner, address indexed newSigner);
    /// @notice Emitted when a signed score is verified and used (MODE 1)
    event SignedScoreVerified(address indexed token, uint256 score, address signer);

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error TrustScoreTooLow(address token, uint256 score, uint256 threshold);
    error TrustGateHook__ZeroAddress();
    error TrustGateHook__EthPoolNotSupported();
    error TrustGateHook__NoSignerPending();
    error TrustGateHook__InvalidThreshold(uint256 threshold);
    error TrustGateHook__ThresholdTooLow(uint256 threshold);
    error TrustGateHook__SeedScoreRejected(address token);
    error TrustGateHook__PendingThresholdExists();
    error TrustGateHook__ZeroAddressRouter();
    error TrustGateHook__NoThresholdPending();
    error TrustGateHook__ThresholdTimelockNotExpired(uint256 executeAfter);
    error TrustGateHook__InvalidSignature(address token);
    error TrustGateHook__SignatureExpired(address token, uint256 timestamp, uint256 maxAge);
    error TrustGateHook__NonceAlreadyUsed(address token, uint256 nonce);
    error TrustGateHook__ScoreOutOfRange(uint256 score);

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(
        TrustScoreOracle _oracle,
        IPoolManager _poolManager,
        address initialOwner,
        address _trustedSigner
    )
        BaseHook(_poolManager)
        Ownable(initialOwner)
    {
        if (address(_oracle) == address(0)) revert TrustGateHook__ZeroAddress();
        if (address(_poolManager) == address(0)) revert TrustGateHook__ZeroAddress();
        if (initialOwner == address(0)) revert TrustGateHook__ZeroAddress();
        // trustedSigner can be address(0) to disable signed scores initially

        oracle = _oracle;
        trustThreshold = 30;
        trustedSigner = _trustedSigner;

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("MaiatTrustOracle"),
                keccak256("1"),
                block.chainid,
                address(this)
            )
        );
    }

    /*//////////////////////////////////////////////////////////////
                        HOOK PERMISSIONS
    //////////////////////////////////////////////////////////////*/

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: true,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: false,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    function beforeInitialize(
        address,
        PoolKey calldata key,
        uint160
    ) external pure override returns (bytes4) {
        if (Currency.unwrap(key.currency0) == address(0) || Currency.unwrap(key.currency1) == address(0)) {
            revert TrustGateHook__EthPoolNotSupported();
        }
        return IHooks.beforeInitialize.selector;
    }

    /*//////////////////////////////////////////////////////////////
                        ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function setRouterAllowance(address router, bool allowed) external onlyOwner {
        if (router == address(0)) revert TrustGateHook__ZeroAddressRouter();
        allowedRouters[router] = allowed;
        emit RouterAllowanceUpdated(router, allowed);
    }

    /// @notice Propose a new trusted signer for EIP-712 signed scores.
    function proposeTrustedSigner(address newSigner) external onlyOwner {
        pendingTrustedSigner = newSigner;
        pendingTrustedSignerTime = block.timestamp + THRESHOLD_UPDATE_DELAY;
    }

    /// @notice Execute the trusted signer update after timelock.
    function executeTrustedSignerUpdate() external onlyOwner {
        if (pendingTrustedSignerTime == 0) revert TrustGateHook__NoSignerPending();
        if (block.timestamp < pendingTrustedSignerTime) {
            revert TrustGateHook__ThresholdTimelockNotExpired(pendingTrustedSignerTime);
        }
        address old = trustedSigner;
        trustedSigner = pendingTrustedSigner;
        pendingTrustedSignerTime = 0;
        emit TrustedSignerUpdated(old, trustedSigner);
    }

    function proposeThreshold(uint256 newThreshold) external onlyOwner {
        if (pendingThreshold != 0) revert TrustGateHook__PendingThresholdExists();
        if (newThreshold > 100) revert TrustGateHook__InvalidThreshold(newThreshold);
        if (newThreshold < MIN_THRESHOLD) revert TrustGateHook__ThresholdTooLow(newThreshold);
        pendingThreshold = newThreshold;
        pendingThresholdTime = block.timestamp + THRESHOLD_UPDATE_DELAY;
        emit ThresholdProposed(newThreshold, pendingThresholdTime);
    }

    function executeThresholdUpdate() external onlyOwner {
        if (pendingThreshold == 0) revert TrustGateHook__NoThresholdPending();
        if (block.timestamp < pendingThresholdTime) {
            revert TrustGateHook__ThresholdTimelockNotExpired(pendingThresholdTime);
        }
        uint256 old = trustThreshold;
        trustThreshold = pendingThreshold;
        pendingThreshold = 0;
        pendingThresholdTime = 0;
        emit ThresholdUpdated(old, trustThreshold);
    }

    function cancelThresholdProposal() external onlyOwner {
        if (pendingThreshold == 0) revert TrustGateHook__NoThresholdPending();
        pendingThreshold = 0;
        pendingThresholdTime = 0;
    }

    /*//////////////////////////////////////////////////////////////
                           EIP-712 VERIFICATION
    //////////////////////////////////////////////////////////////*/

    /// @notice Verify an EIP-712 signed trust score.
    /// @param token The token address the score applies to
    /// @param score The trust score (0-100)
    /// @param timestamp When the score was signed
    /// @param nonce Unique nonce for replay protection
    /// @param signature 65-byte ECDSA signature
    /// @return True if signature is valid and from trustedSigner
    function _verifySignedScore(
        address user,
        address token,
        uint256 score,
        uint256 timestamp,
        uint256 nonce,
        bytes memory signature
    ) internal returns (bool) {
        if (trustedSigner == address(0)) return false;
        if (score > 100) revert TrustGateHook__ScoreOutOfRange(score);

        // Check freshness
        if (timestamp > block.timestamp) {
            revert TrustGateHook__SignatureExpired(token, timestamp, 0); // Future timestamp
        }
        if (block.timestamp > timestamp + SIGNED_SCORE_MAX_AGE) {
            revert TrustGateHook__SignatureExpired(token, timestamp, SIGNED_SCORE_MAX_AGE);
        }

        // Check nonce not reused
        bytes32 nonceKey = keccak256(abi.encodePacked(user, token, nonce));
        if (usedNonces[nonceKey]) {
            revert TrustGateHook__NonceAlreadyUsed(token, nonce);
        }

        // Build EIP-712 digest
        bytes32 structHash = keccak256(
            abi.encode(SCORE_TYPEHASH, user, token, score, timestamp, nonce)
        );
        bytes32 digest = MessageHashUtils.toTypedDataHash(DOMAIN_SEPARATOR, structHash);

        // Recover signer
        address recovered = ECDSA.recover(digest, signature);

        if (recovered != trustedSigner) {
            revert TrustGateHook__InvalidSignature(token);
        }

        // Mark nonce as used
        usedNonces[nonceKey] = true;

        emit SignedScoreVerified(token, score, recovered);
        return true;
    }

    /*//////////////////////////////////////////////////////////////
                        HOOKDATA DECODING
    //////////////////////////////////////////////////////////////*/

    /// @dev Decode signed score hookData.
    ///      Format: abi.encode(address feeTarget, uint256 score0, uint256 ts0,
    ///              bytes sig0, uint256 score1, uint256 ts1, bytes sig1)
    ///      We also accept a simplified format with nonces embedded:
    ///      abi.encode(address feeTarget, uint256 score0, uint256 ts0, uint256 nonce0,
    ///              bytes sig0, uint256 score1, uint256 ts1, uint256 nonce1, bytes sig1)
    struct SignedScoreData {
        address feeTarget;
        uint256 score0;
        uint256 timestamp0;
        uint256 nonce0;
        bytes signature0;
        uint256 score1;
        uint256 timestamp1;
        uint256 nonce1;
        bytes signature1;
    }

    function _decodeSignedHookData(bytes calldata hookData)
        internal
        pure
        returns (SignedScoreData memory data)
    {
        (
            data.feeTarget,
            data.score0,
            data.timestamp0,
            data.nonce0,
            data.signature0,
            data.score1,
            data.timestamp1,
            data.nonce1,
            data.signature1
        ) = abi.decode(hookData, (address, uint256, uint256, uint256, bytes, uint256, uint256, uint256, bytes));
    }

    /*//////////////////////////////////////////////////////////////
                           BEFORE SWAP
    //////////////////////////////////////////////////////////////*/

    /// @notice beforeSwap: trust-gate tokens + apply reputation-based dynamic fee
    /// @dev Two modes based on hookData length:
    ///
    ///   MODE 1 (hookData > 32 bytes): EIP-712 signed scores.
    ///     Decode signed scores from hookData, verify signatures, use verified scores.
    ///     Zero oracle gas — the swapper pays for verification (~5k gas for ecrecover).
    ///
    ///   MODE 2 (hookData <= 32 bytes or empty): Oracle fallback.
    ///     Read scores from TrustScoreOracle. Requires cron to keep oracle fed.
    ///     hookData of exactly 32 bytes = legacy per-user fee target.
    function beforeSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata,
        bytes calldata hookData
    ) external override onlyPoolManager returns (bytes4, BeforeSwapDelta, uint24) {
        address feeTarget = sender;

        // ── MODE 1: EIP-712 Signed Scores ────────────────────────────────────
        if (hookData.length > LEGACY_HOOKDATA_LEN && trustedSigner != address(0)) {
            SignedScoreData memory sd = _decodeSignedHookData(hookData);

            if (sd.feeTarget != address(0) && allowedRouters[sender]) {
                feeTarget = sd.feeTarget;
            }

            // Verify + gate currency0
            address token0 = Currency.unwrap(key.currency0);
            if (token0 != address(0)) {
                _verifySignedScore(feeTarget, token0, sd.score0, sd.timestamp0, sd.nonce0, sd.signature0);
                if (sd.score0 < trustThreshold) {
                    revert TrustScoreTooLow(token0, sd.score0, trustThreshold);
                }
                emit TrustGateChecked(token0, sd.score0, true);
            }

            // Verify + gate currency1
            address token1 = Currency.unwrap(key.currency1);
            if (token1 != address(0)) {
                _verifySignedScore(feeTarget, token1, sd.score1, sd.timestamp1, sd.nonce1, sd.signature1);
                if (sd.score1 < trustThreshold) {
                    revert TrustScoreTooLow(token1, sd.score1, trustThreshold);
                }
                emit TrustGateChecked(token1, sd.score1, true);
            }
        }
        // ── MODE 2: Oracle Fallback ──────────────────────────────────────────
        else {
            // Check currency0
            address token0 = Currency.unwrap(key.currency0);
            if (token0 != address(0)) {
                uint256 score0;
                try oracle.getScore(token0) returns (uint256 s) {
                    score0 = s;
                } catch (bytes memory reason) {
                    // Only fallback to last known score if the error is StaleScore (0xf28dceb3)
                    if (reason.length >= 4 && bytes4(reason) == TrustScoreOracle.TrustScoreOracle__StaleScore.selector) {
                        score0 = oracle.getTokenData(token0).trustScore;
                        if (score0 == 0) revert TrustScoreTooLow(token0, 0, trustThreshold);
                    } else {
                        assembly {
                            revert(add(reason, 32), mload(reason))
                        }
                    }
                }
                
                if (score0 < trustThreshold) {
                    revert TrustScoreTooLow(token0, score0, trustThreshold);
                }
                if (oracle.getDataSource(token0) == TrustScoreOracle.DataSource.SEED) {
                    revert TrustGateHook__SeedScoreRejected(token0);
                }
                emit TrustGateChecked(token0, score0, true);
            }

            // Check currency1
            address token1 = Currency.unwrap(key.currency1);
            if (token1 != address(0)) {
                uint256 score1;
                try oracle.getScore(token1) returns (uint256 s) {
                    score1 = s;
                } catch (bytes memory reason) {
                    // Fallback to stale score to prevent DoS during oracle downtime
                    if (reason.length >= 4 && bytes4(reason) == TrustScoreOracle.TrustScoreOracle__StaleScore.selector) {
                        score1 = oracle.getTokenData(token1).trustScore;
                        if (score1 == 0) revert TrustScoreTooLow(token1, 0, trustThreshold);
                    } else {
                        assembly {
                            revert(add(reason, 32), mload(reason))
                        }
                    }
                }

                if (score1 < trustThreshold) {
                    revert TrustScoreTooLow(token1, score1, trustThreshold);
                }
                if (oracle.getDataSource(token1) == TrustScoreOracle.DataSource.SEED) {
                    revert TrustGateHook__SeedScoreRejected(token1);
                }
                emit TrustGateChecked(token1, score1, true);
            }

            // Legacy hookData: decode fee target
            if (hookData.length >= 32 && allowedRouters[sender]) {
                feeTarget = abi.decode(hookData, (address));
            }
        }

        // ── Dynamic Fee ──────────────────────────────────────────────────────
        // NOTE: Dynamic fee always reads from the oracle even in MODE 1
        uint256 feeBps = oracle.getUserFee(feeTarget);
        emit DynamicFeeApplied(feeTarget, feeBps);

        uint24 lpFeeOverride = uint24(feeBps * 100) | LPFeeLibrary.OVERRIDE_FEE_FLAG;

        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, lpFeeOverride);
    }
}
