"""
TrustBased Evaluator — end-to-end usage example.

Demonstrates all major features of the trust-based evaluation stack:

  1. Basic evaluation (ON_CHAIN mode)
  2. Hybrid mode with off-chain fallback
  3. Pre-check before evaluation
  4. EvaluatorRegistry — querying evaluator performance
  5. TrustGate before-hook — checking / configuring the gate
  6. Admin: update oracle / threshold
  7. Monitoring loop (event-driven pattern)

Default oracle and API endpoint point to Maiat Protocol's trust infrastructure.
Any ITrustOracle-compatible contract can be substituted.

Run:
    export RPC_URL="https://bsc-dataseed.binance.org/"
    export TRUST_EVALUATOR_ADDRESS="0xYour..."
    export EVALUATOR_REGISTRY_ADDRESS="0xYour..."
    export TRUST_GATE_HOOK_ADDRESS="0xYour..."
    export PRIVATE_KEY="0xYour..."
    python examples/trust_evaluator_example.py
"""

from __future__ import annotations

import logging
import os
import time

from web3 import Web3

from bnbagent.apex.evaluator_registry_client import EvaluatorRegistryClient
from bnbagent.apex.trust_evaluator_client import (
    OracleMode,
    TrustBasedEvaluatorClient,
    TrustScore,
)
from bnbagent.apex.trust_gate_hook_client import TrustGateACPHookClient

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("trust_evaluator_example")

# ── Default Maiat Protocol endpoints ──────────────────────────────────────────

#: Maiat's TrustBasedEvaluator contract on BSC Mainnet (example placeholder).
MAIAT_EVALUATOR_ADDRESS = os.environ.get(
    "TRUST_EVALUATOR_ADDRESS",
    "0x0000000000000000000000000000000000000000",
)

#: EvaluatorRegistry contract address.
EVALUATOR_REGISTRY_ADDRESS = os.environ.get(
    "EVALUATOR_REGISTRY_ADDRESS",
    "0x0000000000000000000000000000000000000000",
)

#: TrustGate before-hook contract address.
TRUST_GATE_HOOK_ADDRESS = os.environ.get(
    "TRUST_GATE_HOOK_ADDRESS",
    "0x0000000000000000000000000000000000000000",
)

#: Maiat's off-chain trust API base URL.
MAIAT_TRUST_API = "https://api.maiat.xyz/trust"

#: BSC Mainnet RPC (for production use a private endpoint).
DEFAULT_RPC = os.environ.get("RPC_URL", "https://bsc-dataseed.binance.org/")


# ── Example 1: Basic on-chain evaluation ──────────────────────────────────────


def example_basic_evaluation() -> None:
    """Evaluate a single submitted job using the on-chain ITrustOracle only."""
    logger.info("=== Example 1: Basic on-chain evaluation ===")

    w3 = Web3(Web3.HTTPProvider(DEFAULT_RPC))
    private_key = os.environ.get("PRIVATE_KEY")
    if not private_key:
        logger.warning("PRIVATE_KEY not set — write operations will fail")

    client = TrustBasedEvaluatorClient(
        web3=w3,
        contract_address=MAIAT_EVALUATOR_ADDRESS,
        private_key=private_key,
        threshold=60,              # require score >= 60/100
        mode=OracleMode.ON_CHAIN,  # strict on-chain mode
    )

    job_id = int(os.environ.get("JOB_ID", "1"))

    # evaluate_job() resolves agenticCommerce from the contract — no address param needed
    result = client.evaluate_job(job_id=job_id)

    outcome = "✅ completed" if result.completed else "❌ rejected"
    logger.info(
        "Job %d %s | provider=%s | score=%d | source=%s | tx=%s",
        result.job_id,
        outcome,
        result.provider,
        result.trust_score.score,
        result.trust_score.source,
        result.tx_hash,
    )


# ── Example 2: Hybrid mode with off-chain fallback ────────────────────────────


