import { Maiat } from "@jhinresh/maiat-sdk";

/**
 * @maiat/agentkit-plugin
 * 
 * Coinbase AgentKit plugin that adds trust scoring to every agent transaction.
 * 
 * V0.2.0 — Cold-start update:
 * - submitReview(): Submit trust reviews with Scarab staking
 * - getInteractions(): Discover contracts a wallet has interacted with
 * - getPassport(): Get a wallet's reputation passport
 * - getDefiInfo(): Query DeFi protocol trust data by slug or address
 * - getAgentInfo(): Query AI agent trust data by slug or address
 * 
 * Usage:
 * ```typescript
 * import { AgentKit } from "@coinbase/agentkit";
 * import { maiatTrustPlugin } from "@maiat/agentkit-plugin";
 * 
 * const agent = new AgentKit({ ... });
 * agent.use(maiatTrustPlugin({ minScore: 30 }));
 * ```
 */

// ═══════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════

export interface MaiatPluginConfig {
  /** Minimum trust score (0-100) to allow transactions. Default: 30 */
  minScore?: number;
  /** Maiat API base URL. Default: https://app.maiat.io */
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

export interface ReviewSubmission {
  address: string;
  rating: number;
  comment?: string;
  tags?: string[];
  reviewer: string;
  signature?: string;
}

export interface ReviewResult {
  success: boolean;
  review: {
    id: string;
    address: string;
    rating: number;
    comment: string;
    reviewer: string;
    timestamp: string;
  };
  meta: {
    interactionVerified: boolean;
    qualityScore: number | null;
    scarabDeducted: boolean;
    scarabReward: number;
  };
}

export interface InteractionResult {
  wallet: string;
  interacted: Array<{
    address: string;
    name: string;
    category: string;
    slug: string | null;
    txCount: number;
    trustScore: number | null;
    canReview: boolean;
    hasReviewed: boolean;
  }>;
  interactedCount: number;
  notInteracted: Array<{
    address: string;
    name: string;
    category: string;
    canReview: boolean;
  }>;
}

export interface PassportResult {
  wallet: string;
  passport: {
    trustLevel: "new" | "trusted" | "verified" | "guardian";
    reputationScore: number;
    totalReviews: number;
    feeTier: { rate: number; discount: string; label: string };
  };
  scarab: { balance: number };
  reviews: { count: number; addressesReviewed: string[] };
  progression: {
    current: string;
    nextLevel: string | null;
    pointsToNext: number | null;
    benefits: string[];
  };
}

export interface EntityInfoResult {
  entity: {
    address: string;
    slug: string;
    name: string;
    type: string;
    category: string;
    auditedBy?: string[];
  };
  trust: { score: number; risk?: string } | null;
  reviews: { total: number; avgRating: number };
  canonical: { url: string };
}

export class MaiatTrustError extends Error {
  constructor(
    public address: string,
    public score: number,
    public risk: string,
    public minScore: number,
  ) {
    super(
      `Maiat: Transaction blocked — address ${address} has trust score ${score}/100 (${risk} risk), minimum required: ${minScore}`
    );
    this.name = "MaiatTrustError";
  }
}

// ═══════════════════════════════════════════
//  API Client
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
//  API Client (Internal wrapper for SDK)
// ═══════════════════════════════════════════

export class MaiatClient {
  sdk: Maiat;
  private cache: Map<string, { result: TrustScoreResult; expiresAt: number }> = new Map();

  constructor(config: Pick<MaiatPluginConfig, "apiUrl" | "apiKey" | "chain"> = {}) {
    this.sdk = new Maiat({
      baseUrl: config.apiUrl,
      apiKey: config.apiKey,
      framework: "agentkit",
      clientId: "agentkit-plugin-standard"
    });
  }

