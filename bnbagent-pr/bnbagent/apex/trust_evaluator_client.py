"""
TrustBased Evaluator contract interaction client.

The TrustBasedEvaluator is a pluggable evaluator for the ERC-8183 Agentic
Commerce protocol.  It enables *instant* (seconds-level) job evaluation based on
on-chain provider trust scores — a fast alternative to the UMA OOv3 evaluator
which requires a mandatory 48-hour liveness window.

Architecture
------------
  Provider submits job
       ↓
  TrustBasedEvaluatorClient.evaluate_job(job_id)
       ↓
  ITrustOracle.getTrustScore(provider_address)   ← on-chain oracle call
       |                                               ↓ fallback (HYBRID mode)
       |                                         HTTP API (off-chain trust data)
       ↓
  score >= threshold?
    Yes → complete(job_id)   bytes32("trust_approved")
    No  → reject(job_id)     bytes32("trust_too_low")

Oracle interface
----------------
Any contract implementing ``ITrustOracle`` can be plugged in::

    interface ITrustOracle {
        function getTrustScore(address user) external view returns (uint256 score);
    }

Returns a uint256 score in [0, 100].  No structs, no proprietary fields.

Operating modes
---------------
- ``OracleMode.ON_CHAIN`` — trust data fetched only from the on-chain oracle.
- ``OracleMode.HYBRID``   — on-chain first; if oracle returns 0 / unregistered,
  fall back to an off-chain HTTP API for an estimated score.

Off-chain fallback API contract
--------------------------------
The HTTP API must respond to::

    GET /trust/{address}
    → {"score": 75, "initialized": true}

Default endpoint: https://api.maiat.xyz/trust
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import TYPE_CHECKING, Any

from web3 import Web3
from web3.contract import Contract

from ..core.contract_mixin import ContractClientMixin

if TYPE_CHECKING:
    from ..wallets.wallet_provider import WalletProvider

logger = logging.getLogger(__name__)

# ── Default configuration ──────────────────────────────────────────────────────

#: Default trust score threshold (0-100).  Providers must meet or exceed this.
DEFAULT_THRESHOLD: int = 60

#: Default off-chain fallback API endpoint.
DEFAULT_OFFCHAIN_API_URL: str = "https://api.maiat.xyz/trust"

#: HTTP timeout in seconds for off-chain API calls.
DEFAULT_API_TIMEOUT: int = 5

#: Reason bytes returned to the ACP contract on approval.
REASON_TRUST_APPROVED: bytes = b"trust_approved" + b"\x00" * 18  # right-padded to 32 bytes

#: Reason bytes returned to the ACP contract on rejection.
REASON_TRUST_TOO_LOW: bytes = b"trust_too_low" + b"\x00" * 19  # right-padded to 32 bytes


# ── Public types ───────────────────────────────────────────────────────────────


class OracleMode(str, Enum):
    """Operating mode for trust score resolution."""

    ON_CHAIN = "on_chain"
    """Trust score fetched exclusively from the on-chain ITrustOracle."""

    HYBRID = "hybrid"
    """On-chain oracle first; falls back to HTTP API when oracle returns 0."""


@dataclass
class TrustScore:
    """Trust score data for a provider address."""

    address: str
    score: int
    """Reputation score in range [0, 100]."""
    initialized: bool
    """False when the oracle has never seen this address (score == 0)."""
    source: str = "on_chain"
    """Either ``on_chain`` or ``off_chain`` (fallback API)."""


@dataclass
class EvaluationResult:
    """Result of a job evaluation."""

    job_id: int
    provider: str
    trust_score: TrustScore
    completed: bool
    """True → job completed (payment released); False → job rejected (refunded)."""
    reason: bytes
    """32-byte reason code passed to the ACP contract."""
    tx_hash: str | None = None
    """Transaction hash of the evaluate() call."""


# ── ABI loader ────────────────────────────────────────────────────────────────


def _load_trust_evaluator_abi() -> list:
    abi_path = Path(__file__).parent / "abis" / "TrustScoreEvaluator.json"
    try:
        with open(abi_path) as f:
            return json.load(f)
    except FileNotFoundError:
        raise RuntimeError(f"ABI file not found: {abi_path}") from None
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Invalid JSON in ABI file {abi_path}: {e}") from e


# ── ITrustOracle minimal ABI ──────────────────────────────────────────────────

_TRUST_ORACLE_ABI = [
    {
        "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
        "name": "getTrustScore",
        "outputs": [{"internalType": "uint256", "name": "score", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    }
]


# ── Main client ───────────────────────────────────────────────────────────────


class TrustBasedEvaluatorClient(ContractClientMixin):
    """
    Python client for TrustBased ERC-8183 job evaluation.

    Enables instant job evaluation without liveness delays by querying a
    pluggable on-chain ``ITrustOracle``.  Optionally falls back to an off-chain
    HTTP API when the oracle returns 0 for a provider (HYBRID mode).

    Usage::

        from web3 import Web3
        from bnbagent.apex.trust_evaluator_client import (
            TrustBasedEvaluatorClient,
            OracleMode,
        )

        client = TrustBasedEvaluatorClient(
            web3=Web3(Web3.HTTPProvider("https://bsc-dataseed.binance.org/")),
            contract_address="0xYourTrustBasedEvaluatorContract",
            private_key="0xYourPrivateKey",
            threshold=60,
            mode=OracleMode.ON_CHAIN,
        )

        result = client.evaluate_job(job_id=42)
        print(result.completed, result.trust_score.score)
    """

    def __init__(
        self,
        web3: Web3,
        contract_address: str,
        private_key: str | None = None,
        abi: list | None = None,
        wallet_provider: WalletProvider | None = None,
        *,
        threshold: int = DEFAULT_THRESHOLD,
        mode: OracleMode = OracleMode.ON_CHAIN,
        offchain_api_url: str = DEFAULT_OFFCHAIN_API_URL,
        offchain_api_timeout: int = DEFAULT_API_TIMEOUT,
    ):
        """
        Initialise the TrustBased evaluator client.

        Args:
            web3: Connected Web3 instance.
            contract_address: Address of the deployed TrustBasedEvaluator contract.
            private_key: Hex-encoded private key for signing transactions (optional).
            abi: Override ABI (defaults to ``abis/TrustScoreEvaluator.json``).
            wallet_provider: WalletProvider for signing (preferred over private_key).
            threshold: Minimum trust score [0-100] required to pass evaluation.
            mode: ``OracleMode.ON_CHAIN`` or ``OracleMode.HYBRID``.
            offchain_api_url: Base URL of the off-chain trust API (HYBRID mode).
            offchain_api_timeout: HTTP request timeout in seconds for off-chain calls.
        """
        self.w3 = web3
        self.address = Web3.to_checksum_address(contract_address)

        if abi is None:
            abi = _load_trust_evaluator_abi()

        self.contract: Contract = self.w3.eth.contract(address=self.address, abi=abi)
        self._private_key = private_key
        self._wallet_provider = wallet_provider
        if wallet_provider is not None:
            self._account = wallet_provider.address
        else:
            self._account = (
                self.w3.eth.account.from_key(private_key).address if private_key else None
            )

        if not (0 <= threshold <= 100):
            raise ValueError(f"threshold must be in [0, 100], got {threshold}")

        self.threshold = threshold
        self.mode = mode
        self.offchain_api_url = offchain_api_url.rstrip("/")
        self.offchain_api_timeout = offchain_api_timeout

    def _send_tx(self, fn, value: int = 0, gas: int = 300_000) -> dict[str, Any]:
        """Override default gas limit (300k sufficient for trust evaluator ops)."""
        return super()._send_tx(fn, value=value, gas=gas)

    # ── Core: evaluate ────────────────────────────────────────────────────────

    def evaluate_job(self, job_id: int) -> EvaluationResult:
        """
        Evaluate a submitted ERC-8183 job using the provider's trust score.

        The ``agenticCommerce`` address is fixed in the contract's ``initialize()``
        call — no need to pass it here.  Calls ``evaluate(uint256 jobId)`` on-chain
        which internally calls ``complete()`` or ``reject()`` on the ACP contract.

        Args:
            job_id: The job ID to evaluate.

        Returns:
            EvaluationResult with outcome, trust score, and tx hash.

        Raises:
            RuntimeError: If private_key / wallet_provider not configured.
        """
        acp_address = self.get_agentic_commerce_address()

        # Fetch provider address from the ACP contract
        provider_address = self._get_job_provider(acp_address, job_id)

        logger.info(
            "[TrustEvaluator] Evaluating job %d | provider=%s | mode=%s",
            job_id,
            provider_address,
            self.mode,
        )

        # Resolve trust score (local — for logging/prediction only)
        trust_score = self._resolve_trust_score(provider_address)

        logger.info(
            "[TrustEvaluator] Trust score: %d (initialized=%s, source=%s) | threshold=%d",
            trust_score.score,
            trust_score.initialized,
            trust_score.source,
            self.threshold,
        )

        completed, reason = self._decide(trust_score)

        # Execute on-chain: evaluate(jobId) → complete/reject internally
        fn = self.contract.functions.evaluate(job_id)
        tx_result = self._send_tx(fn)

        logger.info(
            "[TrustEvaluator] Job %d %s | tx=%s",
            job_id,
            "completed" if completed else "rejected",
            tx_result["transactionHash"],
        )

        return EvaluationResult(
            job_id=job_id,
            provider=provider_address,
            trust_score=trust_score,
            completed=completed,
            reason=reason,
            tx_hash=tx_result["transactionHash"],
        )

    def pre_check(self, provider: str) -> tuple[int, bool]:
        """
        Pre-check whether a provider would pass evaluation (read-only, no tx).

        Args:
            provider: Provider wallet address.

        Returns:
            Tuple of (score: int, would_pass: bool).
        """
        provider = Web3.to_checksum_address(provider)
        result = self._call_with_retry(self.contract.functions.preCheck(provider))
        return int(result[0]), bool(result[1])

    # ── Trust score resolution ────────────────────────────────────────────────

    def get_trust_score(self, address: str) -> TrustScore:
        """
        Fetch the trust score for an address from the registered ITrustOracle.

        In ``OracleMode.HYBRID``, also calls the off-chain fallback API when
        the oracle returns 0 for an unknown address.

        Args:
            address: Wallet address to query.

        Returns:
            TrustScore dataclass.
        """
        return self._resolve_trust_score(address)

    def is_trusted(self, address: str, threshold: int | None = None) -> bool:
        """
        Return True if the address's trust score meets the threshold.

        Args:
            address: Wallet address to check.
            threshold: Score threshold; defaults to ``self.threshold``.

        Returns:
            bool — True if score >= threshold.
        """
        effective_threshold = threshold if threshold is not None else self.threshold
        trust = self._resolve_trust_score(address)
        return trust.initialized and trust.score >= effective_threshold

    def _resolve_trust_score(self, address: str) -> TrustScore:
        """Internal: resolve trust score via configured oracle mode."""
        address = Web3.to_checksum_address(address)
        on_chain = self._get_on_chain_score(address)

        if on_chain.initialized or self.mode == OracleMode.ON_CHAIN:
            return on_chain

        # HYBRID mode: oracle has no data — try off-chain API
        logger.debug(
            "[TrustEvaluator] Oracle returned 0 for %s, trying off-chain fallback", address
        )
        try:
            return self._get_offchain_score(address)
        except Exception as exc:
            logger.warning(
                "[TrustEvaluator] Off-chain fallback failed for %s: %s", address, exc
            )
            return on_chain

    def _get_on_chain_score(self, address: str) -> TrustScore:
        """Query ITrustOracle.getTrustScore(address) → uint256."""
        oracle_address = self.get_oracle_address()
        oracle_contract = self.w3.eth.contract(
            address=Web3.to_checksum_address(oracle_address),
            abi=_TRUST_ORACLE_ABI,
        )
        raw_score = int(
            self._call_with_retry(oracle_contract.functions.getTrustScore(address))
        )
        capped_score = min(raw_score, 100)
        return TrustScore(
            address=address,
            score=capped_score,
            initialized=capped_score > 0,
            source="on_chain",
        )

    def _get_offchain_score(self, address: str) -> TrustScore:
        """Call the off-chain trust HTTP API (HYBRID mode fallback)."""
        try:
            import urllib.request

            url = f"{self.offchain_api_url}/{address}"
            req = urllib.request.Request(url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=self.offchain_api_timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except Exception as exc:
            raise RuntimeError(f"Off-chain API request failed: {exc}") from exc

        score = int(data.get("score", 0))
        initialized = bool(data.get("initialized", False))
        return TrustScore(
            address=address,
            score=min(score, 100),
            initialized=initialized,
            source="off_chain",
        )

    def _decide(self, trust_score: TrustScore) -> tuple[bool, bytes]:
        """Mirror on-chain decision logic for local logging/prediction."""
        if trust_score.initialized and trust_score.score >= self.threshold:
            return True, REASON_TRUST_APPROVED
        return False, REASON_TRUST_TOO_LOW

    # ── EvaluatorRegistry integration ─────────────────────────────────────────

    def get_registry_stats(self) -> dict[str, int]:
        """
        Query this evaluator's performance history from the EvaluatorRegistry.

        Returns:
            Dict with ``approved``, ``rejected``, ``total`` keys.
        """
        registry_address = self.get_registry_address()
        from .evaluator_registry_client import EvaluatorRegistryClient  # noqa: PLC0415

        registry = EvaluatorRegistryClient(
            web3=self.w3,
            contract_address=registry_address,
        )
        return registry.get_stats(self.address)

    # ── Owner / config functions ──────────────────────────────────────────────

    def set_oracle(self, oracle_address: str) -> dict[str, Any]:
        """
        Update the ITrustOracle contract address (owner only).

        Args:
            oracle_address: Address of a contract implementing ITrustOracle.

        Returns:
            Transaction receipt dict.
        """
        fn = self.contract.functions.setOracle(Web3.to_checksum_address(oracle_address))
        result = self._send_tx(fn)
        logger.info(
            "[TrustEvaluator] Oracle updated to %s | tx=%s",
            oracle_address,
            result["transactionHash"],
        )
        return result

    def set_threshold(self, threshold: int) -> dict[str, Any]:
        """
        Update the minimum trust score threshold on-chain (owner only).

        Args:
            threshold: New minimum score [0-100].

        Returns:
            Transaction receipt dict.
        """
        if not (0 <= threshold <= 100):
            raise ValueError(f"threshold must be in [0, 100], got {threshold}")
        fn = self.contract.functions.setThreshold(threshold)
        result = self._send_tx(fn)
        logger.info(
            "[TrustEvaluator] Threshold updated to %d | tx=%s",
            threshold,
            result["transactionHash"],
        )
        return result

    def set_registry(self, registry_address: str) -> dict[str, Any]:
        """
        Update the EvaluatorRegistry contract address (owner only).

        Args:
            registry_address: Address of the EvaluatorRegistry contract.

        Returns:
            Transaction receipt dict.
        """
        fn = self.contract.functions.setRegistry(Web3.to_checksum_address(registry_address))
        result = self._send_tx(fn)
        logger.info(
            "[TrustEvaluator] Registry updated to %s | tx=%s",
            registry_address,
            result["transactionHash"],
        )
        return result

    # ── Query functions ───────────────────────────────────────────────────────

    def get_oracle_address(self) -> str:
        """Get the current ITrustOracle contract address."""
        return self._call_with_retry(self.contract.functions.oracle())

    def get_registry_address(self) -> str:
        """Get the current EvaluatorRegistry contract address."""
        return self._call_with_retry(self.contract.functions.registry())

    def get_threshold(self) -> int:
        """Get the current minimum trust score threshold (0-100)."""
        return int(self._call_with_retry(self.contract.functions.threshold()))

    def get_agentic_commerce_address(self) -> str:
        """Get the ERC-8183 AgenticCommerce contract address (fixed at init)."""
        return self._call_with_retry(self.contract.functions.agenticCommerce())

    def is_evaluated(self, job_id: int) -> bool:
        """Check if a job has already been evaluated (prevents double evaluation)."""
        return bool(
            self._call_with_retry(self.contract.functions.evaluated(job_id))
        )

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _get_job_provider(self, acp_address: str, job_id: int) -> str:
        """Fetch provider address from the ACP contract for a given job."""
        minimal_abi = [
            {
                "inputs": [{"internalType": "uint256", "name": "jobId", "type": "uint256"}],
                "name": "getJob",
                "outputs": [
                    {
                        "components": [
                            {"internalType": "uint256", "name": "id",          "type": "uint256"},
                            {"internalType": "address", "name": "client",      "type": "address"},
                            {"internalType": "address", "name": "provider",    "type": "address"},
                            {"internalType": "address", "name": "evaluator",   "type": "address"},
                            {"internalType": "string",  "name": "description", "type": "string"},
                            {"internalType": "uint256", "name": "budget",      "type": "uint256"},
                            {"internalType": "uint256", "name": "expiredAt",   "type": "uint256"},
                            {"internalType": "uint8",   "name": "status",      "type": "uint8"},
                            {"internalType": "address", "name": "hook",        "type": "address"},
                        ],
                        "internalType": "struct IAgenticCommerce.Job",
                        "name": "",
                        "type": "tuple",
                    }
                ],
                "stateMutability": "view",
                "type": "function",
            }
        ]
        acp_contract = self.w3.eth.contract(
            address=Web3.to_checksum_address(acp_address), abi=minimal_abi
        )
        job = self._call_with_retry(acp_contract.functions.getJob(job_id))
        # job is a tuple; provider is index 2
        return Web3.to_checksum_address(job[2])
