"""
TrustGate ACP Hook contract interaction client.

The TrustGateACPHook is a before-hook for the ERC-8183 Agentic Commerce
protocol.  It is registered on an ACP contract and called before a job is
created.  Providers with a trust score below ``minScore`` are blocked before
they can even enter the job flow.

Architecture
------------
  Client calls createJob(provider, ...)
       ↓
  ACP contract invokes hook.beforeCreateJob(provider, ...)
       ↓
  TrustGateACPHook.beforeCreateJob()
       ↓
  ITrustOracle.getTrustScore(provider)
       |
       ├── score >= minScore  →  continue (job created)
       └── score < minScore   →  revert TrustGateACPHook__ScoreTooLow

Oracle interface
----------------
The hook reads from any ``ITrustOracle`` contract::

    interface ITrustOracle {
        function getTrustScore(address user) external view returns (uint256 score);
    }
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import TYPE_CHECKING, Any

from web3 import Web3
from web3.contract import Contract

from ..core.contract_mixin import ContractClientMixin

if TYPE_CHECKING:
    from ..wallets.wallet_provider import WalletProvider

logger = logging.getLogger(__name__)


# ── ABI loader ────────────────────────────────────────────────────────────────


def _load_trust_gate_hook_abi() -> list:
    abi_path = Path(__file__).parent / "abis" / "TrustGateACPHook.json"
    try:
        with open(abi_path) as f:
            return json.load(f)
    except FileNotFoundError:
        raise RuntimeError(f"ABI file not found: {abi_path}") from None
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Invalid JSON in ABI file {abi_path}: {e}") from e


# ── Main client ───────────────────────────────────────────────────────────────


class TrustGateACPHookClient(ContractClientMixin):
    """
    Python client for the TrustGate ACP Before-Hook contract.

    Used to query and configure the TrustGateACPHook that guards job creation
    in an ERC-8183 AgenticCommerce contract.

    Usage::

        from web3 import Web3
        from bnbagent.apex.trust_gate_hook_client import TrustGateACPHookClient

        client = TrustGateACPHookClient(
            web3=Web3(Web3.HTTPProvider("https://bsc-dataseed.binance.org/")),
            contract_address="0xYourTrustGateHookContract",
            private_key="0xYourPrivateKey",
        )

        # Check if a provider would be allowed
        score, allowed = client.check_provider("0xProviderAddress")
        print(f"score={score}, allowed={allowed}")

        # Update the minimum required score (owner only)
        client.set_min_score(70)
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
        Initialise the TrustGate ACP hook client.

        Args:
            web3: Connected Web3 instance.
            contract_address: Address of the deployed TrustGateACPHook contract.
            private_key: Hex-encoded private key for signing transactions (optional).
            abi: Override ABI (defaults to ``abis/TrustGateACPHook.json``).
            wallet_provider: WalletProvider for signing (preferred over private_key).
        """
        self.w3 = web3
        self.address = Web3.to_checksum_address(contract_address)

        if abi is None:
            abi = _load_trust_gate_hook_abi()

        self.contract: Contract = self.w3.eth.contract(address=self.address, abi=abi)
        self._private_key = private_key
        self._wallet_provider = wallet_provider
        if wallet_provider is not None:
            self._account = wallet_provider.address
        else:
            self._account = (
                self.w3.eth.account.from_key(private_key).address if private_key else None
            )

    def _send_tx(self, fn, value: int = 0, gas: int = 150_000) -> dict[str, Any]:
        """Override default gas limit (150k sufficient for hook config ops)."""
        return super()._send_tx(fn, value=value, gas=gas)

    # ── Query functions ───────────────────────────────────────────────────────

    def check_provider(self, provider: str) -> tuple[int, bool]:
        """
        Check whether a provider would be allowed through the hook (read-only).

        Calls ``checkProvider(address)`` which queries the oracle and compares
        against ``minScore`` — no gas cost.

        Args:
            provider: Provider wallet address to check.

        Returns:
            Tuple of (score: int, allowed: bool).
        """
        provider = Web3.to_checksum_address(provider)
        result = self._call_with_retry(self.contract.functions.checkProvider(provider))
        score = int(result[0])
        allowed = bool(result[1])
        logger.debug(
            "[TrustGateHook] check_provider(%s): score=%d, allowed=%s",
            provider,
            score,
            allowed,
        )
        return score, allowed

    def get_min_score(self) -> int:
        """
        Get the current minimum trust score required to pass the gate.

        Returns:
            Minimum score in [0, 100].
        """
        return int(self._call_with_retry(self.contract.functions.minScore()))

    def get_oracle_address(self) -> str:
        """Get the ITrustOracle contract address used by the hook."""
        return self._call_with_retry(self.contract.functions.oracle())

    def get_owner(self) -> str:
        """Get the current contract owner address."""
        return self._call_with_retry(self.contract.functions.owner())

    # ── Write functions ───────────────────────────────────────────────────────

    def set_min_score(self, min_score: int) -> dict[str, Any]:
        """
        Update the minimum trust score threshold (owner only).

        Providers with a score below this value will be blocked at job creation
        time by the before-hook.

        Args:
            min_score: New minimum score [0, 100].

        Returns:
            Transaction receipt dict with transactionHash, status, receipt.

        Raises:
            ValueError: If min_score is outside [0, 100].
        """
        if not (0 <= min_score <= 100):
            raise ValueError(f"min_score must be in [0, 100], got {min_score}")
        fn = self.contract.functions.setMinScore(min_score)
        result = self._send_tx(fn)
        logger.info(
            "[TrustGateHook] minScore updated to %d | tx=%s",
            min_score,
            result["transactionHash"],
        )
        return result
