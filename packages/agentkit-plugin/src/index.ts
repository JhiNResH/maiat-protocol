/**
 * @maiat/agentkit-plugin
 * 
 * Coinbase AgentKit plugin that adds trust scoring to every agent transaction.
 * 
 * Usage:
 * ```typescript
 * import { AgentKit } from "@coinbase/agentkit";
 * import { maiatTrustPlugin } from "@maiat/agentkit-plugin";
 * 
 * const agent = new AgentKit({ ... });
 * agent.use(maiatTrustPlugin({ minScore: 3.0 }));
 * 
 * // Now every transaction auto-checks trust before executing
 * // Addresses below minScore are blocked automatically
 * ```
 */

// ═══════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════

export interface MaiatPluginConfig {
  /** Minimum trust score (0-10) to allow transactions. Default: 3.0 */
  minScore?: number;
  /** Maiat API base URL. Default: https://maiat-protocol.vercel.app */
  apiUrl?: string;
  /** API key for higher rate limits */
  apiKey?: string;
  /** Chain to check. Default: base */
  chain?: string;
  /** If true, log warnings but don't block. Default: false */
  warnOnly?: boolean;
  /** Callback when a transaction is blocked */
  onBlocked?: (address: string, score: number, risk: string) => void;
  /** Callback for every trust check */
  onCheck?: (address: string, score: number, risk: string) => void;
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
  details: {
    txCount: number;
    balanceETH: number;
    isContract: boolean;
    walletAge: string | null;
    lastActive: string | null;
  };
  protocol?: {
    name: string;
    category: string;
    auditedBy?: string[];
  };
}

export class MaiatTrustError extends Error {
  constructor(
    public address: string,
    public score: number,
    public risk: string,
    public minScore: number,
  ) {
    super(
      `Maiat: Transaction blocked — address ${address} has trust score ${score}/10 (${risk} risk), minimum required: ${minScore}`
    );
    this.name = "MaiatTrustError";
  }
}

// ═══════════════════════════════════════════
//  API Client
// ═══════════════════════════════════════════

export class MaiatClient {
  private apiUrl: string;
  private apiKey: string;
  private chain: string;
  private cache: Map<string, { result: TrustScoreResult; expiresAt: number }> = new Map();

  constructor(config: Pick<MaiatPluginConfig, "apiUrl" | "apiKey" | "chain"> = {}) {
    this.apiUrl = config.apiUrl || "https://maiat-protocol.vercel.app";
    this.apiKey = config.apiKey || "";
    this.chain = config.chain || "base";
  }

  async checkTrust(address: string, chain?: string): Promise<TrustScoreResult> {
    const cacheKey = `${address}:${chain || this.chain}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "maiat-agentkit-plugin/0.1.0",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const url = `${this.apiUrl}/api/v1/score/${address}?chain=${chain || this.chain}`;
    const res = await fetch(url, { headers });

    if (!res.ok) {
      throw new Error(`Maiat API error (${res.status}): ${await res.text()}`);
    }

    const result: TrustScoreResult = await res.json();

    // Cache for 5 minutes
    this.cache.set(cacheKey, { result, expiresAt: Date.now() + 5 * 60 * 1000 });

    return result;
  }

  async batchCheck(addresses: string[], chain?: string): Promise<TrustScoreResult[]> {
    return Promise.all(addresses.map((addr) => this.checkTrust(addr, chain)));
  }

  isSafe(score: number, minScore: number = 3.0): boolean {
    return score >= minScore;
  }
}

// ═══════════════════════════════════════════
//  AgentKit Plugin Interface
// ═══════════════════════════════════════════

/**
 * AgentKit plugin action definitions.
 * These are the tools/actions that the agent can use.
 */
export function maiatTrustActions(config: MaiatPluginConfig = {}) {
  const client = new MaiatClient(config);
  const minScore = config.minScore ?? 3.0;

  return [
    {
      name: "maiat_check_trust",
      description: `Check the trust score of an on-chain address using Maiat. Returns a 0-10 score with risk assessment. Addresses scoring below ${minScore} are considered unsafe.`,
      schema: {
        type: "object" as const,
        properties: {
          address: { type: "string", description: "On-chain address to check (0x...)" },
          chain: { type: "string", description: "Chain: base, ethereum, bnb. Default: base" },
        },
        required: ["address"],
      },
      handler: async (params: { address: string; chain?: string }) => {
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
    {
      name: "maiat_gate_transaction",
      description: "Check if a transaction target is trustworthy before executing. Blocks transactions to untrusted addresses automatically.",
      schema: {
        type: "object" as const,
        properties: {
          to: { type: "string", description: "Target address of the transaction" },
          value: { type: "string", description: "Transaction value (optional context)" },
          chain: { type: "string", description: "Chain: base, ethereum, bnb" },
        },
        required: ["to"],
      },
      handler: async (params: { to: string; value?: string; chain?: string }) => {
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
export function maiatTrustPlugin(config: MaiatPluginConfig = {}) {
  return {
    name: "maiat-trust",
    version: "0.1.0",
    actions: maiatTrustActions(config),
    client: new MaiatClient(config),
  };
}

// Default export
export default maiatTrustPlugin;
