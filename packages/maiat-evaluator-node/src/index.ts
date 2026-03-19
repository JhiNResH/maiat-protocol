/**
 * Maiat Evaluator — Drop-in trust evaluator for Virtuals ACP / GAME SDK (Node.js).
 *
 * Usage (one-line integration):
 *
 *   import { maiatEvaluator } from "@jhinresh/maiat-evaluator";
 *
 *   const acpPlugin = new AcpPlugin({
 *     apiKey: GAME_API_KEY,
 *     acpClient: new VirtualsACP({
 *       walletPrivateKey: WALLET_KEY,
 *       agentWalletAddress: AGENT_WALLET,
 *       entityId: ENTITY_ID,
 *       onEvaluate: maiatEvaluator(), // <--- one line
 *     }),
 *     evaluatorCluster: "MAIAT",
 *   });
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MaiatEvaluatorConfig {
  /** Maiat API URL. Default: https://app.maiat.io/api/v1 */
  apiUrl?: string;
  /** Minimum trust score to approve (0-100). Default: 30 */
  minTrustScore?: number;
  /** Minimum deliverable length to be considered real work. Default: 20 */
  garbageThreshold?: number;
  /** Auto-approve providers with score >= 80. Default: true */
  autoApproveTrusted?: boolean;
  /** Auto-reject empty/garbage deliverables. Default: true */
  autoRejectGarbage?: boolean;
  /** Report outcomes back to Maiat. Default: true */
  recordOutcomes?: boolean;
  /** Optional callback for edge cases (moderate trust + real deliverable) */
  onManualReview?: (job: ACPJob, trustResult: TrustResult, deliverable: string) => void;
}

/** Minimal ACPJob interface (compatible with GAME SDK) */
export interface ACPJob {
  id: string | number;
  memos?: ACPMemo[];
  evaluate?: (approve: boolean) => void;
  providerAddress?: string;
  provider_address?: string;
  provider?: string;
  [key: string]: unknown;
}

export interface ACPMemo {
  nextPhase?: string;
  next_phase?: string;
  content?: string;
  [key: string]: unknown;
}

export interface TrustResult {
  score: number;
  verdict: string;
  completionRate?: number;
  totalJobs?: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_API_URL = "https://app.maiat.io/api/v1";
const DEFAULT_MIN_TRUST_SCORE = 30;
const DEFAULT_GARBAGE_THRESHOLD = 20;

const GARBAGE_PATTERNS = new Set([
  "hello", "hi", "test", "ok", "done", "yes", "no",
  "{}", "[]", "null", "undefined", "none",
]);

// ---------------------------------------------------------------------------
// Evaluator Class
// ---------------------------------------------------------------------------

export class MaiatEvaluator {
  private config: Required<
    Omit<MaiatEvaluatorConfig, "onManualReview">
  > & { onManualReview?: MaiatEvaluatorConfig["onManualReview"] };

  constructor(config: MaiatEvaluatorConfig = {}) {
    this.config = {
      apiUrl: config.apiUrl || process.env.MAIAT_API_URL || DEFAULT_API_URL,
      minTrustScore: config.minTrustScore ?? DEFAULT_MIN_TRUST_SCORE,
      garbageThreshold: config.garbageThreshold ?? DEFAULT_GARBAGE_THRESHOLD,
      autoApproveTrusted: config.autoApproveTrusted ?? true,
      autoRejectGarbage: config.autoRejectGarbage ?? true,
      recordOutcomes: config.recordOutcomes ?? true,
      onManualReview: config.onManualReview,
    };
  }

  /** Called by GAME SDK when a job needs evaluation. */
  async evaluate(job: ACPJob): Promise<void> {
    try {
      await this._evaluateJob(job);
    } catch (e) {
      console.error(`[maiat-evaluator] Error evaluating job ${job.id}:`, e);
      this._safeEvaluate(job, true, `Maiat error: ${e}`);
    }
  }

