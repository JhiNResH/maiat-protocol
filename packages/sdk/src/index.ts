/**
 * Maiat SDK — Trust scores, token safety & swap verification for AI agents
 *
 * Usage:
 *   import { Maiat } from "maiat-sdk";
 *   const maiat = new Maiat({ clientId: "my-agent" });
 *   const score = await maiat.agentTrust("0x...");
 *   const token = await maiat.tokenCheck("0x...");
 *   const swap  = await maiat.trustSwap({ ... });
 *   await maiat.reportOutcome({ agent: "0x...", action: "swap", result: "success" });
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MaiatConfig {
  /** Base URL for Maiat Protocol API. Default: https://maiat-protocol.vercel.app */
  baseUrl?: string;
  /** Optional API key for higher rate limits */
  apiKey?: string;
  /** Client identifier — tracks which agent/app is making requests (training data) */
  clientId?: string;
  /** Request timeout in ms. Default: 15000 */
  timeout?: number;
}

export interface AgentTrustResult {
  address: string;
  trustScore: number;
  dataSource: string;
  breakdown: {
    completionRate: number;
    paymentRate: number;
    expireRate: number;
    totalJobs: number;
    ageWeeks: number | null;
  };
  verdict: "proceed" | "caution" | "avoid";
  lastUpdated: string;
}

export interface TokenCheckResult {
  address: string;
  tokenType: string;
  trustScore: number;
  verdict: "proceed" | "caution" | "avoid";
  riskFlags: string[];
  riskSummary: string;
  dataSource: string;
}

export interface TrustSwapParams {
  swapper: string;
  tokenIn: string;
  tokenOut: string;
  amount: string;
  chainId?: number;
  slippage?: number;
}

export interface TrustSwapResult {
  quote: Record<string, unknown>;
  calldata: string | null;
  to: string | null;
  value: string | null;
  trust: {
    tokenIn: { score: number; risk: string } | null;
    tokenOut: { score: number; risk: string } | null;
  };
  timestamp: string;
}

export interface OutcomeReport {
  /** The agent or token address that was checked */
  target: string;
  /** What action was taken after checking trust */
  action: "swap" | "delegate" | "hire" | "skip" | "block" | "other";
  /** The outcome of that action */
  result: "success" | "failure" | "scam" | "partial" | "pending";
  /** On-chain tx hash as proof (optional) */
  txHash?: string;
  /** What Maiat verdict was at the time */
  maiatVerdict?: "proceed" | "caution" | "avoid";
  /** Trust score at the time of check */
  maiatScore?: number;
  /** Free-form context */
  notes?: string;
}

export interface OutcomeResponse {
  logged: boolean;
  id?: string;
}

// ─── Client ───────────────────────────────────────────────────────────────────

export class Maiat {
  private baseUrl: string;
  private apiKey?: string;
  private clientId?: string;
  private timeout: number;

  constructor(config: MaiatConfig = {}) {
    this.baseUrl = (config.baseUrl ?? "https://maiat-protocol.vercel.app").replace(/\/$/, "");
    this.apiKey = config.apiKey;
    this.clientId = config.clientId;
    this.timeout = config.timeout ?? 15_000;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(this.apiKey ? { "X-Maiat-Key": this.apiKey } : {}),
      ...(this.clientId ? { "X-Maiat-Client": this.clientId } : {}),
    };

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { ...headers, ...(options?.headers as Record<string, string>) },
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new MaiatError(`HTTP ${res.status}: ${body}`, res.status);
    }

    return res.json() as Promise<T>;
  }

  // ─── Core Methods ─────────────────────────────────────────────────────────

  /** Get trust score for an ACP agent by wallet address */
  async agentTrust(address: string): Promise<AgentTrustResult> {
    return this.request<AgentTrustResult>(`/api/v1/agent/${address}`);
  }

  /** Check if a token is safe (honeypot, rug, liquidity) */
  async tokenCheck(address: string): Promise<TokenCheckResult> {
    return this.request<TokenCheckResult>(`/api/v1/token/${address}`);
  }

  /** Get a trust-verified swap quote with calldata */
  async trustSwap(params: TrustSwapParams): Promise<TrustSwapResult> {
    return this.request<TrustSwapResult>("/api/v1/swap/quote", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  /** List indexed agents with trust scores */
  async listAgents(limit = 50): Promise<{ agents: AgentTrustResult[]; total: number }> {
    return this.request(`/api/v1/agents?limit=${limit}`);
  }

  // ─── Outcome Reporting (Training Data) ────────────────────────────────────

  /**
   * Report the outcome of an action taken after a Maiat trust check.
   * This is the most valuable data for training the oracle.
   *
   * Example flow:
   *   1. maiat.isTrusted("0x...") → true
   *   2. You swap with that agent
   *   3. maiat.reportOutcome({ target: "0x...", action: "swap", result: "success" })
   */
  async reportOutcome(report: OutcomeReport): Promise<OutcomeResponse> {
    return this.request<OutcomeResponse>("/api/v1/outcome", {
      method: "POST",
      body: JSON.stringify(report),
    });
  }

  // ─── Convenience ──────────────────────────────────────────────────────────

  /** Quick check: is this agent trustworthy? Returns true if score >= threshold */
  async isTrusted(address: string, threshold = 60): Promise<boolean> {
    try {
      const result = await this.agentTrust(address);
      return result.trustScore >= threshold;
    } catch {
      return false; // fail-closed: unknown = untrusted
    }
  }

  /** Quick check: is this token safe to swap? */
  async isTokenSafe(address: string): Promise<boolean> {
    try {
      const result = await this.tokenCheck(address);
      return result.verdict === "proceed";
    } catch {
      return false;
    }
  }
}

// ─── Error ────────────────────────────────────────────────────────────────────

export class MaiatError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "MaiatError";
  }
}

// ─── Default export ───────────────────────────────────────────────────────────

export default Maiat;