def example_hybrid_evaluation() -> None:
    """
    Hybrid mode: check on-chain oracle first; fall back to Maiat's HTTP API
    when the oracle has no data for a provider (new agents / unregistered).
    """
    logger.info("=== Example 2: Hybrid mode evaluation ===")

    w3 = Web3(Web3.HTTPProvider(DEFAULT_RPC))

    client = TrustBasedEvaluatorClient(
        web3=w3,
        contract_address=MAIAT_EVALUATOR_ADDRESS,
        private_key=os.environ.get("PRIVATE_KEY"),
        threshold=50,
        mode=OracleMode.HYBRID,           # on-chain + off-chain fallback
        offchain_api_url=MAIAT_TRUST_API,
        offchain_api_timeout=5,
    )

    # Read trust score only (no tx)
    provider = os.environ.get("PROVIDER_ADDRESS", "0x" + "aa" * 20)
    trust: TrustScore = client.get_trust_score(provider)

    logger.info(
        "Trust score for %s: %d/100 | initialized=%s | source=%s",
        provider,
        trust.score,
        trust.initialized,
        trust.source,
    )

    if client.is_trusted(provider, threshold=50):
        logger.info("Provider %s is trusted (score >= 50)", provider)
    else:
        logger.warning("Provider %s does NOT meet the trust threshold", provider)


# ── Example 3: Pre-check before accepting a job ───────────────────────────────


def example_pre_check() -> None:
    """
    Pre-check is a read-only call — no gas cost.  Useful for agents or UIs
    that want to estimate evaluation outcome before committing.
    """
    logger.info("=== Example 3: Pre-check (read-only) ===")

    w3 = Web3(Web3.HTTPProvider(DEFAULT_RPC))

    client = TrustBasedEvaluatorClient(
        web3=w3,
        contract_address=MAIAT_EVALUATOR_ADDRESS,
        threshold=60,
    )

    candidate_providers = [
        os.environ.get("PROVIDER_ADDRESS", "0x" + "aa" * 20),
        "0x" + "bb" * 20,
    ]

    for addr in candidate_providers:
        score, passes = client.pre_check(addr)
        status = "PASS ✅" if passes else "FAIL ❌"
        logger.info("pre_check(%s): score=%d → %s", addr, score, status)


# ── Example 4: EvaluatorRegistry — performance stats ─────────────────────────


def example_registry_stats() -> None:
    """Query this evaluator's historical approve/reject performance."""
    logger.info("=== Example 4: EvaluatorRegistry stats ===")

    w3 = Web3(Web3.HTTPProvider(DEFAULT_RPC))

    # Via TrustBasedEvaluatorClient convenience method
    client = TrustBasedEvaluatorClient(
        web3=w3,
        contract_address=MAIAT_EVALUATOR_ADDRESS,
    )
    stats = client.get_registry_stats()
    logger.info(
        "Evaluator stats → approved=%d | rejected=%d | total=%d",
        stats["approved"],
        stats["rejected"],
        stats["total"],
    )

    # Or query directly via EvaluatorRegistryClient
    registry = EvaluatorRegistryClient(
        web3=w3,
        contract_address=EVALUATOR_REGISTRY_ADDRESS,
    )
    evaluator_stats = registry.get_stats(MAIAT_EVALUATOR_ADDRESS)
    logger.info(
        "Direct registry query → approval_rate=%.1f%%",
        evaluator_stats.approval_rate * 100,
    )

    approved = registry.get_approved_count(MAIAT_EVALUATOR_ADDRESS)
    rejected = registry.get_rejected_count(MAIAT_EVALUATOR_ADDRESS)
    logger.info("Approved: %d | Rejected: %d", approved, rejected)


# ── Example 5: TrustGate before-hook ─────────────────────────────────────────


def example_trust_gate_hook() -> None:
    """
    Check provider eligibility via the TrustGate before-hook and update the
    minimum score threshold (owner only).
    """
    logger.info("=== Example 5: TrustGate before-hook ===")

    w3 = Web3(Web3.HTTPProvider(DEFAULT_RPC))
    private_key = os.environ.get("PRIVATE_KEY")

    hook = TrustGateACPHookClient(
        web3=w3,
        contract_address=TRUST_GATE_HOOK_ADDRESS,
        private_key=private_key,
    )

    # Read current config
    min_score = hook.get_min_score()
    oracle = hook.get_oracle_address()
    logger.info("TrustGate config: minScore=%d | oracle=%s", min_score, oracle)

    # Check a provider
    provider = os.environ.get("PROVIDER_ADDRESS", "0x" + "aa" * 20)
    score, allowed = hook.check_provider(provider)
    logger.info(
        "check_provider(%s): score=%d | allowed=%s",
        provider,
        score,
        "✅" if allowed else "❌",
    )

    # Update gate threshold (owner only — uncomment to execute)
    # if private_key:
    #     result = hook.set_min_score(70)
    #     logger.info("minScore updated to 70 | tx=%s", result["transactionHash"])


