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
    return {
        checkTrustConfig,
        gateTxConfig,
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
    ];
    return new GameWorker({
        id: "maiat-trust-worker",
        name: "Maiat Trust Scorer",
        description: "Checks on-chain trust scores using the Maiat Protocol. Use before any financial transaction.",
        functions,
    });
}
export default createMaiatWorker;
