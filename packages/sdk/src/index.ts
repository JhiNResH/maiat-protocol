/**
 * Maiat SDK — Trust scores, token safety & swap verification for AI agents
 *
 * Usage:
 *   import { Maiat } from "maiat-sdk";
 *   const maiat = new Maiat({ clientId: "my-agent" });
 *   const score = await maiat.agentTrust("0x...");
 *   const token = await maiat.tokenCheck("0x...");
 *   const swap  = await maiat.trustSwap({ ... });
 *   await maiat.reportOutcome({ jobId: "...", outcome: "success" });
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MaiatConfig {
  /** Base URL for Maiat Protocol API. Default: https://app.maiat.io */
  baseUrl?: string;
  /** Optional API key for higher rate limits */
  apiKey?: string;
  /** Client identifier — tracks which agent/app is making requests (training data) */
  clientId?: string;
  /** Framework identifier — e.g. "elizaos", "virtuals", "game" */
  framework?: string;
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
  feedback?: { queryId: string };
}

export interface DeepAnalysisResult {
  address: string;
  trustScore: number;
  verdict: "proceed" | "caution" | "avoid";
  deepAnalysis: Record<string, unknown>;
  signals: Record<string, unknown>;
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

export interface ForensicsResult {
  address: string;
  chain: string;
  forensics: Record<string, unknown>;
  riskFlags: string[];
  verdict: "proceed" | "caution" | "avoid";
  lastUpdated: string;
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

export interface OutcomeParams {
  jobId: string;
  outcome: "success" | "failure" | "partial" | "expired";
  reporter?: string;
  note?: string;
}

export interface OutcomeResult {
  success: boolean;
  id?: string;
  message?: string;
}

export interface ScarabResult {
  address: string;
  balance: string;
  balanceFormatted: number;
  tier: string;
  lastUpdated: string;
}

// ─── Client ───────────────────────────────────────────────────────────────────

export class Maiat {
  private baseUrl: string;
  private apiKey?: string;
  private clientId?: string;
  private framework?: string;
  private timeout: number;

  constructor(config: MaiatConfig = {}) {
    this.baseUrl = (config.baseUrl ?? "https://app.maiat.io").replace(/\/$/, "");
    this.apiKey = config.apiKey;
    this.clientId = config.clientId;
    this.framework = config.framework;
    this.timeout = config.timeout ?? 15_000;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(this.apiKey ? { "X-Maiat-Key": this.apiKey } : {}),
      ...(this.clientId ? { "X-Maiat-Client": this.clientId } : {}),
      ...(this.framework ? { "X-Maiat-Framework": this.framework } : {}),
      "User-Agent": `maiat-sdk-js/1.0.0${this.framework ? ` (${this.framework})` : ''}`,
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

  /** Get deep analysis for an ACP agent by wallet address */
  async deep(address: string): Promise<DeepAnalysisResult> {
    return this.request<DeepAnalysisResult>(`/api/v1/agent/${address}/deep`);
  }

  /** Check if a token is safe (honeypot, rug, liquidity) */
  async tokenCheck(address: string): Promise<TokenCheckResult> {
    return this.request<TokenCheckResult>(`/api/v1/token/${address}`);
  }

  /** Get forensics data for a token address */
  async forensics(address: string, chain?: string): Promise<ForensicsResult> {
    const query = chain ? `?chain=${chain}` : "";
    return this.request<ForensicsResult>(`/api/v1/token/${address}/forensics${query}`);
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

  /** Get SCARAB token balance for an address */
  async scarab(address: string): Promise<ScarabResult> {
    return this.request<ScarabResult>(`/api/v1/scarab?address=${address}`);
  }

  // ─── Outcome Reporting ────────────────────────────────────────────────────

  /**
   * Report the outcome of a job (new API).
   *
   * Example flow:
   *   1. maiat.agentTrust("0x...") → proceed
   *   2. You execute the job
   *   3. maiat.reportOutcome({ jobId: "...", outcome: "success" })
   */
  async reportOutcome(params: OutcomeParams): Promise<OutcomeResult> {
    return this.request<OutcomeResult>("/api/v1/outcome", {
      method: "POST",
      body: JSON.stringify(params),
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
