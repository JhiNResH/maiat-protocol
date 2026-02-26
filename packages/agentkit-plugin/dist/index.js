/**
 * @maiat/agentkit-plugin
 *
 * Coinbase AgentKit plugin that adds trust scoring to every agent transaction.
 *
 * V0.2.0 — Cold-start update:
 * - submitReview(): Submit trust reviews with Scarab staking
 * - getInteractions(): Discover contracts a wallet has interacted with
 * - getPassport(): Get a wallet's reputation passport
 * - getDefiInfo(): Query DeFi protocol trust data by slug or address
 * - getAgentInfo(): Query AI agent trust data by slug or address
 *
 * Usage:
 * ```typescript
 * import { AgentKit } from "@coinbase/agentkit";
 * import { maiatTrustPlugin } from "@maiat/agentkit-plugin";
 *
 * const agent = new AgentKit({ ... });
 * agent.use(maiatTrustPlugin({ minScore: 3.0 }));
 * ```
 */
export class MaiatTrustError extends Error {
    address;
    score;
    risk;
    minScore;
    constructor(address, score, risk, minScore) {
        super(`Maiat: Transaction blocked — address ${address} has trust score ${score}/10 (${risk} risk), minimum required: ${minScore}`);
        this.address = address;
        this.score = score;
        this.risk = risk;
        this.minScore = minScore;
        this.name = "MaiatTrustError";
    }
}
// ═══════════════════════════════════════════
//  API Client
// ═══════════════════════════════════════════
export class MaiatClient {
    apiUrl;
    apiKey;
    chain;
    cache = new Map();
    constructor(config = {}) {
        this.apiUrl = config.apiUrl || "https://maiat-protocol.vercel.app";
        this.apiKey = config.apiKey || "";
        this.chain = config.chain || "base";
    }
    get headers() {
        const h = {
            "Content-Type": "application/json",
            "User-Agent": "maiat-agentkit-plugin/0.2.0",
        };
        if (this.apiKey)
            h["Authorization"] = `Bearer ${this.apiKey}`;
        return h;
    }
    async checkTrust(address, chain) {
        const cacheKey = `${address}:${chain || this.chain}`;
        const cached = this.cache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.result;
        }
        const url = `${this.apiUrl}/api/v1/score/${address}?chain=${chain || this.chain}`;
        const res = await fetch(url, { headers: this.headers });
        if (!res.ok) {
            throw new Error(`Maiat API error (${res.status}): ${await res.text()}`);
        }
        const result = await res.json();
        this.cache.set(cacheKey, { result, expiresAt: Date.now() + 5 * 60 * 1000 });
        return result;
    }
    async batchCheck(addresses, chain) {
        return Promise.all(addresses.map((addr) => this.checkTrust(addr, chain)));
    }
    isSafe(score, minScore = 3.0) {
        return score >= minScore;
    }
    /** Submit a trust review for a contract address. Costs 2 Scarab. */
    async submitReview(review) {
        const res = await fetch(`${this.apiUrl}/api/v1/review`, {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify(review),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
            throw new Error(`Review submission failed: ${err.error || err.detail || res.status}`);
        }
        return res.json();
    }
    /** Discover contracts a wallet has interacted with on Base. */
    async getInteractions(walletAddress) {
        const res = await fetch(`${this.apiUrl}/api/v1/wallet/${walletAddress}/interactions`, { headers: this.headers });
        if (!res.ok)
            throw new Error(`Interactions API error: ${res.status}`);
        return res.json();
    }
    /** Get a wallet's reputation passport (trust level, Scarab, reviews). */
    async getPassport(walletAddress) {
        const res = await fetch(`${this.apiUrl}/api/v1/wallet/${walletAddress}/passport`, { headers: this.headers });
        if (!res.ok)
            throw new Error(`Passport API error: ${res.status}`);
        return res.json();
    }
    /** Get DeFi protocol info by slug or address. */
    async getDefiInfo(slugOrAddress) {
        const res = await fetch(`${this.apiUrl}/api/v1/defi/${slugOrAddress}`, { headers: this.headers });
        if (!res.ok)
            throw new Error(`DeFi info API error: ${res.status}`);
        return res.json();
    }
    /** Get AI agent info by slug or address. */
    async getAgentInfo(slugOrAddress) {
        const res = await fetch(`${this.apiUrl}/api/v1/agent/${slugOrAddress}`, { headers: this.headers });
        if (!res.ok)
            throw new Error(`Agent info API error: ${res.status}`);
        return res.json();
    }
}
// ═══════════════════════════════════════════
//  AgentKit Plugin Interface
// ═══════════════════════════════════════════
/**
 * AgentKit plugin action definitions.
 * These are the tools/actions that the agent can use.
 */
