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
  /** Maiat API base URL. Default: https://app.maiat.io */
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
    this.apiUrl = config.apiUrl ?? "https://app.maiat.io";
    this.apiKey = config.apiKey ?? "";
    this.chain = config.chain ?? "base";
  }

  private get headers(): Record<string, string> {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "maiat-virtuals-plugin/0.2.0",
    };
    if (this.apiKey) h["Authorization"] = `Bearer ${this.apiKey}`;
    return h;
  }

  async checkTrust(address: string): Promise<TrustScoreResult> {
    const key = `${address}:${this.chain}`;
    const hit = this.cache.get(key);
    if (hit && hit.exp > Date.now()) return hit.data;

    const res = await fetch(
      `${this.apiUrl}/api/v1/agent/${address}`,
      { headers: this.headers, signal: AbortSignal.timeout(15_000) }
    );
    if (!res.ok) throw new Error(`Maiat API ${res.status}: ${await res.text()}`);

    const data: TrustScoreResult = await res.json();
    this.cache.set(key, { data, exp: Date.now() + 5 * 60_000 });
    return data;
  }

  async submitReview(review: { address: string; rating: number; comment?: string; reviewer: string }) {
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

  async getInteractions(wallet: string) {
    const res = await fetch(`${this.apiUrl}/api/v1/wallet/${wallet}/interactions`, { headers: this.headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async getPassport(wallet: string) {
    const res = await fetch(`${this.apiUrl}/api/v1/wallet/${wallet}/passport`, { headers: this.headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async getDefiInfo(query: string) {
    // Route to /api/v1/token/{address} for addresses, /api/v1/explore?search={name} for slugs
    const isAddress = /^0x[0-9a-fA-F]{40}$/.test(query);
    const url = isAddress
      ? `${this.apiUrl}/api/v1/token/${query}`
      : `${this.apiUrl}/api/v1/explore?search=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: this.headers, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async getAgentInfo(query: string) {
    const res = await fetch(`${this.apiUrl}/api/v1/agent/${query}`, { headers: this.headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
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

  // --- NEW: Submit Review ---
  const submitReviewConfig: GameFunctionConfig<{ address: string; rating: string; comment?: string; reviewer: string }> = {
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
      } catch (err) {
        return {
          status: ExecutableGameFunctionStatus.Failed,
          feedback: `Review failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
  };

  // --- NEW: Get Interactions ---
  const getInteractionsConfig: GameFunctionConfig<{ wallet: string }> = {
    name: "maiat_get_interactions",
    description: "Discover which contracts a wallet has interacted with on Base.",
    args: [
      { name: "wallet", description: "Wallet address (0x...)" },
    ],
    executable: async (args, logger) => {
      try {
        logger(`[Maiat] Discovering interactions for ${args.wallet}...`);
        const data = await client.getInteractions(args.wallet);
        const list = data.interacted?.map((c: { name: string; txCount: number }) => `${c.name} (${c.txCount} txs)`).join(", ") || "None";
        return {
          status: ExecutableGameFunctionStatus.Done,
          feedback: `Found ${data.interactedCount} contracts: ${list}`,
        };
      } catch (err) {
        return {
          status: ExecutableGameFunctionStatus.Failed,
          feedback: `Error: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
  };

  // --- NEW: Get Passport ---
  const getPassportConfig: GameFunctionConfig<{ wallet: string }> = {
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
      } catch (err) {
        return {
          status: ExecutableGameFunctionStatus.Failed,
          feedback: `Error: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
  };

  // --- NEW: DeFi Info ---
  const defiInfoConfig: GameFunctionConfig<{ query: string }> = {
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
      } catch (err) {
        return {
          status: ExecutableGameFunctionStatus.Failed,
          feedback: `Error: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
  };

  // --- NEW: Agent Info ---
  const agentInfoConfig: GameFunctionConfig<{ query: string }> = {
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
      } catch (err) {
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
export async function createMaiatWorker(config: MaiatVirtualsConfig = {}) {
  // Dynamic import to keep @virtuals-protocol/game as a peer dep
  let GameFunction: new (cfg: GameFunctionConfig<Record<string, string>>) => unknown;
  let GameWorker: new (cfg: { id: string; name: string; description: string; functions: unknown[] }) => unknown;

  try {
    // @ts-ignore
    const sdk = await import("@virtuals-protocol/game");
    GameFunction = (sdk as Record<string, unknown>)["GameFunction"] as typeof GameFunction;
    GameWorker = (sdk as Record<string, unknown>)["GameWorker"] as typeof GameWorker;
  } catch {
    throw new Error(
      "@virtuals-protocol/game is required. Install it: npm install @virtuals-protocol/game"
    );
  }

  const configs = maiatFunctionConfigs(config);

  const functions = [
    new GameFunction(configs.checkTrustConfig as GameFunctionConfig<Record<string, string>>),
    new GameFunction(configs.gateTxConfig as GameFunctionConfig<Record<string, string>>),
    new GameFunction(configs.submitReviewConfig as GameFunctionConfig<Record<string, string>>),
    new GameFunction(configs.getInteractionsConfig as GameFunctionConfig<Record<string, string>>),
    new GameFunction(configs.getPassportConfig as GameFunctionConfig<Record<string, string>>),
    new GameFunction(configs.defiInfoConfig as GameFunctionConfig<Record<string, string>>),
    new GameFunction(configs.agentInfoConfig as GameFunctionConfig<Record<string, string>>),
  ];

  return new GameWorker({
    id: "maiat-trust-worker",
    name: "Maiat Trust Scorer",
    description:
      "Checks on-chain trust scores, submits reviews, discovers wallet interactions, and queries DeFi/Agent info using the Maiat Protocol. Use before any financial transaction.",
    functions,
  });
}

export default createMaiatWorker;
