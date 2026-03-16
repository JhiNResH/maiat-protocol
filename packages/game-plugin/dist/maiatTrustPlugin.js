"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaiatTrustPlugin = void 0;
const game_1 = require("@virtuals-protocol/game");
const maiat_sdk_1 = require("@jhinresh/maiat-sdk");
// ─────────────────────────────────────────────
//  Config
// ─────────────────────────────────────────────
const DEFAULT_MIN_SCORE = 30; // 0–100 scale
// ─────────────────────────────────────────────
//  Plugin class
// ─────────────────────────────────────────────
class MaiatTrustPlugin {
    constructor(options = {}) {
        this.id = options.id ?? "maiat_trust_worker";
        this.name = options.name ?? "Maiat Trust Score Worker";
        this.description =
            options.description ??
                "Queries Maiat Protocol for trust scores of on-chain addresses, tokens, " +
                    "DeFi protocols, and AI agents. Use before executing any swap, transfer, " +
                    "or interaction to assess counterparty risk.";
        this.sdk = new maiat_sdk_1.Maiat({
            baseUrl: options.apiUrl,
            apiKey: options.apiKey,
            framework: "game-engine",
            clientId: "game-plugin-standard"
        });
        this.minScore = options.minScore ?? DEFAULT_MIN_SCORE;
    }
    getWorker(data) {
        return new game_1.GameWorker({
            id: this.id,
            name: this.name,
            description: this.description,
            functions: data?.functions ?? [
                this.checkTrustScore,
                this.gateSwap,
                this.batchCheckTrust,
                this.checkToken,
                this.trustSwap,
                this.reportOutcome,
            ],
            getEnvironment: data?.getEnvironment,
        });
    }
    // ── Function 1: check_trust_score ─────────────
    get checkTrustScore() {
        return new game_1.GameFunction({
            name: "check_trust_score",
            description: "Query the Maiat trust score for an on-chain address, token, DeFi protocol, " +
                "or AI agent. Returns a score (0–100), risk level, and any warning flags. " +
                "Use this before interacting with an unknown address or protocol.",
            args: [
                {
                    name: "identifier",
                    description: "Ethereum/Base address (0x...) OR project/agent name (e.g. 'Uniswap', 'AIXBT').",
                    type: "string",
                }
            ],
            executable: async (args, logger) => {
                try {
                    if (!args.identifier) {
                        return new game_1.ExecutableGameFunctionResponse(game_1.ExecutableGameFunctionStatus.Failed, "identifier is required (address or project name)");
                    }
                    logger(`[Maiat] Checking trust score for: ${args.identifier}`);
                    const res = await this.sdk.agentTrust(args.identifier);
                    const result = {
                        address: res.address,
                        score: res.trustScore,
                        risk: res.verdict === 'avoid' ? 'high' : (res.verdict === 'caution' ? 'medium' : 'low'),
                        type: res.dataSource,
                        flags: [],
                        safe: res.trustScore >= this.minScore,
                        source: "maiat"
                    };
                    const summary = `Trust score for ${args.identifier}: ${result.score}/100 ` +
                        `| Risk: ${result.risk.toUpperCase()} ` +
                        `| Safe: ${result.safe ? "YES" : "NO"}`;
                    logger(`[Maiat] ${summary}`);
                    return new game_1.ExecutableGameFunctionResponse(game_1.ExecutableGameFunctionStatus.Done, JSON.stringify({ ...result, summary }));
                }
                catch (e) {
                    logger(`[Maiat] Error: ${e.message}`);
                    return new game_1.ExecutableGameFunctionResponse(game_1.ExecutableGameFunctionStatus.Failed, `Failed to query trust score: ${e.message}`);
                }
            },
        });
    }
    // ── Function 2: gate_swap ─────────────────────
    get gateSwap() {
        return new game_1.GameFunction({
            name: "gate_swap",
            description: "Check whether a swap is safe to execute based on Maiat trust scores for " +
                "both the input and output tokens. Returns APPROVED or REJECTED with reasons. " +
                "Always call this before executing a token swap.",
            args: [
                {
                    name: "token_in",
                    description: "Address or name of the token being sold (input token).",
                    type: "string",
                },
                {
                    name: "token_out",
                    description: "Address or name of the token being bought (output token).",
                    type: "string",
                },
                {
                    name: "min_score",
                    description: `Minimum trust score required (0–100).`,
                    type: "number",
                    optional: true,
                },
            ],
            executable: async (args, logger) => {
                try {
                    if (!args.token_in || !args.token_out) {
                        return new game_1.ExecutableGameFunctionResponse(game_1.ExecutableGameFunctionStatus.Failed, "Both token_in and token_out are required");
                    }
                    const minScore = args.min_score ?? this.minScore;
                    logger(`[Maiat] Gating swap: ${args.token_in} → ${args.token_out} (min score: ${minScore})`);
                    const [resIn, resOut] = await Promise.all([
                        this.sdk.agentTrust(args.token_in),
                        this.sdk.agentTrust(args.token_out),
                    ]);
                    const scoreIn = resIn.trustScore;
                    const scoreOut = resOut.trustScore;
                    const rejected = [];
                    if (scoreIn < minScore) {
                        rejected.push(`${args.token_in} score ${scoreIn} < ${minScore}`);
                    }
                    if (scoreOut < minScore) {
                        rejected.push(`${args.token_out} score ${scoreOut} < ${minScore}`);
                    }
                    if (rejected.length > 0) {
                        const reason = `REJECTED: ${rejected.join("; ")}`;
                        logger(`[Maiat] ${reason}`);
                        return new game_1.ExecutableGameFunctionResponse(game_1.ExecutableGameFunctionStatus.Failed, reason);
                    }
                    const approval = `APPROVED: ${args.token_in} (${scoreIn}/100) → ` +
                        `${args.token_out} (${scoreOut}/100) — both pass threshold`;
                    logger(`[Maiat] ${approval}`);
                    return new game_1.ExecutableGameFunctionResponse(game_1.ExecutableGameFunctionStatus.Done, JSON.stringify({
                        approved: true,
                        message: approval,
                    }));
                }
                catch (e) {
                    logger(`[Maiat] Error: ${e.message}`);
                    return new game_1.ExecutableGameFunctionResponse(game_1.ExecutableGameFunctionStatus.Failed, `Failed to gate swap: ${e.message}`);
                }
            },
        });
    }
    // ── Function 3: batch_check_trust ─────────────
    get batchCheckTrust() {
        return new game_1.GameFunction({
            name: "batch_check_trust",
            description: "Check trust scores for multiple addresses or project names at once. " +
                "Returns a ranked list with risk levels. Useful for comparing options before trading.",
            args: [
                {
                    name: "identifiers",
                    description: "Comma-separated list of addresses or project names.",
                    type: "string",
                },
            ],
            executable: async (args, logger) => {
                try {
                    if (!args.identifiers) {
                        return new game_1.ExecutableGameFunctionResponse(game_1.ExecutableGameFunctionStatus.Failed, "identifiers is required (comma-separated list)");
                    }
                    const ids = args.identifiers
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .slice(0, 10); // max 10
                    logger(`[Maiat] Batch checking ${ids.length} identifiers`);
                    const results = await Promise.allSettled(ids.map((id) => this.sdk.agentTrust(id)));
                    const scores = results.map((r, i) => {
                        if (r.status === "fulfilled") {
                            return {
                                address: r.value.address,
                                score: r.value.trustScore,
                                risk: r.value.verdict,
                                safe: r.value.trustScore >= this.minScore
                            };
                        }
                        else {
                            return { address: ids[i], score: 0, risk: "unknown", safe: false, error: r.reason?.message };
                        }
                    });
                    // Sort by score descending
                    scores.sort((a, b) => b.score - a.score);
                    logger(`[Maiat] Batch complete. Top: ${scores[0]?.address} (${scores[0]?.score}/100)`);
                    return new game_1.ExecutableGameFunctionResponse(game_1.ExecutableGameFunctionStatus.Done, JSON.stringify({ count: scores.length, results: scores }));
                }
                catch (e) {
                    return new game_1.ExecutableGameFunctionResponse(game_1.ExecutableGameFunctionStatus.Failed, `Batch check failed: ${e.message}`);
                }
            },
        });
    }
    // ── Function 4: check_token ──────────────────
    get checkToken() {
        return new game_1.GameFunction({
            name: "check_token",
            description: "Check if a token is safe using Maiat's token safety and forensics analysis. " +
                "Detects honeypots, rug pulls, and liquidity risks. Returns a score (0–100) and risk flags.",
            args: [
                {
                    name: "address",
                    description: "Token contract address to check (0x...)",
                    type: "string",
                },
                {
                    name: "chain",
                    description: "Chain to query (default: base)",
                    type: "string",
                    optional: true,
                },
            ],
            executable: async (args, logger) => {
                try {
                    if (!args.address) {
                        return new game_1.ExecutableGameFunctionResponse(game_1.ExecutableGameFunctionStatus.Failed, "address is required");
                    }
                    logger(`[Maiat] Checking token safety for: ${args.address}`);
                    const [tokenRes, forensicsRes] = await Promise.all([
                        this.sdk.tokenCheck(args.address),
                        this.sdk.forensics(args.address, args.chain).catch(() => null),
                    ]);
                    const safe = tokenRes.verdict === "proceed";
                    const summary = [
                        `Token: ${tokenRes.address}`,
                        `Trust Score: ${tokenRes.trustScore}/100`,
                        `Verdict: ${tokenRes.verdict}`,
                        `Type: ${tokenRes.tokenType}`,
                        `Risk: ${tokenRes.riskSummary}`,
                        tokenRes.riskFlags.length > 0 ? `Flags: ${tokenRes.riskFlags.join(", ")}` : "Flags: None",
                        forensicsRes ? `Forensics Verdict: ${forensicsRes.verdict}` : null,
                        forensicsRes && forensicsRes.riskFlags.length > 0
                            ? `Forensics Flags: ${forensicsRes.riskFlags.join(", ")}`
                            : null,
                        safe ? "Safe: YES" : "Safe: NO — exercise caution",
                    ]
                        .filter(Boolean)
                        .join(" | ");
                    logger(`[Maiat] ${summary}`);
                    return new game_1.ExecutableGameFunctionResponse(game_1.ExecutableGameFunctionStatus.Done, JSON.stringify({
                        address: tokenRes.address,
                        score: tokenRes.trustScore,
                        verdict: tokenRes.verdict,
                        tokenType: tokenRes.tokenType,
                        riskFlags: tokenRes.riskFlags,
                        riskSummary: tokenRes.riskSummary,
                        forensics: forensicsRes
                            ? { verdict: forensicsRes.verdict, riskFlags: forensicsRes.riskFlags }
                            : null,
                        safe,
                        summary,
                    }));
                }
                catch (e) {
                    logger(`[Maiat] Error: ${e.message}`);
                    return new game_1.ExecutableGameFunctionResponse(game_1.ExecutableGameFunctionStatus.Failed, `Failed to check token: ${e.message}`);
                }
            },
        });
    }
    // ── Function 5: trust_swap ──────────────────
    get trustSwap() {
        return new game_1.GameFunction({
            name: "trust_swap",
            description: "Get a trust-verified swap quote with calldata. Checks both tokens for safety " +
                "before returning a Uniswap quote. Use this instead of raw DEX quotes.",
            args: [
                {
                    name: "swapper",
                    description: "Wallet address executing the swap (0x...)",
                    type: "string",
                },
                {
                    name: "token_in",
                    description: "Token being sold (0x...)",
                    type: "string",
                },
                {
                    name: "token_out",
                    description: "Token being bought (0x...)",
                    type: "string",
                },
                {
                    name: "amount",
                    description: "Amount of token_in in wei",
                    type: "string",
                },
                {
                    name: "slippage",
                    description: "Slippage tolerance (e.g. 0.5 for 0.5%)",
                    type: "string",
                    optional: true,
                },
            ],
            executable: async (args, logger) => {
                try {
                    if (!args.swapper || !args.token_in || !args.token_out || !args.amount) {
                        return new game_1.ExecutableGameFunctionResponse(game_1.ExecutableGameFunctionStatus.Failed, "swapper, token_in, token_out, and amount are all required");
                    }
                    logger(`[Maiat] Getting trust-verified swap: ${args.token_in} → ${args.token_out}...`);
                    const result = await this.sdk.trustSwap({
                        swapper: args.swapper,
                        tokenIn: args.token_in,
                        tokenOut: args.token_out,
                        amount: args.amount,
                        slippage: args.slippage ? parseFloat(args.slippage) : undefined,
                    });
                    const trustIn = result.trust.tokenIn;
                    const trustOut = result.trust.tokenOut;
                    const summary = `Swap: ${args.token_in} → ${args.token_out} | ` +
                        `In Trust: ${trustIn ? `${trustIn.score}/100 (${trustIn.risk})` : "N/A"} | ` +
                        `Out Trust: ${trustOut ? `${trustOut.score}/100 (${trustOut.risk})` : "N/A"} | ` +
                        `Calldata: ${result.calldata ? "Ready" : "N/A"}`;
                    logger(`[Maiat] ${summary}`);
                    return new game_1.ExecutableGameFunctionResponse(game_1.ExecutableGameFunctionStatus.Done, JSON.stringify(result));
                }
                catch (e) {
                    logger(`[Maiat] Error: ${e.message}`);
                    return new game_1.ExecutableGameFunctionResponse(game_1.ExecutableGameFunctionStatus.Failed, `Failed to get trust swap: ${e.message}`);
                }
            },
        });
    }
    // ── Function 6: report_outcome ──────────────
    get reportOutcome() {
        return new game_1.GameFunction({
            name: "report_outcome",
            description: "Report the outcome of a job back to the Maiat trust oracle. " +
                "Call this after completing, failing, or observing an expired job. Earns Scarab rewards.",
            args: [
                {
                    name: "job_id",
                    description: "The job ID to report outcome for",
                    type: "string",
                },
                {
                    name: "outcome",
                    description: "Outcome: success, failure, partial, or expired",
                    type: "string",
                },
                {
                    name: "reporter",
                    description: "Address of the reporter (optional)",
                    type: "string",
                    optional: true,
                },
                {
                    name: "note",
                    description: "Free-form note about the outcome (optional)",
                    type: "string",
                    optional: true,
                },
            ],
            executable: async (args, logger) => {
                try {
                    if (!args.job_id || !args.outcome) {
                        return new game_1.ExecutableGameFunctionResponse(game_1.ExecutableGameFunctionStatus.Failed, "job_id and outcome are required");
                    }
                    logger(`[Maiat] Reporting outcome for job ${args.job_id}: ${args.outcome}...`);
                    const result = await this.sdk.reportOutcome({
                        jobId: args.job_id,
                        outcome: args.outcome,
                        reporter: args.reporter,
                        note: args.note,
                    });
                    const summary = `Job: ${args.job_id} | Outcome: ${args.outcome} | ` +
                        `Logged: ${result.success ? "Yes" : "No"}` +
                        (result.message ? ` | ${result.message}` : "");
                    logger(`[Maiat] ${summary}`);
                    return new game_1.ExecutableGameFunctionResponse(game_1.ExecutableGameFunctionStatus.Done, JSON.stringify(result));
                }
                catch (e) {
                    logger(`[Maiat] Error: ${e.message}`);
                    return new game_1.ExecutableGameFunctionResponse(game_1.ExecutableGameFunctionStatus.Failed, `Failed to report outcome: ${e.message}`);
                }
            },
        });
    }
}
exports.MaiatTrustPlugin = MaiatTrustPlugin;
exports.default = MaiatTrustPlugin;
