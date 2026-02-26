/**
 * @maiat/elizaos-plugin
 *
 * Maiat Trust Score plugin for ElizaOS (ai16z agent framework).
 *
 * V0.2.0 — Cold-start update:
 * - CHECK_TRUST: Trust score lookup (existing)
 * - SUBMIT_REVIEW: Submit reviews with Scarab staking
 * - GET_INTERACTIONS: Discover wallet contract interactions
 * - GET_PASSPORT: Reputation passport
 * - DEFI_INFO: Query DeFi protocols
 * - AGENT_INFO: Query AI agents
 *
 * @example
 * ```typescript
 * import { maiatPlugin } from "@maiat/elizaos-plugin";
 *
 * const agent = new ElizaAgent({
 *   plugins: [maiatPlugin({ minScore: 3.0 })],
 * });
 * ```
 */
// ═══════════════════════════════════════════
//  API Client (lightweight)
// ═══════════════════════════════════════════
function getHeaders(config) {
    const h = {
        "Content-Type": "application/json",
        "User-Agent": "maiat-elizaos-plugin/0.2.0",
    };
    if (config.apiKey)
        h["Authorization"] = `Bearer ${config.apiKey}`;
    return h;
}
function getApiUrl(config) {
    return config.apiUrl || "https://maiat-protocol.vercel.app";
}
async function queryMaiat(address, config) {
    const apiUrl = getApiUrl(config);
    const chain = config.chain || "base";
    const minScore = config.minScore ?? 3.0;
    const res = await fetch(`${apiUrl}/api/v1/score/${address}?chain=${chain}`, {
        headers: getHeaders(config),
    });
    if (!res.ok) {
        throw new Error(`Maiat API error: ${res.status}`);
    }
    const data = await res.json();
    return {
        address: data.address,
        score: data.score,
        risk: data.risk,
        type: data.type,
        flags: data.flags || [],
        safe: data.score >= minScore,
    };
}
// ═══════════════════════════════════════════
//  ElizaOS Plugin
// ═══════════════════════════════════════════
/**
 * ElizaOS plugin definition following the standard plugin interface.
 *
 * Registers:
 * - Actions: CHECK_TRUST, SUBMIT_REVIEW, GET_INTERACTIONS, GET_PASSPORT, DEFI_INFO, AGENT_INFO
 * - Evaluator: TRUST_GATE
 * - Provider: TRUST_DATA
 */
