"""
EvaluatorRegistry contract interaction client.

The EvaluatorRegistry tracks the historical performance of evaluator contracts
participating in the ERC-8183 Agentic Commerce protocol.  Every time a
``TrustBasedEvaluator`` (or any other EvaluatorRegistry-aware evaluator)
completes or rejects a job, it calls ``recordOutcome()`` here.

This creates a feedback loop: the registry accumulates per-evaluator approve/
reject counts that can be used for:
- Performance monitoring and alerting
- Governance / slashing logic
- Evaluator selection when multiple evaluators are available

Architecture
------------
  TrustBasedEvaluator.evaluate(jobId)
       ↓
  complete/reject called on ACP
       ↓
  IEvaluatorRegistry.recordOutcome(evaluator, approved)
       ↓
  EvaluatorRegistry stores (approved_count, rejected_count) per evaluator
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any

from web3 import Web3
from web3.contract import Contract

from ..core.contract_mixin import ContractClientMixin

if TYPE_CHECKING:
    from ..wallets.wallet_provider import WalletProvider

logger = logging.getLogger(__name__)


# ── Public types ───────────────────────────────────────────────────────────────


@dataclass
class EvaluatorStats:
    """Performance statistics for an evaluator address."""

    evaluator: str
    approved: int
    """Number of jobs this evaluator has approved (completed)."""
    rejected: int
    """Number of jobs this evaluator has rejected."""
    total: int
    """Total number of jobs evaluated (approved + rejected)."""

    @property
    def approval_rate(self) -> float:
        """Approval rate in [0.0, 1.0].  Returns 0.0 if no evaluations yet."""
        if self.total == 0:
            return 0.0
        return self.approved / self.total


# ── ABI loader ────────────────────────────────────────────────────────────────


def _load_evaluator_registry_abi() -> list:
    abi_path = Path(__file__).parent / "abis" / "EvaluatorRegistry.json"
    try:
        with open(abi_path) as f:
            return json.load(f)
    except FileNotFoundError:
        raise RuntimeError(f"ABI file not found: {abi_path}") from None
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Invalid JSON in ABI file {abi_path}: {e}") from e


# ── Main client ───────────────────────────────────────────────────────────────


class EvaluatorRegistryClient(ContractClientMixin):
    """
    Python client for the EvaluatorRegistry contract.

    Used by evaluators to record job outcomes and by monitoring tools to
    query per-evaluator performance statistics.

    Usage::

        from web3 import Web3
        from bnbagent.apex.evaluator_registry_client import EvaluatorRegistryClient

        client = EvaluatorRegistryClient(
            web3=Web3(Web3.HTTPProvider("https://bsc-dataseed.binance.org/")),
            contract_address="0xYourEvaluatorRegistryContract",
            private_key="0xYourPrivateKey",
        )

        # Get performance stats for an evaluator
        stats = client.get_stats("0xEvaluatorAddress")
        print(f"Approved: {stats.approved}, Rejected: {stats.rejected}")
        print(f"Approval rate: {stats.approval_rate:.1%}")

        # Record an outcome (typically called by the evaluator contract itself)
        client.record_outcome(evaluator="0xEvaluatorAddress", approved=True)
    """

    def __init__(
        self,
        web3: Web3,
        contract_address: str,
        private_key: str | None = None,
        abi: list | None = None,
        wallet_provider: WalletProvider | None = None,
    ):
        """
        Initialise the EvaluatorRegistry client.

        Args:
            web3: Connected Web3 instance.
            contract_address: Address of the deployed EvaluatorRegistry contract.
            private_key: Hex-encoded private key for signing transactions (optional).
            abi: Override ABI (defaults to ``abis/EvaluatorRegistry.json``).
            wallet_provider: WalletProvider for signing (preferred over private_key).
        """
        self.w3 = web3
        self.address = Web3.to_checksum_address(contract_address)

        if abi is None:
            abi = _load_evaluator_registry_abi()

        self.contract: Contract = self.w3.eth.contract(address=self.address, abi=abi)
        self._private_key = private_key
        self._wallet_provider = wallet_provider
        if wallet_provider is not None:
            self._account = wallet_provider.address
        else:
            self._account = (
                self.w3.eth.account.from_key(private_key).address if private_key else None
            )

    def _send_tx(self, fn, value: int = 0, gas: int = 100_000) -> dict[str, Any]:
        """Override default gas limit (100k sufficient for registry writes)."""
        return super()._send_tx(fn, value=value, gas=gas)

    # ── Query functions ───────────────────────────────────────────────────────

    def get_stats(self, evaluator: str) -> EvaluatorStats:
        """
        Fetch approve/reject statistics for an evaluator address.

        Calls the ``getStats(address)`` view function which returns approved,
        rejected, and total counts in a single round-trip.

        Args:
            evaluator: Address of the evaluator contract.

        Returns:
            EvaluatorStats dataclass.
        """
        evaluator = Web3.to_checksum_address(evaluator)
        result = self._call_with_retry(self.contract.functions.getStats(evaluator))
        approved = int(result[0])
        rejected = int(result[1])
        total = int(result[2])
        logger.debug(
            "[EvaluatorRegistry] stats(%s): approved=%d, rejected=%d, total=%d",
            evaluator,
            approved,
            rejected,
            total,
        )
        return EvaluatorStats(
            evaluator=evaluator,
            approved=approved,
            rejected=rejected,
            total=total,
        )

    def get_approved_count(self, evaluator: str) -> int:
        """
        Get the number of jobs approved by an evaluator.

        Args:
            evaluator: Address of the evaluator contract.

        Returns:
            Approved job count.
        """
        evaluator = Web3.to_checksum_address(evaluator)
        return int(self._call_with_retry(self.contract.functions.getApprovedCount(evaluator)))

    def get_rejected_count(self, evaluator: str) -> int:
        """
        Get the number of jobs rejected by an evaluator.

        Args:
            evaluator: Address of the evaluator contract.

        Returns:
            Rejected job count.
        """
        evaluator = Web3.to_checksum_address(evaluator)
        return int(self._call_with_retry(self.contract.functions.getRejectedCount(evaluator)))

    # ── Write functions ───────────────────────────────────────────────────────

    def record_outcome(self, evaluator: str, approved: bool) -> dict[str, Any]:
        """
        Record a job outcome for an evaluator (authorized callers only).

        In normal operation this is called by the TrustBasedEvaluator contract
        itself after each evaluation.  Call directly only for off-chain
        bookkeeping or testing.

        Args:
            evaluator: Address of the evaluator that produced the outcome.
            approved: True if the job was completed, False if rejected.

        Returns:
            Transaction receipt dict with transactionHash, status, receipt.
        """
        evaluator = Web3.to_checksum_address(evaluator)
        fn = self.contract.functions.recordOutcome(evaluator, approved)
        result = self._send_tx(fn)
        logger.info(
            "[EvaluatorRegistry] recordOutcome(%s, approved=%s) | tx=%s",
            evaluator,
            approved,
            result["transactionHash"],
        )
        return result
