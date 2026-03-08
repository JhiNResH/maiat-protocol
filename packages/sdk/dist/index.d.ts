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
export interface MaiatConfig {
    /** Base URL for Maiat Protocol API. Default: https://app.maiat.io */
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
        tokenIn: {
            score: number;
            risk: string;
        } | null;
        tokenOut: {
            score: number;
            risk: string;
        } | null;
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
export declare class Maiat {
    private baseUrl;
    private apiKey?;
    private clientId?;
    private timeout;
    constructor(config?: MaiatConfig);
    private request;
    /** Get trust score for an ACP agent by wallet address */
    agentTrust(address: string): Promise<AgentTrustResult>;
    /** Check if a token is safe (honeypot, rug, liquidity) */
    tokenCheck(address: string): Promise<TokenCheckResult>;
    /** Get a trust-verified swap quote with calldata */
    trustSwap(params: TrustSwapParams): Promise<TrustSwapResult>;
    /** List indexed agents with trust scores */
    listAgents(limit?: number): Promise<{
        agents: AgentTrustResult[];
        total: number;
    }>;
    /**
     * Report the outcome of an action taken after a Maiat trust check.
     * This is the most valuable data for training the oracle.
     *
     * Example flow:
     *   1. maiat.isTrusted("0x...") → true
     *   2. You swap with that agent
     *   3. maiat.reportOutcome({ target: "0x...", action: "swap", result: "success" })
     */
    reportOutcome(report: OutcomeReport): Promise<OutcomeResponse>;
    /** Quick check: is this agent trustworthy? Returns true if score >= threshold */
    isTrusted(address: string, threshold?: number): Promise<boolean>;
    /** Quick check: is this token safe to swap? */
    isTokenSafe(address: string): Promise<boolean>;
}
export declare class MaiatError extends Error {
    status: number;
    constructor(message: string, status: number);
}
export default Maiat;
