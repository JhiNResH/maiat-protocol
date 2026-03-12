export interface MaiatElizaConfig {
    apiUrl?: string;
    apiKey?: string;
    chain?: string;
    minScore?: number;
}
/**
 * ElizaOS plugin definition following the standard plugin interface.
 */
export declare function maiatPlugin(config?: MaiatElizaConfig): {
    name: string;
    description: string;
    actions: {
        name: string;
        description: string;
        examples: string[];
        validate: (message: string) => Promise<boolean>;
        handler: (message: string) => Promise<{
            text: string;
            data?: undefined;
        } | {
            text: string;
            data: import("@jhinresh/maiat-sdk").AgentTrustResult;
        }>;
    }[];
    evaluators: {
        name: string;
        description: string;
        handler: (context: {
            address?: string;
        }) => Promise<{
            pass: boolean;
            reason: string;
            score?: undefined;
            verdict?: undefined;
        } | {
            pass: boolean;
            score: number;
            verdict: "proceed" | "caution" | "avoid";
            reason: string;
        }>;
    }[];
    providers: {
        name: string;
        description: string;
        handler: () => Promise<{
            text: string;
        }>;
    }[];
};
export default maiatPlugin;
