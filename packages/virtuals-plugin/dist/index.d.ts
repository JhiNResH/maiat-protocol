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
export declare enum ExecutableGameFunctionStatus {
    Done = "done",
    Failed = "failed"
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
type ExecutableFn<T extends Record<string, string>> = (args: T, logger: (msg: string) => void) => Promise<ExecutableGameFunctionResponse>;
interface GameFunctionConfig<T extends Record<string, string>> {
    name: string;
    description: string;
    args: GameFunctionArg[];
    executable: ExecutableFn<T>;
}
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
export declare class MaiatClient {
    private apiUrl;
    private apiKey;
    private chain;
    private cache;
    constructor(config?: MaiatVirtualsConfig);
    private get headers();
    checkTrust(address: string): Promise<TrustScoreResult>;
    submitReview(review: {
        address: string;
        rating: number;
        comment?: string;
        reviewer: string;
    }): Promise<any>;
    getInteractions(wallet: string): Promise<any>;
    getPassport(wallet: string): Promise<any>;
    getDefiInfo(query: string): Promise<any>;
    getAgentInfo(query: string): Promise<any>;
}
/**
 * Returns plain function configs compatible with GameFunction constructor.
 * V0.2.0: Added submitReview, getInteractions, getPassport, defiInfo, agentInfo
 */
export declare function maiatFunctionConfigs(config?: MaiatVirtualsConfig): {
    checkTrustConfig: GameFunctionConfig<{
        address: string;
        chain?: string;
    }>;
    gateTxConfig: GameFunctionConfig<{
        to: string;
        action?: string;
    }>;
    submitReviewConfig: GameFunctionConfig<{
        address: string;
        rating: string;
        comment?: string;
        reviewer: string;
    }>;
    getInteractionsConfig: GameFunctionConfig<{
        wallet: string;
    }>;
    getPassportConfig: GameFunctionConfig<{
        wallet: string;
    }>;
    defiInfoConfig: GameFunctionConfig<{
        query: string;
    }>;
    agentInfoConfig: GameFunctionConfig<{
        query: string;
    }>;
};
/**
 * Create a GAME-compatible worker with Maiat trust functions.
 * Requires @virtuals-protocol/game to be installed.
 *
 * V0.2.0: Now includes 7 functions (trust, gate, review, interactions, passport, defi, agent)
 */
export declare function createMaiatWorker(config?: MaiatVirtualsConfig): Promise<unknown>;
export default createMaiatWorker;
