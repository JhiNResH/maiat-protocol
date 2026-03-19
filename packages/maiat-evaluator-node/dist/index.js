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
    config;
    constructor(config = {}) {
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
    async evaluate(job) {
        try {
            await this._evaluateJob(job);
        }
        catch (e) {
            console.error(`[maiat-evaluator] Error evaluating job ${job.id}:`, e);
            this._safeEvaluate(job, true, `Maiat error: ${e}`);
        }
    }
    async _evaluateJob(job) {
        // Find submission memo
        const memos = job.memos ?? [];
        const submissionMemo = memos.find((m) => {
            const phase = m.nextPhase ?? m.next_phase ?? "";
            return phase.toString().includes("COMPLETED");
        });
        if (!submissionMemo)
            return;
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
        }
        else {
            console.log(`[maiat-evaluator] Job ${job.id}: Approved (score=${trustResult.score})`);
            this._safeEvaluate(job, true, `Moderate trust: ${trustResult.score}`);
            await this._recordOutcome(job, true, "moderate_approved");
        }
    }
    async _checkTrust(address) {
        if (!address)
            return { score: 0, verdict: "unknown" };
        try {
            const url = `${this.config.apiUrl}/evaluate?address=${encodeURIComponent(address)}`;
            const resp = await fetch(url);
            if (!resp.ok)
                throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            return {
                score: (data.trustScore ?? data.score ?? 0),
                verdict: (data.verdict ?? "unknown"),
                completionRate: data.completionRate,
                totalJobs: data.totalJobs,
            };
        }
        catch (e) {
            console.warn(`[maiat-evaluator] Trust check failed for ${address}:`, e);
            return { score: 0, verdict: "unknown", error: String(e) };
        }
    }
    _isGarbage(deliverable) {
        if (!deliverable?.trim())
            return true;
        const cleaned = deliverable.trim();
        if (cleaned.length < this.config.garbageThreshold)
            return true;
        if (GARBAGE_PATTERNS.has(cleaned.toLowerCase()))
            return true;
        return false;
    }
    async _recordOutcome(job, approved, reason) {
        if (!this.config.recordOutcomes)
            return;
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
        }
        catch {
            // Best effort
        }
    }
    _getProviderAddress(job) {
        const addr = job.providerAddress ?? job.provider_address ?? job.provider ?? "";
        return typeof addr === "string" && addr.startsWith("0x") ? addr : "";
    }
    _safeEvaluate(job, approve, reason) {
        try {
            job.evaluate?.(approve);
        }
        catch (e) {
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
export function maiatEvaluator(config = {}) {
    const evaluator = new MaiatEvaluator(config);
    return (job) => evaluator.evaluate(job);
}