  async checkTrust(address: string, _chain?: string): Promise<TrustScoreResult> {
    const cacheKey = `${address}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }

    const res = await this.sdk.agentTrust(address);
    
    // Map SDK result to plugin's internal TrustScoreResult type
    const result: TrustScoreResult = {
      address: res.address,
      score: res.trustScore,
      risk: res.verdict === 'avoid' ? 'CRITICAL' : (res.verdict === 'caution' ? 'MEDIUM' : 'LOW'),
      type: res.dataSource,
      flags: [],
      breakdown: {
        onChainHistory: res.breakdown.totalJobs,
        contractAnalysis: res.breakdown.completionRate,
        blacklistCheck: 0,
        activityPattern: 0
      },
      details: {
        txCount: res.breakdown.totalJobs,
        balanceETH: 0,
        isContract: false,
        walletAge: res.breakdown.ageWeeks ? `${res.breakdown.ageWeeks} weeks` : null,
        lastActive: res.lastUpdated
      }
    };

    this.cache.set(cacheKey, { result, expiresAt: Date.now() + 5 * 60 * 1000 });
    return result;
  }

  isSafe(score: number, minScore: number = 30): boolean {
    return score >= minScore;
  }

  async submitReview(review: ReviewSubmission): Promise<ReviewResult> {
    const res = await (this.sdk as any).request("/api/v1/review", {
      method: "POST",
      body: JSON.stringify(review),
    });
    return res;
  }

  async getInteractions(walletAddress: string): Promise<InteractionResult> {
    return (this.sdk as any).request(`/api/v1/wallet/${walletAddress}/interactions`);
  }

  async getPassport(walletAddress: string): Promise<PassportResult> {
    const res = await this.sdk.scarab(walletAddress);
    // Note: This is a simplified mapping for the plugin's legacy interface
    return {
      wallet: walletAddress,
      passport: {
        trustLevel: "new",
        reputationScore: 0,
        totalReviews: 0,
        feeTier: { rate: 1, discount: "0%", label: "Standard" }
      },
      scarab: { balance: res.balanceFormatted },
      reviews: { count: 0, addressesReviewed: [] },
      progression: {
        current: "new",
        nextLevel: null,
        pointsToNext: null,
        benefits: []
      }
    };
  }

  async getDefiInfo(slugOrAddress: string): Promise<EntityInfoResult> {
    return (this.sdk as any).request(`/api/v1/token/${slugOrAddress}`);
  }

  async getAgentInfo(slugOrAddress: string): Promise<EntityInfoResult> {
    return (this.sdk as any).request(`/api/v1/agent/${slugOrAddress}`);
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
  const minScore = config.minScore ?? 30;

  return [
    // --- Existing: Trust Check ---
    {
      name: "maiat_check_trust",
      description: `Check the trust score of an on-chain address using Maiat. Returns a 0-100 score with risk assessment. Addresses scoring below ${minScore} are considered unsafe.`,
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
            ? `✅ Address is trusted (${result.score}/100). Safe to proceed.`
            : `⚠️ Address has low trust (${result.score}/100, ${result.risk} risk). ${config.warnOnly ? "Proceeding with caution." : "Transaction blocked."}`,
        };
      },
    },
    // --- Existing: Transaction Gate ---
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
    // --- NEW: Submit Review ---
    {
      name: "maiat_submit_review",
      description: "Submit a trust review for a contract address. Costs 2 Scarab points. Quality reviews earn 3-10 Scarab rewards.",
      schema: {
        type: "object" as const,
        properties: {
          address: { type: "string", description: "Contract address to review (0x...)" },
          rating: { type: "number", description: "Rating from 1-10" },
          comment: { type: "string", description: "Review text explaining your rating" },
          reviewer: { type: "string", description: "Your wallet address (0x...)" },
          tags: { type: "array", description: "Tags: safe, risky, audited, scam, defi, nft" },
        },
        required: ["address", "rating", "reviewer"],
      },
      handler: async (params: ReviewSubmission) => {
        const result = await client.submitReview(params);
        return {
          success: result.success,
          reviewId: result.review.id,
          scarabReward: result.meta.scarabReward,
          qualityScore: result.meta.qualityScore,
          interactionVerified: result.meta.interactionVerified,
          message: `✅ Review submitted for ${params.address}. Earned ${result.meta.scarabReward} Scarab.`,
        };
      },
    },
    // --- NEW: Wallet Interactions ---
    {
      name: "maiat_get_interactions",
      description: "Discover which contracts a wallet has interacted with on Base. Shows reviewable contracts and their trust scores.",
      schema: {
        type: "object" as const,
        properties: {
          wallet: { type: "string", description: "Wallet address to check (0x...)" },
        },
        required: ["wallet"],
      },
      handler: async (params: { wallet: string }) => {
        const result = await client.getInteractions(params.wallet);
        return {
          wallet: result.wallet,
          interactedCount: result.interactedCount,
          contracts: result.interacted.map(c => ({
            name: c.name,
            address: c.address,
            category: c.category,
            txCount: c.txCount,
            trustScore: c.trustScore,
            canReview: c.canReview,
            hasReviewed: c.hasReviewed,
          })),
          message: `Found ${result.interactedCount} contracts you've interacted with.`,
        };
      },
    },
    // --- NEW: Reputation Passport ---
    {
      name: "maiat_get_passport",
      description: "Get a wallet's reputation passport showing trust level, Scarab balance, review history, and fee tier progression.",
      schema: {
        type: "object" as const,
        properties: {
          wallet: { type: "string", description: "Wallet address (0x...)" },
        },
        required: ["wallet"],
      },
      handler: async (params: { wallet: string }) => {
        const result = await client.getPassport(params.wallet);
        return {
          trustLevel: result.passport.trustLevel,
          reputationScore: result.passport.reputationScore,
          totalReviews: result.passport.totalReviews,
          scarabBalance: result.scarab.balance,
          feeTier: result.passport.feeTier,
          nextLevel: result.progression.nextLevel,
          pointsToNext: result.progression.pointsToNext,
          benefits: result.progression.benefits,
          message: `🛡️ ${result.passport.trustLevel.toUpperCase()} — ${result.passport.reputationScore} reputation, ${result.scarab.balance} Scarab`,
        };
      },
    },
    // --- NEW: DeFi Info ---
    {
      name: "maiat_defi_info",
      description: "Get trust data for a DeFi protocol by name or address. Examples: 'usdc', 'aerodrome', 'aave', '0x833589...'",
      schema: {
        type: "object" as const,
        properties: {
          query: { type: "string", description: "Protocol slug (e.g. 'usdc') or address (0x...)" },
        },
        required: ["query"],
      },
      handler: async (params: { query: string }) => {
        const result = await client.getDefiInfo(params.query);
        return {
          name: result.entity.name,
          address: result.entity.address,
          category: result.entity.category,
          auditedBy: result.entity.auditedBy || [],
          trustScore: result.trust?.score ?? null,
          reviews: result.reviews.total,
          avgRating: result.reviews.avgRating,
          url: result.canonical.url,
        };
      },
    },
    // --- NEW: Agent Info ---
    {
      name: "maiat_agent_info",
      description: "Get trust data for an AI agent by name or address. Examples: 'aixbt', 'virtuals', 'luna', '0x4f9fd6...'",
      schema: {
        type: "object" as const,
        properties: {
          query: { type: "string", description: "Agent slug (e.g. 'aixbt') or address (0x...)" },
        },
        required: ["query"],
      },
      handler: async (params: { query: string }) => {
        const result = await client.getAgentInfo(params.query);
        return {
          name: result.entity.name,
          address: result.entity.address,
          category: result.entity.category,
          trustScore: result.trust?.score ?? null,
          reviews: result.reviews.total,
          avgRating: result.reviews.avgRating,
          url: result.canonical.url,
        };
      },
    },
    // --- NEW: Trust Swap ---
    {
      name: "maiat_trust_swap",
      description: "Get a trust-verified swap quote with calldata. Checks both tokens for safety before returning a Uniswap quote. Use this instead of raw DEX quotes.",
      schema: {
        type: "object" as const,
        properties: {
          swapper: { type: "string", description: "Wallet address executing the swap (0x...)" },
          tokenIn: { type: "string", description: "Token being sold (0x...)" },
          tokenOut: { type: "string", description: "Token being bought (0x...)" },
          amount: { type: "string", description: "Amount of tokenIn in wei" },
          slippage: { type: "number", description: "Slippage tolerance (e.g. 0.5 for 0.5%)" },
        },
        required: ["swapper", "tokenIn", "tokenOut", "amount"],
      },
      handler: async (params: { swapper: string; tokenIn: string; tokenOut: string; amount: string; slippage?: number }) => {
        const result = await client.sdk.trustSwap({
          swapper: params.swapper,
          tokenIn: params.tokenIn,
          tokenOut: params.tokenOut,
          amount: params.amount,
          slippage: params.slippage,
        });
        return result;
      },
    },
    // --- NEW: Deep Analysis ---
    {
      name: "maiat_deep_analysis",
      description: "Get deep trust analysis for an agent address. Returns detailed breakdown with percentile rankings, risk signals, and behavioral patterns.",
      schema: {
        type: "object" as const,
        properties: {
          address: { type: "string", description: "Agent wallet address (0x...)" },
        },
        required: ["address"],
      },
      handler: async (params: { address: string }) => {
        const result = await client.sdk.deep(params.address);
        return result;
      },
    },
    // --- NEW: Report Outcome ---
    {
      name: "maiat_report_outcome",
      description: "Report the outcome of a job back to the Maiat trust oracle. Call after completing, failing, or observing an expired job. Earns Scarab rewards.",
      schema: {
        type: "object" as const,
        properties: {
          jobId: { type: "string", description: "The job ID to report outcome for" },
          outcome: { type: "string", description: "Outcome: success, failure, partial, or expired" },
          reporter: { type: "string", description: "Address of the reporter (optional)" },
          note: { type: "string", description: "Free-form note about the outcome (optional)" },
        },
        required: ["jobId", "outcome"],
      },
      handler: async (params: { jobId: string; outcome: string; reporter?: string; note?: string }) => {
        const result = await client.sdk.reportOutcome({
          jobId: params.jobId,
          outcome: params.outcome as "success" | "failure" | "partial" | "expired",
          reporter: params.reporter,
          note: params.note,
        });
        return result;
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
 *   onBlocked: (addr, score) => console.log(`Blocked ${addr}: ${score}/100`)
 * });
 * 
 * // Use with AgentKit
 * agent.use(plugin);
 * ```
 */
export function maiatTrustPlugin(config: MaiatPluginConfig = {}) {
  return {
    name: "maiat-trust",
    version: "0.8.0",
    actions: maiatTrustActions(config),
    client: new MaiatClient(config),
  };
}

// Default export
export default maiatTrustPlugin;
