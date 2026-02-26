/**
 * @maiat/elizaos-plugin
 *
 * Maiat Trust Score plugin for ElizaOS (ai16z agent framework).
 *
 * V0.2.0 — Cold-start update:
 * - CHECK_TRUST: Trust score lookup (existing)
 * - SUBMIT_REVIEW: Submit reviews with Scarab staking
 * - GET_INTERACTIONS: Discover wallet contract interactions
 * - GET_PASSPORT: Reputation passport
 * - DEFI_INFO: Query DeFi protocols
 * - AGENT_INFO: Query AI agents
 *
 * @example
 * ```typescript
 * import { maiatPlugin } from "@maiat/elizaos-plugin";
 *
 * const agent = new ElizaAgent({
 *   plugins: [maiatPlugin({ minScore: 3.0 })],
 * });
 * ```
 */
export interface MaiatElizaConfig {
    apiUrl?: string;
    apiKey?: string;
    chain?: string;
    minScore?: number;
}
/**
 * ElizaOS plugin definition following the standard plugin interface.
 *
 * Registers:
 * - Actions: CHECK_TRUST, SUBMIT_REVIEW, GET_INTERACTIONS, GET_PASSPORT, DEFI_INFO, AGENT_INFO
 * - Evaluator: TRUST_GATE
 * - Provider: TRUST_DATA
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
            data: any;
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
            risk?: undefined;
        } | {
            pass: boolean;
            score: number;
            risk: string;
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
