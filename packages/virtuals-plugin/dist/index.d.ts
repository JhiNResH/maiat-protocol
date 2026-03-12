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
    /** Minimum trust score (0-100). Default: 60 */
    minScore?: number;
    /** Maiat API base URL. Default: https://app.maiat.io */
    apiUrl?: string;
    /** Optional API key for higher rate limits */
    apiKey?: string;
    /** Warn but don't block if score is low. Default: false */
    warnOnly?: boolean;
}
/**
 * Returns plain function configs compatible with GameFunction constructor.
 */
export declare function maiatFunctionConfigs(config?: MaiatVirtualsConfig): {
    checkTrustConfig: GameFunctionConfig<{
        address: string;
    }>;
    gateTxConfig: GameFunctionConfig<{
        to: string;
        action?: string;
    }>;
};
/**
 * Create a GAME-compatible worker with Maiat trust functions.
 */
export declare function createMaiatWorker(config?: MaiatVirtualsConfig): Promise<unknown>;
export default createMaiatWorker;
