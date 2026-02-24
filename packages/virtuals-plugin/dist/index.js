/**
 * @maiat/virtuals-plugin
 *
 * Maiat Trust Score plugin for Virtuals Protocol GAME SDK.
 * Adds trust-gated address checking to any GAME agent.
 *
 * Usage:
 * ```typescript
 * import { GameWorker, GameAgent } from "@virtuals-protocol/game";
 * import { createMaiatWorker } from "@maiat/virtuals-plugin";
 *
 * const maiatWorker = createMaiatWorker({ minScore: 3.0 });
 *
 * const agent = new GameAgent(process.env.GAME_API_KEY!, {
 *   name: "TrustGuardAgent",
 *   goal: "Only interact with trusted on-chain addresses",
 *   description: "An agent that verifies trust before every on-chain action",
 *   workers: [maiatWorker],
 * });
 *
 * await agent.init();
 * await agent.run(10);
 * ```
 */
// ═══════════════════════════════════════════
//  GAME SDK compatible types (peer dep compatible)
// ═══════════════════════════════════════════
export var ExecutableGameFunctionStatus;
(function (ExecutableGameFunctionStatus) {
    ExecutableGameFunctionStatus["Done"] = "done";
    ExecutableGameFunctionStatus["Failed"] = "failed";
})(ExecutableGameFunctionStatus || (ExecutableGameFunctionStatus = {}));
// ═══════════════════════════════════════════
//  Maiat API Client
// ═══════════════════════════════════════════
export class MaiatClient {
    apiUrl;
    apiKey;
    chain;
    cache = new Map();
    constructor(config = {}) {
        this.apiUrl = config.apiUrl ?? "https://maiat-protocol.vercel.app";
        this.apiKey = config.apiKey ?? "";
        this.chain = config.chain ?? "base";
    }
    get headers() {
        const h = {
            "Content-Type": "application/json",
            "User-Agent": "maiat-virtuals-plugin/0.2.0",
        };
        if (this.apiKey)
            h["Authorization"] = `Bearer ${this.apiKey}`;
        return h;
    }
    async checkTrust(address) {
        const key = `${address}:${this.chain}`;
        const hit = this.cache.get(key);
        if (hit && hit.exp > Date.now())
            return hit.data;
        const res = await fetch(`${this.apiUrl}/api/v1/score/${address}?chain=${this.chain}`, { headers: this.headers });
        if (!res.ok)
            throw new Error(`Maiat API ${res.status}: ${await res.text()}`);
        const data = await res.json();
        this.cache.set(key, { data, exp: Date.now() + 5 * 60_000 });
        return data;
    }
    async submitReview(review) {
        const res = await fetch(`${this.apiUrl}/api/v1/review`, {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify(review),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
            throw new Error(err.error || `HTTP ${res.status}`);
        }
        return res.json();
    }
    async getInteractions(wallet) {
        const res = await fetch(`${this.apiUrl}/api/v1/wallet/${wallet}/interactions`, { headers: this.headers });
        if (!res.ok)
            throw new Error(`HTTP ${res.status}`);
        return res.json();
    }
    async getPassport(wallet) {
        const res = await fetch(`${this.apiUrl}/api/v1/wallet/${wallet}/passport`, { headers: this.headers });
        if (!res.ok)
            throw new Error(`HTTP ${res.status}`);
        return res.json();
    }
    async getDefiInfo(query) {
        const res = await fetch(`${this.apiUrl}/api/v1/defi/${query}`, { headers: this.headers });
        if (!res.ok)
            throw new Error(`HTTP ${res.status}`);
        return res.json();
    }
    async getAgentInfo(query) {
        const res = await fetch(`${this.apiUrl}/api/v1/agent/${query}`, { headers: this.headers });
        if (!res.ok)
            throw new Error(`HTTP ${res.status}`);
        return res.json();
    }
}
// ═══════════════════════════════════════════
//  GAME Function Definitions
// ═══════════════════════════════════════════
/**
 * Returns plain function configs compatible with GameFunction constructor.
 * V0.2.0: Added submitReview, getInteractions, getPassport, defiInfo, agentInfo
 */
export function maiatFunctionConfigs(config = {}) {
    const client = new MaiatClient(config);
    const minScore = config.minScore ?? 3.0;
    const warnOnly = config.warnOnly ?? false;
    const checkTrustConfig = {
        name: "maiat_check_trust",
        description: `Check the Maiat trust score (0-10) for an on-chain address. Scores below ${minScore} indicate risky addresses. Use before sending funds or interacting with a contract.`,
        args: [
            { name: "address", description: "On-chain address to check (0x...)" },
            { name: "chain", description: "Chain: base, ethereum, bnb. Default: base", optional: true },
        ],
        executable: async (args, logger) => {
            try {
                logger(`[Maiat] Checking trust for ${args.address}...`);
                const result = await client.checkTrust(args.address);
                const safe = result.score >= minScore;
                const summary = [
                    `Address: ${result.address}`,
                    `Trust Score: ${result.score}/10`,
                    `Risk: ${result.risk}`,
                    `Type: ${result.type}`,
                    result.flags.length ? `Flags: ${result.flags.join(", ")}` : null,
                    `Breakdown: on-chain=${result.breakdown.onChainHistory}, contracts=${result.breakdown.contractAnalysis}, blacklist=${result.breakdown.blacklistCheck}`,
                    safe
                        ? `✅ Safe to interact (score ≥ ${minScore})`
                        : `⚠️ ${warnOnly ? "Warning" : "Blocked"}: trust score ${result.score} < ${minScore}`,
                ]
                    .filter(Boolean)
                    .join("\n");
                logger(`[Maiat] ${safe ? "SAFE" : "RISKY"} — ${result.score}/10`);
                return {
                    status: ExecutableGameFunctionStatus.Done,
                    feedback: summary,
                };
            }
            catch (err) {
                return {
                    status: ExecutableGameFunctionStatus.Failed,
                    feedback: `Maiat trust check failed: ${err instanceof Error ? err.message : String(err)}`,
                };
            }
        },
    };
    const gateTxConfig = {
        name: "maiat_gate_transaction",
        description: `Verify that a transaction target is trusted before proceeding. Returns approved=true if trust score ≥ ${minScore}, blocked otherwise. Always call this before sending tokens or calling contracts.`,
        args: [
            { name: "to", description: "Target address of the transaction" },
            { name: "action", description: "What you intend to do (for logging)", optional: true },
        ],
        executable: async (args, logger) => {
            try {
                logger(`[Maiat] Trust-gating transaction to ${args.to}${args.action ? ` (${args.action})` : ""}...`);
                const result = await client.checkTrust(args.to);
                const safe = result.score >= minScore;
                if (!safe && !warnOnly) {
                    logger(`[Maiat] BLOCKED — ${args.to} scored ${result.score}/10`);
                    return {
                        status: ExecutableGameFunctionStatus.Failed,
                        feedback: `Transaction BLOCKED: ${args.to} has trust score ${result.score}/10 (${result.risk} risk). Minimum required: ${minScore}. Flags: ${result.flags.join(", ") || "none"}`,
                    };
                }
                logger(`[Maiat] ${safe ? "APPROVED" : "WARNING"} — ${result.score}/10`);
                return {
                    status: ExecutableGameFunctionStatus.Done,
                    feedback: `Transaction ${safe ? "APPROVED" : "WARNING (proceeding with caution)"}: ${args.to} scored ${result.score}/10 (${result.risk} risk).`,
                };
            }
            catch (err) {
                return {
                    status: ExecutableGameFunctionStatus.Failed,
                    feedback: `Maiat gate check failed: ${err instanceof Error ? err.message : String(err)}`,
                };
            }
        },
    };
    // --- NEW: Submit Review ---
    const submitReviewConfig = {
        name: "maiat_submit_review",
        description: "Submit a trust review for a contract. Costs 2 Scarab, earn 3-10 for quality.",
        args: [
            { name: "address", description: "Contract address to review (0x...)" },
            { name: "rating", description: "Rating from 1-10" },
            { name: "comment", description: "Review text", optional: true },
            { name: "reviewer", description: "Your wallet address (0x...)" },
        ],
        executable: async (args, logger) => {
            try {
                logger(`[Maiat] Submitting review for ${args.address}...`);
                const result = await client.submitReview({
                    address: args.address,
                    rating: parseInt(args.rating) || 5,
                    comment: args.comment || "",
                    reviewer: args.reviewer,
                });
                return {
                    status: ExecutableGameFunctionStatus.Done,
                    feedback: `✅ Review submitted! Scarab earned: ${result.meta?.scarabReward || 0}`,
                };
            }
            catch (err) {
                return {
                    status: ExecutableGameFunctionStatus.Failed,
                    feedback: `Review failed: ${err instanceof Error ? err.message : String(err)}`,
                };
            }
        },
    };
    // --- NEW: Get Interactions ---
    const getInteractionsConfig = {
        name: "maiat_get_interactions",
        description: "Discover which contracts a wallet has interacted with on Base.",
        args: [
            { name: "wallet", description: "Wallet address (0x...)" },
        ],
        executable: async (args, logger) => {
            try {
                logger(`[Maiat] Discovering interactions for ${args.wallet}...`);
                const data = await client.getInteractions(args.wallet);
                const list = data.interacted?.map((c) => `${c.name} (${c.txCount} txs)`).join(", ") || "None";
                return {
                    status: ExecutableGameFunctionStatus.Done,
                    feedback: `Found ${data.interactedCount} contracts: ${list}`,
                };
            }
            catch (err) {
                return {
                    status: ExecutableGameFunctionStatus.Failed,
                    feedback: `Error: ${err instanceof Error ? err.message : String(err)}`,
                };
            }
        },
    };
    // --- NEW: Get Passport ---
    const getPassportConfig = {
        name: "maiat_get_passport",
        description: "Get a wallet's reputation passport — trust level, Scarab balance, fee tier.",
        args: [
            { name: "wallet", description: "Wallet address (0x...)" },
        ],
        executable: async (args, logger) => {
            try {
                logger(`[Maiat] Getting passport for ${args.wallet}...`);
                const data = await client.getPassport(args.wallet);
                const p = data.passport;
                return {
                    status: ExecutableGameFunctionStatus.Done,
                    feedback: `🛡️ ${p.trustLevel.toUpperCase()} — Rep: ${p.reputationScore}, Reviews: ${p.totalReviews}, Scarab: ${data.scarab?.balance || 0}, Fee: ${p.feeTier.discount}`,
                };
            }
            catch (err) {
                return {
                    status: ExecutableGameFunctionStatus.Failed,
                    feedback: `Error: ${err instanceof Error ? err.message : String(err)}`,
                };
            }
        },
    };
    // --- NEW: DeFi Info ---
    const defiInfoConfig = {
        name: "maiat_defi_info",
        description: "Get trust data for a DeFi protocol by name or address. Examples: 'usdc', 'aave', '0x833589...'",
        args: [
            { name: "query", description: "Protocol slug (e.g. 'usdc') or address (0x...)" },
        ],
        executable: async (args, logger) => {
            try {
                logger(`[Maiat] Looking up DeFi: ${args.query}...`);
                const data = await client.getDefiInfo(args.query);
                return {
                    status: ExecutableGameFunctionStatus.Done,
                    feedback: `${data.entity.name} — Score: ${data.trust?.score ?? "N/A"}/10, Reviews: ${data.reviews?.total || 0}, Category: ${data.entity.category}`,
                };
            }
            catch (err) {
                return {
                    status: ExecutableGameFunctionStatus.Failed,
                    feedback: `Error: ${err instanceof Error ? err.message : String(err)}`,
                };
            }
        },
    };
    // --- NEW: Agent Info ---
    const agentInfoConfig = {
        name: "maiat_agent_info",
        description: "Get trust data for an AI agent by name or address. Examples: 'aixbt', 'virtuals', '0x4f9fd6...'",
        args: [
            { name: "query", description: "Agent slug (e.g. 'aixbt') or address (0x...)" },
        ],
        executable: async (args, logger) => {
            try {
                logger(`[Maiat] Looking up Agent: ${args.query}...`);
                const data = await client.getAgentInfo(args.query);
                return {
                    status: ExecutableGameFunctionStatus.Done,
                    feedback: `${data.entity.name} — Score: ${data.trust?.score ?? "N/A"}/10, Reviews: ${data.reviews?.total || 0}, Category: ${data.entity.category}`,
                };
            }
            catch (err) {
                return {
                    status: ExecutableGameFunctionStatus.Failed,
                    feedback: `Error: ${err instanceof Error ? err.message : String(err)}`,
                };
            }
        },
    };
    return {
        checkTrustConfig,
        gateTxConfig,
        submitReviewConfig,
        getInteractionsConfig,
        getPassportConfig,
        defiInfoConfig,
        agentInfoConfig,
    };
}
// ═══════════════════════════════════════════
//  createMaiatWorker — Plug-and-play for GAME SDK
// ═══════════════════════════════════════════
/**
 * Create a GAME-compatible worker with Maiat trust functions.
 * Requires @virtuals-protocol/game to be installed.
 *
 * V0.2.0: Now includes 7 functions (trust, gate, review, interactions, passport, defi, agent)
 */
export async function createMaiatWorker(config = {}) {
    // Dynamic import to keep @virtuals-protocol/game as a peer dep
    let GameFunction;
    let GameWorker;
    try {
        // @ts-ignore
        const sdk = await import("@virtuals-protocol/game");
        GameFunction = sdk["GameFunction"];
        GameWorker = sdk["GameWorker"];
    }
    catch {
        throw new Error("@virtuals-protocol/game is required. Install it: npm install @virtuals-protocol/game");
    }
    const configs = maiatFunctionConfigs(config);
    const functions = [
        new GameFunction(configs.checkTrustConfig),
        new GameFunction(configs.gateTxConfig),
        new GameFunction(configs.submitReviewConfig),
        new GameFunction(configs.getInteractionsConfig),
        new GameFunction(configs.getPassportConfig),
        new GameFunction(configs.defiInfoConfig),
        new GameFunction(configs.agentInfoConfig),
    ];
    return new GameWorker({
        id: "maiat-trust-worker",
        name: "Maiat Trust Scorer",
        description: "Checks on-chain trust scores, submits reviews, discovers wallet interactions, and queries DeFi/Agent info using the Maiat Protocol. Use before any financial transaction.",
        functions,
    });
}
export default createMaiatWorker;
