import { Maiat } from "@jhinresh/maiat-sdk";
/**
 * ElizaOS plugin definition following the standard plugin interface.
 */
export function maiatPlugin(config = {}) {
    const sdk = new Maiat({
        baseUrl: config.apiUrl,
        apiKey: config.apiKey,
        framework: "elizaos",
        clientId: "elizaos-plugin-standard"
    });
    const minScore = config.minScore ?? 60; // SDK uses 0-100 scale
    return {
        name: "maiat-trust",
        description: "Trust scoring, token safety, swap verification & outcome reporting via Maiat Protocol",
        actions: [
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
                        const result = await sdk.agentTrust(match[0]);
                        const safe = result.trustScore >= minScore;
                        const emoji = safe ? "🟢" : result.verdict === "avoid" ? "🔴" : "🟡";
                        return {
                            text: `${emoji} **Trust Score: ${result.trustScore}/100** (${result.verdict} verdict)\n\nAddress: \`${result.address}\`\nSource: ${result.dataSource}\nJobs: ${result.breakdown.totalJobs}\n\n${safe ? "✅ Safe to interact." : "⚠️ Exercise caution — score below threshold."}`,
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
            {
                name: "CHECK_TOKEN",
                description: "Check if a token is safe (honeypot, rug pull, liquidity risks)",
                examples: [
                    "Is this token safe? 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                    "Check token 0xabcd...",
                    "Token safety check for 0x1234...",
                ],
                validate: async (message) => {
                    return /0x[a-fA-F0-9]{40}/.test(message);
                },
                handler: async (message) => {
                    const match = message.match(/0x[a-fA-F0-9]{40}/);
                    if (!match)
                        return { text: "Please provide a valid token address (0x...)" };
                    try {
                        const result = await sdk.tokenCheck(match[0]);
                        const safe = result.verdict === "proceed";
                        const emoji = safe ? "🟢" : result.verdict === "avoid" ? "🔴" : "🟡";
                        return {
                            text: `${emoji} **Token Safety: ${result.trustScore}/100** (${result.verdict} verdict)\n\nAddress: \`${result.address}\`\nType: ${result.tokenType}\nRisk: ${result.riskSummary}\nFlags: ${result.riskFlags.length > 0 ? result.riskFlags.join(", ") : "None"}\n\n${safe ? "✅ Token appears safe." : "⚠️ Token has risk flags — proceed with caution."}`,
                            data: result,
                        };
                    }
                    catch (error) {
                        return {
                            text: `❌ Could not check token: ${error instanceof Error ? error.message : "Unknown error"}`,
                        };
                    }
                },
            },
            {
                name: "TRUST_SWAP",
                description: "Get a trust-verified swap quote with safety checks on both tokens",
                examples: [
                    "Get a trust-verified swap quote for 1 ETH to USDC",
                    "Trust swap 0x... to 0x... amount 1000000",
                    "Swap quote with trust verification",
                ],
                validate: async (message) => {
                    return /0x[a-fA-F0-9]{40}/.test(message);
                },
                handler: async (message) => {
                    const addresses = message.match(/0x[a-fA-F0-9]{40}/g);
                    if (!addresses || addresses.length < 2) {
                        return { text: "Please provide swapper address, tokenIn, and tokenOut addresses (0x...)" };
                    }
                    const amountMatch = message.match(/amount\s+(\d+)/i);
                    const amount = amountMatch ? amountMatch[1] : "1000000000000000000";
                    try {
                        const result = await sdk.trustSwap({
                            swapper: addresses[0],
                            tokenIn: addresses.length >= 3 ? addresses[1] : addresses[0],
                            tokenOut: addresses.length >= 3 ? addresses[2] : addresses[1],
                            amount,
                        });
                        const trustIn = result.trust.tokenIn;
                        const trustOut = result.trust.tokenOut;
                        return {
                            text: `🔄 **Trust-Verified Swap Quote**\n\nToken In Trust: ${trustIn ? `${trustIn.score}/100 (${trustIn.risk})` : "N/A"}\nToken Out Trust: ${trustOut ? `${trustOut.score}/100 (${trustOut.risk})` : "N/A"}\nCalldata: ${result.calldata ? "Ready" : "Not available"}\nTimestamp: ${result.timestamp}`,
                            data: result,
                        };
                    }
                    catch (error) {
                        return {
                            text: `❌ Swap quote failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                        };
                    }
                },
            },
            {
                name: "REPORT_OUTCOME",
                description: "Report the outcome of a job back to the Maiat trust oracle",
                examples: [
                    "Report outcome for job abc-123 as success",
                    "Report job failure for xyz-456",
                    "Job abc completed successfully",
                ],
                validate: async (_message) => {
                    return true;
                },
                handler: async (message) => {
                    const jobMatch = message.match(/(?:job\s+)?([a-zA-Z0-9_-]+)/i);
                    if (!jobMatch)
                        return { text: "Please provide a job ID to report outcome for." };
                    const outcomeMatch = message.match(/\b(success|failure|partial|expired)\b/i);
                    const outcome = (outcomeMatch ? outcomeMatch[1].toLowerCase() : "success");
                    try {
                        const result = await sdk.reportOutcome({
                            jobId: jobMatch[1],
                            outcome,
                        });
                        return {
                            text: `📋 **Outcome Reported**\n\nJob: ${jobMatch[1]}\nOutcome: ${outcome}\nLogged: ${result.success ? "Yes" : "No"}${result.id ? `\nID: ${result.id}` : ""}`,
                            data: result,
                        };
                    }
                    catch (error) {
                        return {
                            text: `❌ Could not report outcome: ${error instanceof Error ? error.message : "Unknown error"}`,
                        };
                    }
                },
            },
            {
                name: "DEEP_ANALYSIS",
                description: "Get deep analysis on an agent address with percentile ranking and risk signals",
                examples: [
                    "Deep analysis on 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
                    "Analyze 0xabcd... in depth",
                    "Deep trust check for 0x1234...",
                ],
                validate: async (message) => {
                    return /0x[a-fA-F0-9]{40}/.test(message);
                },
                handler: async (message) => {
                    const match = message.match(/0x[a-fA-F0-9]{40}/);
                    if (!match)
                        return { text: "Please provide a valid Ethereum address (0x...)" };
                    try {
                        const result = await sdk.deep(match[0]);
                        const emoji = result.verdict === "proceed" ? "🟢" : result.verdict === "avoid" ? "🔴" : "🟡";
                        return {
                            text: `${emoji} **Deep Analysis: ${result.trustScore}/100** (${result.verdict} verdict)\n\nAddress: \`${result.address}\`\nSignals: ${JSON.stringify(result.signals)}\nLast Updated: ${result.lastUpdated}`,
                            data: result,
                        };
                    }
                    catch (error) {
                        return {
                            text: `❌ Deep analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                        };
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
                        const result = await sdk.agentTrust(context.address);
                        const safe = result.trustScore >= minScore;
                        return {
                            pass: safe,
                            score: result.trustScore,
                            verdict: result.verdict,
                            reason: safe
                                ? `Address trusted (${result.trustScore}/100)`
                                : `Address untrusted (${result.trustScore}/100, ${result.verdict} verdict)`,
                        };
                    }
                    catch {
                        return { pass: false, reason: "Trust check failed — blocking by default" };
                    }
                },
            },
            {
                name: "TOKEN_GATE",
                description: "Evaluates if a token is safe to interact with",
                handler: async (context) => {
                    if (!context.address)
                        return { pass: true, reason: "No token address to check" };
                    try {
                        const safe = await sdk.isTokenSafe(context.address);
                        return {
                            pass: safe,
                            reason: safe
                                ? `Token is safe to interact with`
                                : `Token failed safety check — blocking interaction`,
                        };
                    }
                    catch {
                        return { pass: false, reason: "Token safety check failed — blocking by default" };
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
                        text: `You have access to Maiat trust scoring and token safety tools. Available actions:\n- CHECK_TRUST: Verify an agent's trust score before interacting\n- CHECK_TOKEN: Check if a token is safe (honeypot, rug pull detection)\n- TRUST_SWAP: Get trust-verified swap quotes with safety checks\n- DEEP_ANALYSIS: Get deep analysis with percentile ranking and risk signals\n- REPORT_OUTCOME: Report job outcomes to improve the trust oracle\n\nAddresses scoring below ${minScore}/100 should be avoided. Always check trust before transacting.`,
                    };
                },
            },
        ],
    };
}
export default maiatPlugin;
