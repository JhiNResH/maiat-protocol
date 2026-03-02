/**
 * Maiat SDK — Trust scores, token safety & swap verification for AI agents
 *
 * Usage:
 *   import { Maiat } from "maiat-sdk";
 *   const maiat = new Maiat();
 *   const score = await maiat.agentTrust("0x...");
 *   const token = await maiat.tokenCheck("0x...");
 *   const swap  = await maiat.trustSwap({ ... });
 */
export interface MaiatConfig {
    /** Base URL for Maiat Protocol API. Default: https://maiat-protocol.vercel.app */
    baseUrl?: string;
    /** Optional API key for higher rate limits */
    apiKey?: string;
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
export declare class Maiat {
    private baseUrl;
    private apiKey?;
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
