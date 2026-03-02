/**
 * Maiat SDK — Trust scores, token safety & swap verification for AI agents
 *
 * Usage:
 *   import { Maiat } from "maiat-sdk";
 *   const maiat = new Maiat();
 *   const score = await maiat.agentTrust("0x...");
 *   const token = await maiat.tokenCheck("0x...");
 *   const swap  = await maiat.trustSwap({ ... });
 */
// ─── Client ───────────────────────────────────────────────────────────────────
export class Maiat {
    baseUrl;
    apiKey;
    timeout;
    constructor(config = {}) {
        this.baseUrl = (config.baseUrl ?? "https://maiat-protocol.vercel.app").replace(/\/$/, "");
        this.apiKey = config.apiKey;
        this.timeout = config.timeout ?? 15_000;
    }
    async request(path, options) {
        const headers = {
            "Content-Type": "application/json",
            ...(this.apiKey ? { "X-Maiat-Key": this.apiKey } : {}),
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
    /** Check if a token is safe (honeypot, rug, liquidity) */
    async tokenCheck(address) {
        return this.request(`/api/v1/token/${address}`);
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
