/**
 * Maiat SDK — Trust scores, token safety & swap verification for AI agents
 *
 * Usage:
 *   import { Maiat } from "@jhinresh/maiat-sdk";
 *   const maiat = new Maiat({ clientId: "my-agent" });
 *   const score = await maiat.agentTrust("0x...");
 *   const token = await maiat.tokenCheck("0x...");
 *   const swap  = await maiat.trustSwap({ ... });
 *   await maiat.reportOutcome({ jobId: "...", outcome: "success" });
 */
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
    feedback?: {
        queryId: string;
    };
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
export declare class Maiat {
    private baseUrl;
    private apiKey?;
    private clientId?;
    private framework?;
    private timeout;
    constructor(config?: MaiatConfig);
    private request;
    /** Get trust score for an ACP agent by wallet address */
    agentTrust(address: string): Promise<AgentTrustResult>;
    /** Get deep analysis for an ACP agent by wallet address */
    deep(address: string): Promise<DeepAnalysisResult>;
    /** Check if a token is safe (honeypot, rug, liquidity) */
    tokenCheck(address: string): Promise<TokenCheckResult>;
    /** Get forensics data for a token address */
    forensics(address: string, chain?: string): Promise<ForensicsResult>;
    /** Get a trust-verified swap quote with calldata */
    trustSwap(params: TrustSwapParams): Promise<TrustSwapResult>;
    /** List indexed agents with trust scores */
    listAgents(limit?: number): Promise<{
        agents: AgentTrustResult[];
        total: number;
    }>;
    /** Get SCARAB token balance for an address */
    scarab(address: string): Promise<ScarabResult>;
    /**
     * Report the outcome of a job (new API).
     *
     * Example flow:
     *   1. maiat.agentTrust("0x...") → proceed
     *   2. You execute the job
     *   3. maiat.reportOutcome({ jobId: "...", outcome: "success" })
     */
    reportOutcome(params: OutcomeParams): Promise<OutcomeResult>;
    /** Quick check: is this agent trustworthy? Returns true if score >= threshold */
    isTrusted(address: string, threshold?: number): Promise<boolean>;
    /** Quick check: is this token safe to swap? */
    isTokenSafe(address: string): Promise<boolean>;
}
export declare class MaiatError extends Error {
    status: number;
    constructor(message: string, status: number);
}
/** MaiatEvaluator contract address on Base mainnet */
export declare const MAIAT_EVALUATOR_ADDRESS = "0x0000000000000000000000000000000000000000";
/** MaiatACPHook contract address on Base mainnet */
export declare const MAIAT_ACP_HOOK_ADDRESS = "0x0000000000000000000000000000000000000000";
/** Evaluator cluster name for Virtuals Service Registry */
export declare const MAIAT_EVALUATOR_CLUSTER = "MAIAT";
/**
 * ACP job defaults — use when creating jobs to auto-set Maiat as evaluator.
 *
 * @example
 *   import { MAIAT_ACP_DEFAULTS } from "@jhinresh/maiat-sdk";
 *   const job = await acpClient.createJob({
 *     ...jobParams,
 *     ...MAIAT_ACP_DEFAULTS,
 *   });
 */
export declare const MAIAT_ACP_DEFAULTS: {
    readonly evaluator: "0x0000000000000000000000000000000000000000";
    readonly hook: "0x0000000000000000000000000000000000000000";
    readonly evaluatorCluster: "MAIAT";
};
export default Maiat;