export function maiatPlugin(config = {}) {
    const apiUrl = getApiUrl(config);
    const headers = getHeaders(config);
    return {
        name: "maiat-trust",
        description: "Trust scoring for on-chain addresses via Maiat Protocol",
        actions: [
            // --- Existing: CHECK_TRUST ---
            {
                name: "CHECK_TRUST",
                description: "Check the trust score of an on-chain address",
                examples: [
                    "Is 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24 safe?",
                    "Check trust score for 0x1234...",
                    "Should I interact with this address: 0xabcd...?",
                ],
                validate: async (message) => {
                    return /0x[a-fA-F0-9]{40}/.test(message);
                },
                handler: async (message) => {
                    const match = message.match(/0x[a-fA-F0-9]{40}/);
                    if (!match)
                        return { text: "Please provide a valid Ethereum address (0x...)" };
                    try {
                        const result = await queryMaiat(match[0], config);
                        const emoji = result.safe ? "🟢" : result.risk === "CRITICAL" ? "🔴" : "🟡";
                        return {
                            text: `${emoji} **Trust Score: ${result.score}/10** (${result.risk} risk)\n\nAddress: \`${result.address}\`\nType: ${result.type}\nFlags: ${result.flags.join(", ") || "None"}\n\n${result.safe ? "✅ Safe to interact." : "⚠️ Exercise caution — low trust score."}`,
                            data: result,
                        };
                    }
                    catch (error) {
                        return {
                            text: `❌ Could not check trust score: ${error instanceof Error ? error.message : "Unknown error"}`,
                        };
                    }
                },
            },
            // --- NEW: SUBMIT_REVIEW ---
            {
                name: "SUBMIT_REVIEW",
                description: "Submit a trust review for a contract. Costs 2 Scarab, earn 3-10 for quality.",
                examples: [
                    "Review 0x833589... — rating 8, great stablecoin",
                    "Submit review: address 0xabc, rating 3, seems risky",
                ],
                validate: async (message) => /0x[a-fA-F0-9]{40}/.test(message) && /\d/.test(message),
                handler: async (message) => {
                    const addrMatch = message.match(/0x[a-fA-F0-9]{40}/);
                    const ratingMatch = message.match(/rating\s*:?\s*(\d+)/i) || message.match(/(\d+)\s*\/\s*10/);
                    if (!addrMatch)
                        return { text: "Please provide a contract address (0x...)" };
                    const rating = ratingMatch ? Math.min(10, Math.max(1, parseInt(ratingMatch[1]))) : 5;
                    try {
                        const res = await fetch(`${apiUrl}/api/v1/review`, {
                            method: "POST",
                            headers,
                            body: JSON.stringify({
                                address: addrMatch[0],
                                rating,
                                comment: message,
                                reviewer: "eliza-agent",
                            }),
                        });
                        const data = await res.json();
                        if (!res.ok)
                            throw new Error(data.error || `HTTP ${res.status}`);
                        return {
                            text: `✅ Review submitted!\n\n- Address: \`${addrMatch[0]}\`\n- Rating: ${rating}/10\n- Scarab earned: ${data.meta?.scarabReward || 0} 🪲`,
                            data,
                        };
                    }
                    catch (error) {
                        return { text: `❌ Review failed: ${error instanceof Error ? error.message : "Unknown error"}` };
                    }
                },
            },
            // --- NEW: GET_INTERACTIONS ---
            {
                name: "GET_INTERACTIONS",
                description: "Discover which contracts a wallet has interacted with",
                examples: [
                    "What contracts has 0x1234... interacted with?",
                    "Show interactions for 0xabcd...",
                ],
                validate: async (message) => /0x[a-fA-F0-9]{40}/.test(message),
                handler: async (message) => {
                    const match = message.match(/0x[a-fA-F0-9]{40}/);
                    if (!match)
                        return { text: "Please provide a wallet address." };
                    try {
                        const res = await fetch(`${apiUrl}/api/v1/wallet/${match[0]}/interactions`, { headers });
                        if (!res.ok)
                            throw new Error(`HTTP ${res.status}`);
                        const data = await res.json();
                        const list = data.interacted?.map((c) => `  • ${c.name} (${c.category}) — ${c.txCount} txs`).join("\n") || "None found";
                        return {
                            text: `📋 Wallet Interactions (${data.interactedCount} contracts):\n\n${list}`,
                            data,
                        };
                    }
                    catch (error) {
                        return { text: `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}` };
                    }
                },
            },
            // --- NEW: GET_PASSPORT ---
            {
                name: "GET_PASSPORT",
                description: "Get a wallet's reputation passport",
                examples: [
                    "Show passport for 0x1234...",
                    "What's my reputation level?",
                ],
                validate: async (message) => /0x[a-fA-F0-9]{40}/.test(message),
                handler: async (message) => {
                    const match = message.match(/0x[a-fA-F0-9]{40}/);
                    if (!match)
                        return { text: "Please provide a wallet address." };
                    try {
                        const res = await fetch(`${apiUrl}/api/v1/wallet/${match[0]}/passport`, { headers });
                        if (!res.ok)
                            throw new Error(`HTTP ${res.status}`);
                        const data = await res.json();
                        const p = data.passport;
                        return {
                            text: `🛡️ Reputation Passport\n\n- Trust Level: ${p.trustLevel.toUpperCase()}\n- Reputation: ${p.reputationScore}\n- Reviews: ${p.totalReviews}\n- Scarab: ${data.scarab?.balance || 0} 🪲\n- Fee Tier: ${p.feeTier.discount}`,
                            data,
                        };
                    }
                    catch (error) {
                        return { text: `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}` };
                    }
                },
            },
            // --- NEW: DEFI_INFO ---
            {
                name: "DEFI_INFO",
                description: "Look up a DeFi protocol by name or address",
                examples: [
                    "Tell me about USDC",
                    "What's the trust score for Aerodrome?",
                    "Look up 0x833589...",
                ],
                validate: async (message) => true,
                handler: async (message) => {
                    const addrMatch = message.match(/0x[a-fA-F0-9]{40}/);
                    const slugMatch = message.match(/\b(usdc|weth|dai|aerodrome|aave|compound|morpho|uniswap|chainlink|stargate)\b/i);
                    const query = addrMatch?.[0] || slugMatch?.[0]?.toLowerCase();
                    if (!query)
                        return { text: "Please specify a DeFi protocol name (e.g. USDC, Aave) or address." };
                    try {
                        const res = await fetch(`${apiUrl}/api/v1/defi/${query}`, { headers });
                        if (!res.ok)
                            throw new Error(res.status === 404 ? `"${query}" not found` : `HTTP ${res.status}`);
                        const data = await res.json();
                        const e = data.entity;
                        return {
                            text: `📊 ${e.name}\n\n- Address: \`${e.address}\`\n- Category: ${e.category}\n- Trust: ${data.trust?.score ?? "N/A"}/10\n- Reviews: ${data.reviews?.total || 0}`,
                            data,
                        };
                    }
                    catch (error) {
                        return { text: `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}` };
                    }
                },
            },
            // --- NEW: AGENT_INFO ---
            {
                name: "AGENT_INFO",
                description: "Look up an AI agent by name or address",
                examples: [
                    "Tell me about AIXBT",
                    "What's Virtuals trust score?",
                    "Look up agent 0x4f9fd6...",
                ],
                validate: async (message) => true,
                handler: async (message) => {
                    const addrMatch = message.match(/0x[a-fA-F0-9]{40}/);
                    const slugMatch = message.match(/\b(aixbt|virtuals|luna|vaderai|freysa|sekoia)\b/i);
                    const query = addrMatch?.[0] || slugMatch?.[0]?.toLowerCase();
                    if (!query)
                        return { text: "Please specify an agent name (e.g. AIXBT, Virtuals) or address." };
                    try {
                        const res = await fetch(`${apiUrl}/api/v1/agent/${query}`, { headers });
                        if (!res.ok)
                            throw new Error(res.status === 404 ? `"${query}" not found` : `HTTP ${res.status}`);
                        const data = await res.json();
                        const e = data.entity;
                        return {
                            text: `🤖 ${e.name}\n\n- Address: \`${e.address}\`\n- Category: ${e.category}\n- Trust: ${data.trust?.score ?? "N/A"}/10\n- Reviews: ${data.reviews?.total || 0}`,
                            data,
                        };
                    }
                    catch (error) {
                        return { text: `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}` };
                    }
                },
            },
        ],
        evaluators: [
            {
                name: "TRUST_GATE",
                description: "Evaluates if a target address meets minimum trust requirements",
                handler: async (context) => {
                    if (!context.address)
                        return { pass: true, reason: "No address to check" };
                    try {
                        const result = await queryMaiat(context.address, config);
                        return {
                            pass: result.safe,
                            score: result.score,
                            risk: result.risk,
                            reason: result.safe
                                ? `Address trusted (${result.score}/10)`
                                : `Address untrusted (${result.score}/10, ${result.risk} risk)`,
                        };
                    }
                    catch {
                        return { pass: false, reason: "Trust check failed — blocking by default" };
                    }
                },
            },
        ],
        providers: [
            {
                name: "TRUST_DATA",
                description: "Provides trust scoring context for agent reasoning",
                handler: async () => {
                    return {
                        text: "You have Maiat trust scoring. Use CHECK_TRUST for address safety, SUBMIT_REVIEW to review contracts, GET_INTERACTIONS to discover wallet activity, GET_PASSPORT for reputation, DEFI_INFO/AGENT_INFO to look up protocols and agents.",
                    };
                },
            },
        ],
    };
}
export default maiatPlugin;
