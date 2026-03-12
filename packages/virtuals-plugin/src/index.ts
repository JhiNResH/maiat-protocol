import { Maiat } from "@maiat/sdk";

// ═══════════════════════════════════════════
//  GAME SDK compatible types (peer dep compatible)
// ═══════════════════════════════════════════

export enum ExecutableGameFunctionStatus {
  Done = "done",
  Failed = "failed",
}

export interface ExecutableGameFunctionResponse {
  status: ExecutableGameFunctionStatus;
  feedback: string;
}

type GameFunctionArg = {
  name: string;
  description: string;
  type?: string;
  optional?: boolean;
};

type ExecutableFn<T extends Record<string, string>> = (
  args: T,
  logger: (msg: string) => void
) => Promise<ExecutableGameFunctionResponse>;

interface GameFunctionConfig<T extends Record<string, string>> {
  name: string;
  description: string;
  args: GameFunctionArg[];
  executable: ExecutableFn<T>;
}

// ═══════════════════════════════════════════
//  Config & Types
// ═══════════════════════════════════════════

export interface MaiatVirtualsConfig {
  /** Minimum trust score (0-100). Default: 60 */
  minScore?: number;
  /** Maiat API base URL. Default: https://app.maiat.io */
  apiUrl?: string;
  /** Optional API key for higher rate limits */
  apiKey?: string;
  /** Warn but don't block if score is low. Default: false */
  warnOnly?: boolean;
}

// ═══════════════════════════════════════════
//  GAME Function Definitions
// ═══════════════════════════════════════════

/**
 * Returns plain function configs compatible with GameFunction constructor.
 */
export function maiatFunctionConfigs(config: MaiatVirtualsConfig = {}) {
  const sdk = new Maiat({
    baseUrl: config.apiUrl,
    apiKey: config.apiKey,
    framework: "virtuals",
    clientId: "virtuals-game-plugin"
  });

  const minScore = config.minScore ?? 60;
  const warnOnly = config.warnOnly ?? false;

  const checkTrustConfig: GameFunctionConfig<{ address: string }> = {
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
      } catch (err) {
        return {
          status: ExecutableGameFunctionStatus.Failed,
          feedback: `Maiat trust check failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
  };

  const gateTxConfig: GameFunctionConfig<{ to: string; action?: string }> = {
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
      } catch (err) {
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
export async function createMaiatWorker(config: MaiatVirtualsConfig = {}) {
  let GameFunction: new (cfg: GameFunctionConfig<Record<string, string>>) => unknown;
  let GameWorker: new (cfg: { id: string; name: string; description: string; functions: unknown[] }) => unknown;

  try {
    // @ts-ignore
    const sdkImport = await import("@virtuals-protocol/game");
    GameFunction = (sdkImport as Record<string, unknown>)["GameFunction"] as typeof GameFunction;
    GameWorker = (sdkImport as Record<string, unknown>)["GameWorker"] as typeof GameWorker;
  } catch {
    throw new Error(
      "@virtuals-protocol/game is required. Install it: npm install @virtuals-protocol/game"
    );
  }

  const configs = maiatFunctionConfigs(config);

  const functions = [
    new GameFunction(configs.checkTrustConfig as GameFunctionConfig<Record<string, string>>),
    new GameFunction(configs.gateTxConfig as GameFunctionConfig<Record<string, string>>),
  ];

  return new GameWorker({
    id: "maiat-trust-worker",
    name: "Maiat Trust Scorer",
    description:
      "Checks on-chain trust scores using the Maiat Protocol. Use before any financial transaction.",
    functions,
  });
}

export default createMaiatWorker;