export function maiatTrustActions(config = {}) {
    const client = new MaiatClient(config);
    const minScore = config.minScore ?? 3.0;
    return [
        // --- Existing: Trust Check ---
        {
            name: "maiat_check_trust",
            description: `Check the trust score of an on-chain address using Maiat. Returns a 0-10 score with risk assessment. Addresses scoring below ${minScore} are considered unsafe.`,
            schema: {
                type: "object",
                properties: {
                    address: { type: "string", description: "On-chain address to check (0x...)" },
                    chain: { type: "string", description: "Chain: base, ethereum, bnb. Default: base" },
                },
                required: ["address"],
            },
            handler: async (params) => {
                const result = await client.checkTrust(params.address, params.chain);
                config.onCheck?.(result.address, result.score, result.risk);
                const safe = client.isSafe(result.score, minScore);
                return {
                    score: result.score,
                    risk: result.risk,
                    type: result.type,
                    flags: result.flags,
                    safe,
                    breakdown: result.breakdown,
                    details: result.details,
                    protocol: result.protocol,
                    recommendation: safe
                        ? `✅ Address is trusted (${result.score}/10). Safe to proceed.`
                        : `⚠️ Address has low trust (${result.score}/10, ${result.risk} risk). ${config.warnOnly ? "Proceeding with caution." : "Transaction blocked."}`,
                };
            },
        },
        // --- Existing: Transaction Gate ---
        {
            name: "maiat_gate_transaction",
            description: "Check if a transaction target is trustworthy before executing. Blocks transactions to untrusted addresses automatically.",
            schema: {
                type: "object",
                properties: {
                    to: { type: "string", description: "Target address of the transaction" },
                    value: { type: "string", description: "Transaction value (optional context)" },
                    chain: { type: "string", description: "Chain: base, ethereum, bnb" },
                },
                required: ["to"],
            },
            handler: async (params) => {
                const result = await client.checkTrust(params.to, params.chain);
                config.onCheck?.(result.address, result.score, result.risk);
                if (!client.isSafe(result.score, minScore) && !config.warnOnly) {
                    config.onBlocked?.(result.address, result.score, result.risk);
                    throw new MaiatTrustError(result.address, result.score, result.risk, minScore);
                }
                return {
                    approved: true,
                    score: result.score,
                    risk: result.risk,
                    address: result.address,
                };
            },
        },
        // --- NEW: Submit Review ---
        {
            name: "maiat_submit_review",
            description: "Submit a trust review for a contract address. Costs 2 Scarab points. Quality reviews earn 3-10 Scarab rewards.",
            schema: {
                type: "object",
                properties: {
                    address: { type: "string", description: "Contract address to review (0x...)" },
                    rating: { type: "number", description: "Rating from 1-10" },
                    comment: { type: "string", description: "Review text explaining your rating" },
                    reviewer: { type: "string", description: "Your wallet address (0x...)" },
                    tags: { type: "array", description: "Tags: safe, risky, audited, scam, defi, nft" },
                },
                required: ["address", "rating", "reviewer"],
            },
            handler: async (params) => {
                const result = await client.submitReview(params);
                return {
                    success: result.success,
                    reviewId: result.review.id,
                    scarabReward: result.meta.scarabReward,
                    qualityScore: result.meta.qualityScore,
                    interactionVerified: result.meta.interactionVerified,
                    message: `✅ Review submitted for ${params.address}. Earned ${result.meta.scarabReward} Scarab.`,
                };
            },
        },
        // --- NEW: Wallet Interactions ---
        {
            name: "maiat_get_interactions",
            description: "Discover which contracts a wallet has interacted with on Base. Shows reviewable contracts and their trust scores.",
            schema: {
                type: "object",
                properties: {
                    wallet: { type: "string", description: "Wallet address to check (0x...)" },
                },
                required: ["wallet"],
            },
            handler: async (params) => {
                const result = await client.getInteractions(params.wallet);
                return {
                    wallet: result.wallet,
                    interactedCount: result.interactedCount,
                    contracts: result.interacted.map(c => ({
                        name: c.name,
                        address: c.address,
                        category: c.category,
                        txCount: c.txCount,
                        trustScore: c.trustScore,
                        canReview: c.canReview,
                        hasReviewed: c.hasReviewed,
                    })),
                    message: `Found ${result.interactedCount} contracts you've interacted with.`,
                };
            },
        },
        // --- NEW: Reputation Passport ---
        {
            name: "maiat_get_passport",
            description: "Get a wallet's reputation passport showing trust level, Scarab balance, review history, and fee tier progression.",
            schema: {
                type: "object",
                properties: {
                    wallet: { type: "string", description: "Wallet address (0x...)" },
                },
                required: ["wallet"],
            },
            handler: async (params) => {
                const result = await client.getPassport(params.wallet);
                return {
                    trustLevel: result.passport.trustLevel,
                    reputationScore: result.passport.reputationScore,
                    totalReviews: result.passport.totalReviews,
                    scarabBalance: result.scarab.balance,
                    feeTier: result.passport.feeTier,
                    nextLevel: result.progression.nextLevel,
                    pointsToNext: result.progression.pointsToNext,
                    benefits: result.progression.benefits,
                    message: `🛡️ ${result.passport.trustLevel.toUpperCase()} — ${result.passport.reputationScore} reputation, ${result.scarab.balance} Scarab`,
                };
            },
        },
        // --- NEW: DeFi Info ---
        {
            name: "maiat_defi_info",
            description: "Get trust data for a DeFi protocol by name or address. Examples: 'usdc', 'aerodrome', 'aave', '0x833589...'",
            schema: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Protocol slug (e.g. 'usdc') or address (0x...)" },
                },
                required: ["query"],
            },
            handler: async (params) => {
                const result = await client.getDefiInfo(params.query);
                return {
                    name: result.entity.name,
                    address: result.entity.address,
                    category: result.entity.category,
                    auditedBy: result.entity.auditedBy || [],
                    trustScore: result.trust?.score ?? null,
                    reviews: result.reviews.total,
                    avgRating: result.reviews.avgRating,
                    url: result.canonical.url,
                };
            },
        },
        // --- NEW: Agent Info ---
        {
            name: "maiat_agent_info",
            description: "Get trust data for an AI agent by name or address. Examples: 'aixbt', 'virtuals', 'luna', '0x4f9fd6...'",
            schema: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Agent slug (e.g. 'aixbt') or address (0x...)" },
                },
                required: ["query"],
            },
            handler: async (params) => {
                const result = await client.getAgentInfo(params.query);
                return {
                    name: result.entity.name,
                    address: result.entity.address,
                    category: result.entity.category,
                    trustScore: result.trust?.score ?? null,
                    reviews: result.reviews.total,
                    avgRating: result.reviews.avgRating,
                    url: result.canonical.url,
                };
            },
        },
    ];
}
// ═══════════════════════════════════════════
//  Convenience Export
// ═══════════════════════════════════════════
/**
 * Create a Maiat trust plugin for AgentKit
 *
 * @example
 * ```ts
 * import { maiatTrustPlugin } from "@maiat/agentkit-plugin";
 *
 * const plugin = maiatTrustPlugin({
 *   minScore: 3.0,
 *   onBlocked: (addr, score) => console.log(`Blocked ${addr}: ${score}/10`)
 * });
 *
 * // Use with AgentKit
 * agent.use(plugin);
 * ```
 */
export function maiatTrustPlugin(config = {}) {
    return {
        name: "maiat-trust",
        version: "0.2.0",
        actions: maiatTrustActions(config),
        client: new MaiatClient(config),
    };
}
// Default export
export default maiatTrustPlugin;