# ── Example 6: Admin operations ───────────────────────────────────────────────


def example_admin_operations() -> None:
    """Update oracle and threshold on the TrustBasedEvaluator (owner only)."""
    logger.info("=== Example 6: Admin operations ===")

    w3 = Web3(Web3.HTTPProvider(DEFAULT_RPC))
    private_key = os.environ.get("PRIVATE_KEY")
    if not private_key:
        logger.warning("PRIVATE_KEY not set — skipping admin examples")
        return

    client = TrustBasedEvaluatorClient(
        web3=w3,
        contract_address=MAIAT_EVALUATOR_ADDRESS,
        private_key=private_key,
        threshold=60,
    )

    # Read current config
    current_threshold = client.get_threshold()
    current_oracle = client.get_oracle_address()
    current_registry = client.get_registry_address()
    logger.info(
        "Config: threshold=%d | oracle=%s | registry=%s",
        current_threshold,
        current_oracle,
        current_registry,
    )

    # Switch to a new ITrustOracle (e.g. upgraded MaiatTrustOracle)
    # result = client.set_oracle("0xNewOracleAddress")
    # logger.info("Oracle updated | tx=%s", result["transactionHash"])

    # Raise the threshold
    # result = client.set_threshold(70)
    # logger.info("Threshold raised to 70 | tx=%s", result["transactionHash"])


# ── Example 7: Monitoring loop ────────────────────────────────────────────────


def example_monitoring_loop(poll_interval: int = 10, max_iterations: int = 3) -> None:
    """
    Example keeper loop: poll submitted jobs and evaluate them automatically.

    In production, use an event-driven approach (subscribe to JobSubmitted
    events) rather than polling.
    """
    logger.info("=== Example 7: Monitoring loop (demo — %d iterations) ===", max_iterations)

    from bnbagent.apex.client import APEXClient, APEXStatus  # noqa: PLC0415

    w3 = Web3(Web3.HTTPProvider(DEFAULT_RPC))
    private_key = os.environ.get("PRIVATE_KEY")

    acp_address = os.environ.get(
        "ERC8183_ADDRESS",
        "0x0000000000000000000000000000000000000000",
    )

    apex_client = APEXClient(
        web3=w3,
        contract_address=acp_address,
        private_key=private_key,
    )
    evaluator_client = TrustBasedEvaluatorClient(
        web3=w3,
        contract_address=MAIAT_EVALUATOR_ADDRESS,
        private_key=private_key,
        threshold=60,
        mode=OracleMode.HYBRID,
        offchain_api_url=MAIAT_TRUST_API,
    )

    for iteration in range(max_iterations):
        logger.info("[Loop %d/%d] Scanning submitted jobs…", iteration + 1, max_iterations)

        try:
            current_block = w3.eth.block_number
            from_block = max(0, current_block - 1000)
            submitted_events = apex_client.get_job_created_events(from_block=from_block)
        except Exception as exc:
            logger.error("Failed to fetch events: %s", exc)
            time.sleep(poll_interval)
            continue

        for event in submitted_events:
            job_id = event["jobId"]

            try:
                job = apex_client.get_job(job_id)
            except Exception as exc:
                logger.warning("Could not fetch job %d: %s", job_id, exc)
                continue

            if job["status"] != APEXStatus.SUBMITTED:
                continue

            if evaluator_client.is_evaluated(job_id):
                continue

            logger.info("Evaluating job %d (provider=%s)…", job_id, job["provider"])
            try:
                result = evaluator_client.evaluate_job(job_id=job_id)
                logger.info(
                    "Job %d → %s (score=%d)",
                    job_id,
                    "completed" if result.completed else "rejected",
                    result.trust_score.score,
                )
            except Exception as exc:
                logger.error("Evaluation failed for job %d: %s", job_id, exc)

        time.sleep(poll_interval)


# ── Entry point ───────────────────────────────────────────────────────────────


if __name__ == "__main__":
    # Read-only examples (safe to run without live contracts)
    example_pre_check()
    example_hybrid_evaluation()
    example_registry_stats()
    example_trust_gate_hook()
    example_admin_operations()

    # Uncomment to run write-operation examples:
    # example_basic_evaluation()
    # example_monitoring_loop(max_iterations=2)
