import { Maiat } from "@jhinresh/maiat-sdk";
// ═══════════════════════════════════════════
//  GAME SDK compatible types (peer dep compatible)
// ═══════════════════════════════════════════
export var ExecutableGameFunctionStatus;
(function (ExecutableGameFunctionStatus) {
    ExecutableGameFunctionStatus["Done"] = "done";
    ExecutableGameFunctionStatus["Failed"] = "failed";
})(ExecutableGameFunctionStatus || (ExecutableGameFunctionStatus = {}));
// ═══════════════════════════════════════════
//  GAME Function Definitions
// ═══════════════════════════════════════════
/**
 * Returns plain function configs compatible with GameFunction constructor.
 */
export function maiatFunctionConfigs(config = {}) {
    const sdk = new Maiat({
        baseUrl: config.apiUrl,
        apiKey: config.apiKey,
        framework: "virtuals",
        clientId: "virtuals-game-plugin"
    });
    const minScore = config.minScore ?? 60;
    const warnOnly = config.warnOnly ?? false;
    const checkTrustConfig = {
        name: "maiat_check_trust",
        description: `Check the Maiat trust score (0-100) for an on-chain address. Scores below ${minScore} indicate risky addresses. Use before sending funds or interacting with a contract.`,
        args: [
            { name: "address", description: "On-chain address to check (0x...)" },
        ],
        executable: async (args, logger) => {
            try {
                logger(`[Maiat] Checking trust for ${args.address}...`);
                const result = await sdk.agentTrust(args.address);
                const safe = result.trustScore >= minScore;
                const summary = [
                    `Address: ${result.address}`,
                    `Trust Score: ${result.trustScore}/100`,
                    `Verdict: ${result.verdict}`,
                    `Source: ${result.dataSource}`,
                    `Total Jobs: ${result.breakdown.totalJobs}`,
                    safe
                        ? `✅ Safe to interact (score ≥ ${minScore})`
                        : `⚠️ ${warnOnly ? "Warning" : "Blocked"}: trust score ${result.trustScore} < ${minScore}`,
                ]
                    .filter(Boolean)
                    .join("\n");
                logger(`[Maiat] ${safe ? "SAFE" : "RISKY"} — ${result.trustScore}/100`);
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
                const result = await sdk.agentTrust(args.to);
                const safe = result.trustScore >= minScore;
                if (!safe && !warnOnly) {
                    logger(`[Maiat] BLOCKED — ${args.to} scored ${result.trustScore}/100`);
                    return {
                        status: ExecutableGameFunctionStatus.Failed,
                        feedback: `Transaction BLOCKED: ${args.to} has trust score ${result.trustScore}/100 (${result.verdict} verdict). Minimum required: ${minScore}.`,
                    };
                }
                logger(`[Maiat] ${safe ? "APPROVED" : "WARNING"} — ${result.trustScore}/100`);
                return {
                    status: ExecutableGameFunctionStatus.Done,
                    feedback: `Transaction ${safe ? "APPROVED" : "WARNING (proceeding with caution)"}: ${args.to} scored ${result.trustScore}/100 (${result.verdict} verdict).`,
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
    const checkTokenConfig = {
        name: "maiat_check_token",
        description: "Check if a token is safe using Maiat's token safety and forensics analysis. Detects honeypots, rug pulls, and liquidity risks.",
        args: [
            { name: "address", description: "Token contract address to check (0x...)" },
            { name: "chain", description: "Chain to query (default: base)", optional: true },
        ],
        executable: async (args, logger) => {
            try {
                logger(`[Maiat] Checking token safety for ${args.address}...`);
                const [tokenResult, forensicsResult] = await Promise.all([
                    sdk.tokenCheck(args.address),
                    sdk.forensics(args.address, args.chain).catch(() => null),
                ]);
                const safe = tokenResult.verdict === "proceed";
                const summary = [
                    `Token: ${tokenResult.address}`,
                    `Trust Score: ${tokenResult.trustScore}/100`,
                    `Verdict: ${tokenResult.verdict}`,
                    `Type: ${tokenResult.tokenType}`,
                    `Risk: ${tokenResult.riskSummary}`,
                    tokenResult.riskFlags.length > 0 ? `Flags: ${tokenResult.riskFlags.join(", ")}` : "Flags: None",
                    forensicsResult ? `Forensics Verdict: ${forensicsResult.verdict}` : null,
                    forensicsResult && forensicsResult.riskFlags.length > 0
                        ? `Forensics Flags: ${forensicsResult.riskFlags.join(", ")}`
                        : null,
                    safe ? "✅ Token appears safe" : "⚠️ Token has risk flags — exercise caution",
                ]
                    .filter(Boolean)
                    .join("\n");
                logger(`[Maiat] Token ${safe ? "SAFE" : "RISKY"} — ${tokenResult.trustScore}/100`);
                return {
                    status: ExecutableGameFunctionStatus.Done,
                    feedback: summary,
                };
            }
            catch (err) {
                return {
                    status: ExecutableGameFunctionStatus.Failed,
                    feedback: `Maiat token check failed: ${err instanceof Error ? err.message : String(err)}`,
                };
            }
        },
    };
    const trustSwapConfig = {
        name: "maiat_trust_swap",
        description: "Get a trust-verified swap quote. Checks both tokens for safety before returning calldata. Use this instead of raw DEX quotes.",
        args: [
            { name: "swapper", description: "Wallet address executing the swap (0x...)" },
            { name: "tokenIn", description: "Token being sold (0x...)" },
            { name: "tokenOut", description: "Token being bought (0x...)" },
            { name: "amount", description: "Amount of tokenIn in wei" },
            { name: "slippage", description: "Slippage tolerance (e.g. 0.5 for 0.5%)", optional: true },
        ],
        executable: async (args, logger) => {
            try {
                logger(`[Maiat] Getting trust-verified swap: ${args.tokenIn} → ${args.tokenOut}...`);
                const result = await sdk.trustSwap({
                    swapper: args.swapper,
                    tokenIn: args.tokenIn,
                    tokenOut: args.tokenOut,
                    amount: args.amount,
                    slippage: args.slippage ? parseFloat(args.slippage) : undefined,
                });
                const trustIn = result.trust.tokenIn;
                const trustOut = result.trust.tokenOut;
                const summary = [
                    `Swap: ${args.tokenIn} → ${args.tokenOut}`,
                    trustIn ? `Token In Trust: ${trustIn.score}/100 (${trustIn.risk})` : "Token In Trust: N/A",
                    trustOut ? `Token Out Trust: ${trustOut.score}/100 (${trustOut.risk})` : "Token Out Trust: N/A",
                    `Calldata: ${result.calldata ? "Ready" : "Not available"}`,
                    `Timestamp: ${result.timestamp}`,
                ].join("\n");
                logger(`[Maiat] Swap quote ready`);
                return {
                    status: ExecutableGameFunctionStatus.Done,
                    feedback: summary,
                };
            }
            catch (err) {
                return {
                    status: ExecutableGameFunctionStatus.Failed,
                    feedback: `Maiat trust swap failed: ${err instanceof Error ? err.message : String(err)}`,
                };
            }
        },
    };
    const reportOutcomeConfig = {
        name: "maiat_report_outcome",
        description: "Report the outcome of a job back to the Maiat trust oracle. Call this after completing, failing, or observing an expired job.",
        args: [
            { name: "jobId", description: "The job ID to report outcome for" },
            { name: "outcome", description: "Outcome: success, failure, partial, or expired" },
            { name: "reporter", description: "Address of the reporter (optional)", optional: true },
            { name: "note", description: "Free-form note about the outcome (optional)", optional: true },
        ],
        executable: async (args, logger) => {
            try {
                logger(`[Maiat] Reporting outcome for job ${args.jobId}: ${args.outcome}...`);
                const result = await sdk.reportOutcome({
                    jobId: args.jobId,
                    outcome: args.outcome,
                    reporter: args.reporter,
                    note: args.note,
                });
                const summary = [
                    `Job: ${args.jobId}`,
                    `Outcome: ${args.outcome}`,
                    `Logged: ${result.success ? "Yes" : "No"}`,
                    result.id ? `ID: ${result.id}` : null,
                    result.message ? `Message: ${result.message}` : null,
                ]
                    .filter(Boolean)
                    .join("\n");
                logger(`[Maiat] Outcome reported successfully`);
                return {
                    status: ExecutableGameFunctionStatus.Done,
                    feedback: summary,
                };
            }
            catch (err) {
                return {
                    status: ExecutableGameFunctionStatus.Failed,
                    feedback: `Maiat outcome report failed: ${err instanceof Error ? err.message : String(err)}`,
                };
            }
        },
    };
    return {
        checkTrustConfig,
        gateTxConfig,
        checkTokenConfig,
        trustSwapConfig,
        reportOutcomeConfig,
    };
}
/**
 * Create a GAME-compatible worker with Maiat trust functions.
 */
export async function createMaiatWorker(config = {}) {
    let GameFunction;
    let GameWorker;
    try {
        // @ts-ignore
        const sdkImport = await import("@virtuals-protocol/game");
        GameFunction = sdkImport["GameFunction"];
        GameWorker = sdkImport["GameWorker"];
    }
    catch {
        throw new Error("@virtuals-protocol/game is required. Install it: npm install @virtuals-protocol/game");
    }
    const configs = maiatFunctionConfigs(config);
    const functions = [
        new GameFunction(configs.checkTrustConfig),
        new GameFunction(configs.gateTxConfig),
        new GameFunction(configs.checkTokenConfig),
        new GameFunction(configs.trustSwapConfig),
        new GameFunction(configs.reportOutcomeConfig),
    ];
    return new GameWorker({
        id: "maiat-trust-worker",
        name: "Maiat Trust Scorer",
        description: "Checks on-chain trust scores, token safety, swap verification, and outcome reporting using the Maiat Protocol. Use before any financial transaction.",
        functions,
    });
}
export default createMaiatWorker;
