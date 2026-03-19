"""Core evaluator logic — calls Maiat API to verify job deliverables.

The evaluator performs three checks:
1. Provider trust score (is the provider trustworthy?)
2. Deliverable quality (is the output garbage or real work?)
3. Record outcome (feed result back to Maiat for trust updates)
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

import httpx

logger = logging.getLogger("maiat_evaluator")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEFAULT_API_URL = "https://app.maiat.io/api/v1"
DEFAULT_MIN_TRUST_SCORE = 30
DEFAULT_GARBAGE_THRESHOLD = 20  # characters — deliverables shorter than this are garbage


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

@dataclass
class MaiatEvaluatorConfig:
    """Configuration for the Maiat evaluator."""

    api_url: str = ""
    min_trust_score: int = DEFAULT_MIN_TRUST_SCORE
    garbage_threshold: int = DEFAULT_GARBAGE_THRESHOLD
    auto_approve_trusted: bool = True  # Auto-approve if provider score >= 80
    auto_reject_garbage: bool = True   # Auto-reject if deliverable is garbage
    record_outcomes: bool = True       # Report outcomes back to Maiat
    on_manual_review: Optional[Callable] = None  # Callback for edge cases

    def __post_init__(self):
        if not self.api_url:
            self.api_url = os.environ.get("MAIAT_API_URL", DEFAULT_API_URL)


# ---------------------------------------------------------------------------
# Evaluator Class
# ---------------------------------------------------------------------------

class MaiatEvaluator:
    """Maiat trust-based evaluator for ACP jobs.

    Wraps the Maiat API to provide trust verification for agent commerce.
    Designed to be used as GAME SDK's on_evaluate callback.
    """

    def __init__(self, config: Optional[MaiatEvaluatorConfig] = None):
        self.config = config or MaiatEvaluatorConfig()
        self._client = httpx.Client(
            base_url=self.config.api_url,
            timeout=10.0,
            headers={"Content-Type": "application/json"},
        )

    def __call__(self, job: Any) -> None:
        """Called by GAME SDK when a job needs evaluation.

        Args:
            job: ACPJob instance from virtuals_acp SDK.
                 Has .id, .memos, .evaluate(bool), .provider_address, etc.
        """
        try:
            self._evaluate_job(job)
        except Exception as e:
            logger.error(f"Maiat evaluation failed for job {getattr(job, 'id', '?')}: {e}")
            # On error, approve to avoid blocking — log for investigation
            self._safe_evaluate(job, True, f"Maiat error: {e}")

    def _evaluate_job(self, job: Any) -> None:
        """Core evaluation logic."""
        # Find the submission memo
        submission_memo = None
        for memo in getattr(job, "memos", []):
            phase = getattr(memo, "next_phase", None)
            # ACPJobPhase.COMPLETED = the provider is submitting deliverable
            if phase and str(phase).endswith("COMPLETED"):
                submission_memo = memo
                break

        if not submission_memo:
            return  # No submission to evaluate yet

        # Extract deliverable content
        deliverable = getattr(submission_memo, "content", "") or ""
        provider_address = self._get_provider_address(job)

        # Step 1: Check for garbage deliverable
        if self.config.auto_reject_garbage and self._is_garbage(deliverable):
            logger.warning(f"Job {job.id}: Garbage deliverable detected, rejecting")
            self._safe_evaluate(job, False, "Deliverable is empty or too short")
            self._record_outcome(job, False, "garbage")
            return

        # Step 2: Check provider trust score
        trust_result = self._check_trust(provider_address)
        score = trust_result.get("score", 0)
        verdict = trust_result.get("verdict", "unknown")

        if verdict == "avoid":
            logger.warning(f"Job {job.id}: Provider {provider_address} verdict=avoid (score={score})")
            self._safe_evaluate(job, False, f"Provider trust too low: {score}")
            self._record_outcome(job, False, "low_trust")
            return

        if self.config.auto_approve_trusted and score >= 80:
            logger.info(f"Job {job.id}: Auto-approved (provider score={score})")
            self._safe_evaluate(job, True, f"Trusted provider: {score}")
            self._record_outcome(job, True, "auto_approved")
            return

        # Step 3: Edge case — moderate trust, non-garbage deliverable
        if self.config.on_manual_review:
            self.config.on_manual_review(job, trust_result, deliverable)
        else:
            # Default: approve moderate-trust providers with real deliverables
            logger.info(f"Job {job.id}: Approved (score={score}, deliverable looks real)")
            self._safe_evaluate(job, True, f"Moderate trust: {score}")
            self._record_outcome(job, True, "moderate_approved")

    def _check_trust(self, address: str) -> dict:
        """Query Maiat API for provider trust score."""
        if not address:
            return {"score": 0, "verdict": "unknown"}

        try:
            resp = self._client.get(f"/evaluate", params={"address": address})
            resp.raise_for_status()
            data = resp.json()
            return {
                "score": data.get("trustScore", data.get("score", 0)),
                "verdict": data.get("verdict", "unknown"),
                "completionRate": data.get("completionRate", 0),
                "totalJobs": data.get("totalJobs", 0),
            }
        except Exception as e:
            logger.warning(f"Trust check failed for {address}: {e}")
            return {"score": 0, "verdict": "unknown", "error": str(e)}

    def _is_garbage(self, deliverable: str) -> bool:
        """Check if deliverable is garbage (too short, empty, or placeholder)."""
        if not deliverable or not deliverable.strip():
            return True
        cleaned = deliverable.strip()
        if len(cleaned) < self.config.garbage_threshold:
            return True
        # Common garbage patterns
        garbage_patterns = [
            "hello", "hi", "test", "ok", "done", "yes", "no",
            "{}", "[]", "null", "undefined", "none",
        ]
        if cleaned.lower() in garbage_patterns:
            return True
        return False

    def _record_outcome(self, job: Any, approved: bool, reason: str) -> None:
        """Report outcome back to Maiat for trust score updates."""
        if not self.config.record_outcomes:
            return

        provider_address = self._get_provider_address(job)
        try:
            self._client.post("/outcome", json={
                "jobId": str(getattr(job, "id", "")),
                "provider": provider_address,
                "approved": approved,
                "reason": reason,
                "source": "maiat-evaluator-py",
            })
        except Exception as e:
            logger.debug(f"Failed to record outcome: {e}")

    def _get_provider_address(self, job: Any) -> str:
        """Extract provider address from job object."""
        # Try common attribute patterns from GAME SDK
        for attr in ("provider_address", "providerAddress", "provider"):
            val = getattr(job, attr, None)
            if val and isinstance(val, str) and val.startswith("0x"):
                return val
        return ""

    def _safe_evaluate(self, job: Any, approve: bool, reason: str = "") -> None:
        """Safely call job.evaluate() with error handling."""
        try:
            evaluate_fn = getattr(job, "evaluate", None)
            if evaluate_fn:
                evaluate_fn(approve)
                logger.debug(f"Job {getattr(job, 'id', '?')}: {'approved' if approve else 'rejected'} — {reason}")
        except Exception as e:
            logger.error(f"Failed to call job.evaluate(): {e}")

    def close(self) -> None:
        """Close HTTP client."""
        self._client.close()


# ---------------------------------------------------------------------------
# Factory function — the one-liner
# ---------------------------------------------------------------------------

def maiat_evaluator(
    *,
    min_trust_score: int = DEFAULT_MIN_TRUST_SCORE,
    auto_approve_trusted: bool = True,
    auto_reject_garbage: bool = True,
    api_url: str = "",
    on_manual_review: Optional[Callable] = None,
) -> MaiatEvaluator:
    """Create a Maiat evaluator for GAME SDK's on_evaluate callback.

    Usage:
        acp_client = VirtualsACP(
            ...,
            on_evaluate=maiat_evaluator(),  # default settings
        )

        # Or with custom config:
        acp_client = VirtualsACP(
            ...,
            on_evaluate=maiat_evaluator(min_trust_score=50),
        )

    Args:
        min_trust_score: Minimum trust score to approve (0-100). Default: 30.
        auto_approve_trusted: Auto-approve providers with score >= 80. Default: True.
        auto_reject_garbage: Auto-reject empty/garbage deliverables. Default: True.
        api_url: Maiat API URL. Default: https://app.maiat.io/api/v1
        on_manual_review: Optional callback for edge cases (moderate trust + real deliverable).

    Returns:
        MaiatEvaluator instance (callable, use directly as on_evaluate).
    """
    config = MaiatEvaluatorConfig(
        api_url=api_url,
        min_trust_score=min_trust_score,
        auto_approve_trusted=auto_approve_trusted,
        auto_reject_garbage=auto_reject_garbage,
        on_manual_review=on_manual_review,
    )
    return MaiatEvaluator(config)
