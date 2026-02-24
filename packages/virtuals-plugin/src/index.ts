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

// We re-export a factory so the caller can pass in their GameFunction constructor
// This avoids bundling @virtuals-protocol/game directly and keeps us tree-shakeable

// ═══════════════════════════════════════════
//  Config & Types
// ═══════════════════════════════════════════

export interface MaiatVirtualsConfig {
  /** Minimum trust score (0-10). Default: 3.0 */
  minScore?: number;
  /** Maiat API base URL. Default: https://maiat-protocol.vercel.app */
  apiUrl?: string;
  /** Optional API key for higher rate limits */
  apiKey?: string;
  /** Chain. Default: base */
  chain?: string;
  /** Warn but don't block if score is low. Default: false */
  warnOnly?: boolean;
}

export interface TrustScoreResult {
  address: string;
  score: number;
  risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  type: string;
  flags: string[];
  breakdown: {
    onChainHistory: number;
    contractAnalysis: number;
    blacklistCheck: number;
    activityPattern: number;
  };
}

// ═══════════════════════════════════════════
//  Maiat API Client
// ═══════════════════════════════════════════

export class MaiatClient {
  private apiUrl: string;
  private apiKey: string;
  private chain: string;
  private cache = new Map<string, { data: TrustScoreResult; exp: number }>();

  constructor(config: MaiatVirtualsConfig = {}) {
    this.apiUrl = config.apiUrl ?? "https://maiat-protocol.vercel.app";
    this.apiKey = config.apiKey ?? "";
    this.chain = config.chain ?? "base";
  }

  async checkTrust(address: string): Promise<TrustScoreResult> {
    const key = `${address}:${this.chain}`;
    const hit = this.cache.get(key);
    if (hit && hit.exp > Date.now()) return hit.data;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "maiat-virtuals-plugin/0.1.0",
    };
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;

    const res = await fetch(
      `${this.apiUrl}/api/v1/score/${address}?chain=${this.chain}`,
      { headers }
    );
    if (!res.ok) throw new Error(`Maiat API ${res.status}: ${await res.text()}`);

    const data: TrustScoreResult = await res.json();
    this.cache.set(key, { data, exp: Date.now() + 5 * 60_000 });
    return data;
  }
}

// ═══════════════════════════════════════════
//  GAME Function Definitions
// ═══════════════════════════════════════════

/**
 * Returns plain function configs compatible with GameFunction constructor.
 * 
 * @example
 * ```typescript
 * import { GameFunction } from "@virtuals-protocol/game";
 * const { checkTrustConfig, gateTxConfig } = maiatFunctionConfigs({ minScore: 3.0 });
 * const checkTrust = new GameFunction(checkTrustConfig);
 * const gateTx = new GameFunction(gateTxConfig);
 * ```
 */
export function maiatFunctionConfigs(config: MaiatVirtualsConfig = {}) {
  const client = new MaiatClient(config);
  const minScore = config.minScore ?? 3.0;
  const warnOnly = config.warnOnly ?? false;

  const checkTrustConfig: GameFunctionConfig<{ address: string; chain?: string }> = {
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
      } catch (err) {
        return {
          status: ExecutableGameFunctionStatus.Failed,
          feedback: `Maiat gate check failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
  };

  return { checkTrustConfig, gateTxConfig };
}

// ═══════════════════════════════════════════
//  createMaiatWorker — Plug-and-play for GAME SDK
// ═══════════════════════════════════════════

/**
 * Create a GAME-compatible worker with Maiat trust functions.
 * Requires @virtuals-protocol/game to be installed.
 *
 * @example
 * ```typescript
 * import { createMaiatWorker } from "@maiat/virtuals-plugin";
 *
 * const worker = await createMaiatWorker({ minScore: 3.0 });
 * // Pass worker to GameAgent
 * ```
 */
export async function createMaiatWorker(config: MaiatVirtualsConfig = {}) {
  // Dynamic import to keep @virtuals-protocol/game as a peer dep
  let GameFunction: new (cfg: GameFunctionConfig<Record<string, string>>) => unknown;
  let GameWorker: new (cfg: { id: string; name: string; description: string; functions: unknown[] }) => unknown;

  try {
    const sdk = await import("@virtuals-protocol/game");
    GameFunction = (sdk as Record<string, unknown>)["GameFunction"] as typeof GameFunction;
    GameWorker = (sdk as Record<string, unknown>)["GameWorker"] as typeof GameWorker;
  } catch {
    throw new Error(
      "@virtuals-protocol/game is required. Install it: npm install @virtuals-protocol/game"
    );
  }

  const { checkTrustConfig, gateTxConfig } = maiatFunctionConfigs(config);

  const functions = [
    new GameFunction(checkTrustConfig as GameFunctionConfig<Record<string, string>>),
    new GameFunction(gateTxConfig as GameFunctionConfig<Record<string, string>>),
  ];

  return new GameWorker({
    id: "maiat-trust-worker",
    name: "Maiat Trust Scorer",
    description:
      "Checks on-chain trust scores for addresses and tokens using the Maiat Protocol. Use this worker before any financial transaction or smart contract interaction to verify the counterparty is trusted.",
    functions,
  });
}

export default createMaiatWorker;