  private async _evaluateJob(job: ACPJob): Promise<void> {
    // Find submission memo
    const memos = job.memos ?? [];
    const submissionMemo = memos.find((m) => {
      const phase = m.nextPhase ?? m.next_phase ?? "";
      return phase.toString().includes("COMPLETED");
    });

    if (!submissionMemo) return;

    const deliverable = submissionMemo.content ?? "";
    const providerAddress = this._getProviderAddress(job);

    // Step 1: Garbage check
    if (this.config.autoRejectGarbage && this._isGarbage(deliverable)) {
      console.warn(`[maiat-evaluator] Job ${job.id}: Garbage deliverable, rejecting`);
      this._safeEvaluate(job, false, "Deliverable is empty or too short");
      await this._recordOutcome(job, false, "garbage");
      return;
    }

    // Step 2: Trust score check
    const trustResult = await this._checkTrust(providerAddress);

    if (trustResult.verdict === "avoid") {
      console.warn(`[maiat-evaluator] Job ${job.id}: Provider verdict=avoid (score=${trustResult.score})`);
      this._safeEvaluate(job, false, `Provider trust too low: ${trustResult.score}`);
      await this._recordOutcome(job, false, "low_trust");
      return;
    }

    if (this.config.autoApproveTrusted && trustResult.score >= 80) {
      console.log(`[maiat-evaluator] Job ${job.id}: Auto-approved (score=${trustResult.score})`);
      this._safeEvaluate(job, true, `Trusted provider: ${trustResult.score}`);
      await this._recordOutcome(job, true, "auto_approved");
      return;
    }

    // Step 3: Edge case
    if (this.config.onManualReview) {
      this.config.onManualReview(job, trustResult, deliverable);
    } else {
      console.log(`[maiat-evaluator] Job ${job.id}: Approved (score=${trustResult.score})`);
      this._safeEvaluate(job, true, `Moderate trust: ${trustResult.score}`);
      await this._recordOutcome(job, true, "moderate_approved");
    }
  }

  private async _checkTrust(address: string): Promise<TrustResult> {
    if (!address) return { score: 0, verdict: "unknown" };

    try {
      const url = `${this.config.apiUrl}/evaluate?address=${encodeURIComponent(address)}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json() as Record<string, unknown>;
      return {
        score: (data.trustScore ?? data.score ?? 0) as number,
        verdict: (data.verdict ?? "unknown") as string,
        completionRate: data.completionRate as number | undefined,
        totalJobs: data.totalJobs as number | undefined,
      };
    } catch (e) {
      console.warn(`[maiat-evaluator] Trust check failed for ${address}:`, e);
      return { score: 0, verdict: "unknown", error: String(e) };
    }
  }

  private _isGarbage(deliverable: string): boolean {
    if (!deliverable?.trim()) return true;
    const cleaned = deliverable.trim();
    if (cleaned.length < this.config.garbageThreshold) return true;
    if (GARBAGE_PATTERNS.has(cleaned.toLowerCase())) return true;
    return false;
  }

  private async _recordOutcome(job: ACPJob, approved: boolean, reason: string): Promise<void> {
    if (!this.config.recordOutcomes) return;

    try {
      await fetch(`${this.config.apiUrl}/outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: String(job.id),
          provider: this._getProviderAddress(job),
          approved,
          reason,
          source: "maiat-evaluator-node",
        }),
      });
    } catch {
      // Best effort
    }
  }

  private _getProviderAddress(job: ACPJob): string {
    const addr = job.providerAddress ?? job.provider_address ?? job.provider ?? "";
    return typeof addr === "string" && addr.startsWith("0x") ? addr : "";
  }

  private _safeEvaluate(job: ACPJob, approve: boolean, reason: string): void {
    try {
      job.evaluate?.(approve);
    } catch (e) {
      console.error(`[maiat-evaluator] Failed to call job.evaluate():`, e);
    }
  }
}

// ---------------------------------------------------------------------------
// Factory function — the one-liner
// ---------------------------------------------------------------------------

/**
 * Create a Maiat evaluator for GAME SDK's onEvaluate callback.
 *
 * @example
 *   import { maiatEvaluator } from "@jhinresh/maiat-evaluator";
 *
 *   const acpClient = new VirtualsACP({
 *     ...,
 *     onEvaluate: maiatEvaluator(), // default settings
 *   });
 *
 *   // Custom config:
 *   onEvaluate: maiatEvaluator({ minTrustScore: 50 }),
 */
export function maiatEvaluator(config: MaiatEvaluatorConfig = {}): (job: ACPJob) => Promise<void> {
  const evaluator = new MaiatEvaluator(config);
  return (job: ACPJob) => evaluator.evaluate(job);
}
