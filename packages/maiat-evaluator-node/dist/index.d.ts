/**
 * Maiat Evaluator — Drop-in trust evaluator for Virtuals ACP / GAME SDK (Node.js).
 *
 * Usage (one-line integration):
 *
 *   import { maiatEvaluator } from "@jhinresh/maiat-evaluator";
 *
 *   const acpPlugin = new AcpPlugin({
 *     apiKey: GAME_API_KEY,
 *     acpClient: new VirtualsACP({
 *       walletPrivateKey: WALLET_KEY,
 *       agentWalletAddress: AGENT_WALLET,
 *       entityId: ENTITY_ID,
 *       onEvaluate: maiatEvaluator(), // <--- one line
 *     }),
 *     evaluatorCluster: "MAIAT",
 *   });
 */
export interface MaiatEvaluatorConfig {
    /** Maiat API URL. Default: https://app.maiat.io/api/v1 */
    apiUrl?: string;
    /** Minimum trust score to approve (0-100). Default: 30 */
    minTrustScore?: number;
    /** Minimum deliverable length to be considered real work. Default: 20 */
    garbageThreshold?: number;
    /** Auto-approve providers with score >= 80. Default: true */
    autoApproveTrusted?: boolean;
    /** Auto-reject empty/garbage deliverables. Default: true */
    autoRejectGarbage?: boolean;
    /** Report outcomes back to Maiat. Default: true */
    recordOutcomes?: boolean;
    /** Optional callback for edge cases (moderate trust + real deliverable) */
    onManualReview?: (job: ACPJob, trustResult: TrustResult, deliverable: string) => void;
}
/** Minimal ACPJob interface (compatible with GAME SDK) */
export interface ACPJob {
    id: string | number;
    memos?: ACPMemo[];
    evaluate?: (approve: boolean) => void;
    providerAddress?: string;
    provider_address?: string;
    provider?: string;
    [key: string]: unknown;
}
export interface ACPMemo {
    nextPhase?: string;
    next_phase?: string;
    content?: string;
    [key: string]: unknown;
}
export interface TrustResult {
    score: number;
    verdict: string;
    completionRate?: number;
    totalJobs?: number;
    error?: string;
}
export declare class MaiatEvaluator {
    private config;
    constructor(config?: MaiatEvaluatorConfig);
    /** Called by GAME SDK when a job needs evaluation. */
    evaluate(job: ACPJob): Promise<void>;
    private _evaluateJob;
    private _checkTrust;
    private _isGarbage;
    private _recordOutcome;
    private _getProviderAddress;
    private _safeEvaluate;
}
/**
 * Create a Maiat evaluator for GAME SDK's onEvaluate callback.
 *
 * @example
 *   import { maiatEvaluator } from "@jhinresh/maiat-evaluator";
 *
 *   const acpClient = new VirtualsACP({
 *     ...,
 *     onEvaluate: maiatEvaluator(), // default settings
 *   });
 *
 *   // Custom config:
 *   onEvaluate: maiatEvaluator({ minTrustScore: 50 }),
 */
export declare function maiatEvaluator(config?: MaiatEvaluatorConfig): (job: ACPJob) => Promise<void>;
