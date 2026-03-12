/**
 * Maiat SDK — Trust scores, token safety & swap verification for AI agents
 *
 * Usage:
 *   import { Maiat } from "@jhinresh/maiat-sdk";
 *   const maiat = new Maiat({ clientId: "my-agent" });
 *   const score = await maiat.agentTrust("0x...");
 *   const token = await maiat.tokenCheck("0x...");
 *   const swap  = await maiat.trustSwap({ ... });
 *   await maiat.reportOutcome({ jobId: "...", outcome: "success" });
 */
// ─── Client ───────────────────────────────────────────────────────────────────
export class Maiat {
    baseUrl;
    apiKey;
    clientId;
    framework;
    timeout;
    constructor(config = {}) {
        this.baseUrl = (config.baseUrl ?? "https://app.maiat.io").replace(/\/$/, "");
        this.apiKey = config.apiKey;
        this.clientId = config.clientId;
        this.framework = config.framework;
        this.timeout = config.timeout ?? 15_000;
    }
    async request(path, options) {
        const headers = {
            "Content-Type": "application/json",
            ...(this.apiKey ? { "X-Maiat-Key": this.apiKey } : {}),
            ...(this.clientId ? { "X-Maiat-Client": this.clientId } : {}),
            ...(this.framework ? { "X-Maiat-Framework": this.framework } : {}),
            "User-Agent": `maiat-sdk-js/1.0.0${this.framework ? ` (${this.framework})` : ''}`,
        };
        const res = await fetch(`${this.baseUrl}${path}`, {
            ...options,
            headers: { ...headers, ...options?.headers },
            signal: AbortSignal.timeout(this.timeout),
        });
        if (!res.ok) {
            const body = await res.text().catch(() => "");
            throw new MaiatError(`HTTP ${res.status}: ${body}`, res.status);
        }
        return res.json();
    }
    // ─── Core Methods ─────────────────────────────────────────────────────────
    /** Get trust score for an ACP agent by wallet address */
    async agentTrust(address) {
        return this.request(`/api/v1/agent/${address}`);
    }
    /** Get deep analysis for an ACP agent by wallet address */
    async deep(address) {
        return this.request(`/api/v1/agent/${address}/deep`);
    }
    /** Check if a token is safe (honeypot, rug, liquidity) */
    async tokenCheck(address) {
        return this.request(`/api/v1/token/${address}`);
    }
    /** Get forensics data for a token address */
    async forensics(address, chain) {
        const query = chain ? `?chain=${chain}` : "";
        return this.request(`/api/v1/token/${address}/forensics${query}`);
    }
    /** Get a trust-verified swap quote with calldata */
    async trustSwap(params) {
        return this.request("/api/v1/swap/quote", {
            method: "POST",
            body: JSON.stringify(params),
        });
    }
    /** List indexed agents with trust scores */
    async listAgents(limit = 50) {
        return this.request(`/api/v1/agents?limit=${limit}`);
    }
    /** Get SCARAB token balance for an address */
    async scarab(address) {
        return this.request(`/api/v1/scarab?address=${address}`);
    }
    // ─── Outcome Reporting ────────────────────────────────────────────────────
    /**
     * Report the outcome of a job (new API).
     *
     * Example flow:
     *   1. maiat.agentTrust("0x...") → proceed
     *   2. You execute the job
     *   3. maiat.reportOutcome({ jobId: "...", outcome: "success" })
     */
    async reportOutcome(params) {
        return this.request("/api/v1/outcome", {
            method: "POST",
            body: JSON.stringify(params),
        });
    }
    // ─── Convenience ──────────────────────────────────────────────────────────
    /** Quick check: is this agent trustworthy? Returns true if score >= threshold */
    async isTrusted(address, threshold = 60) {
        try {
            const result = await this.agentTrust(address);
            return result.trustScore >= threshold;
        }
        catch {
            return false; // fail-closed: unknown = untrusted
        }
    }
    /** Quick check: is this token safe to swap? */
    async isTokenSafe(address) {
        try {
            const result = await this.tokenCheck(address);
            return result.verdict === "proceed";
        }
        catch {
            return false;
        }
    }
}
// ─── Error ────────────────────────────────────────────────────────────────────
export class MaiatError extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.status = status;
        this.name = "MaiatError";
    }
}
// ─── Default export ───────────────────────────────────────────────────────────
export default Maiat;
