/**
 * @maiat/agentkit-plugin
 *
 * Coinbase AgentKit plugin that adds trust scoring to every agent transaction.
 *
 * V0.2.0 — Cold-start update:
 * - submitReview(): Submit trust reviews with Scarab staking
 * - getInteractions(): Discover contracts a wallet has interacted with
 * - getPassport(): Get a wallet's reputation passport
 * - getDefiInfo(): Query DeFi protocol trust data by slug or address
 * - getAgentInfo(): Query AI agent trust data by slug or address
 *
 * Usage:
 * ```typescript
 * import { AgentKit } from "@coinbase/agentkit";
 * import { maiatTrustPlugin } from "@maiat/agentkit-plugin";
 *
 * const agent = new AgentKit({ ... });
 * agent.use(maiatTrustPlugin({ minScore: 3.0 }));
 * ```
 */
export interface MaiatPluginConfig {
    /** Minimum trust score (0-10) to allow transactions. Default: 3.0 */
    minScore?: number;
    /** Maiat API base URL. Default: https://maiat-protocol.vercel.app */
    apiUrl?: string;
    /** API key for higher rate limits */
    apiKey?: string;
    /** Chain to check. Default: base */
    chain?: string;
    /** If true, log warnings but don't block. Default: false */
    warnOnly?: boolean;
    /** Callback when a transaction is blocked */
    onBlocked?: (address: string, score: number, risk: string) => void;
    /** Callback for every trust check */
    onCheck?: (address: string, score: number, risk: string) => void;
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
    details: {
        txCount: number;
        balanceETH: number;
        isContract: boolean;
        walletAge: string | null;
        lastActive: string | null;
    };
    protocol?: {
        name: string;
        category: string;
        auditedBy?: string[];
    };
}
export interface ReviewSubmission {
    address: string;
    rating: number;
    comment?: string;
    tags?: string[];
    reviewer: string;
    signature?: string;
}
export interface ReviewResult {
    success: boolean;
    review: {
        id: string;
        address: string;
        rating: number;
        comment: string;
        reviewer: string;
        timestamp: string;
    };
    meta: {
        interactionVerified: boolean;
        qualityScore: number | null;
        scarabDeducted: boolean;
        scarabReward: number;
    };
}
export interface InteractionResult {
    wallet: string;
    interacted: Array<{
        address: string;
        name: string;
        category: string;
        slug: string | null;
        txCount: number;
        trustScore: number | null;
        canReview: boolean;
        hasReviewed: boolean;
    }>;
    interactedCount: number;
    notInteracted: Array<{
        address: string;
        name: string;
        category: string;
        canReview: boolean;
    }>;
}
export interface PassportResult {
    wallet: string;
    passport: {
        trustLevel: "new" | "trusted" | "verified" | "guardian";
        reputationScore: number;
        totalReviews: number;
        feeTier: {
            rate: number;
            discount: string;
            label: string;
        };
    };
    scarab: {
        balance: number;
    };
    reviews: {
        count: number;
        addressesReviewed: string[];
    };
    progression: {
        current: string;
        nextLevel: string | null;
        pointsToNext: number | null;
        benefits: string[];
    };
}
export interface EntityInfoResult {
    entity: {
        address: string;
        slug: string;
        name: string;
        type: string;
        category: string;
        auditedBy?: string[];
    };
    trust: {
        score: number;
        risk?: string;
    } | null;
    reviews: {
        total: number;
        avgRating: number;
    };
    canonical: {
        url: string;
    };
}
export declare class MaiatTrustError extends Error {
    address: string;
    score: number;
    risk: string;
    minScore: number;
    constructor(address: string, score: number, risk: string, minScore: number);
}
export declare class MaiatClient {
    private apiUrl;
    private apiKey;
    private chain;
    private cache;
    constructor(config?: Pick<MaiatPluginConfig, "apiUrl" | "apiKey" | "chain">);
    private get headers();
    checkTrust(address: string, chain?: string): Promise<TrustScoreResult>;
    batchCheck(addresses: string[], chain?: string): Promise<TrustScoreResult[]>;
    isSafe(score: number, minScore?: number): boolean;
    /** Submit a trust review for a contract address. Costs 2 Scarab. */
    submitReview(review: ReviewSubmission): Promise<ReviewResult>;
    /** Discover contracts a wallet has interacted with on Base. */
    getInteractions(walletAddress: string): Promise<InteractionResult>;
    /** Get a wallet's reputation passport (trust level, Scarab, reviews). */
    getPassport(walletAddress: string): Promise<PassportResult>;
    /** Get DeFi protocol info by slug or address. */
    getDefiInfo(slugOrAddress: string): Promise<EntityInfoResult>;
    /** Get AI agent info by slug or address. */
    getAgentInfo(slugOrAddress: string): Promise<EntityInfoResult>;
}
/**
 * AgentKit plugin action definitions.
 * These are the tools/actions that the agent can use.
 */
export declare function maiatTrustActions(config?: MaiatPluginConfig): ({
    name: string;
    description: string;
    schema: {
        type: "object";
        properties: {
            address: {
                type: string;
                description: string;
            };
            chain: {
                type: string;
                description: string;
            };
            to?: undefined;
            value?: undefined;
            rating?: undefined;
            comment?: undefined;
            reviewer?: undefined;
            tags?: undefined;
            wallet?: undefined;
            query?: undefined;
        };
        required: string[];
    };
    handler: (params: {
        address: string;
        chain?: string;
    }) => Promise<{
        score: number;
        risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
        type: string;
        flags: string[];
        safe: boolean;
        breakdown: {
            onChainHistory: number;
            contractAnalysis: number;
            blacklistCheck: number;
            activityPattern: number;
        };
        details: {
            txCount: number;
            balanceETH: number;
            isContract: boolean;
            walletAge: string | null;
            lastActive: string | null;
        };
        protocol: {
            name: string;
            category: string;
            auditedBy?: string[];
        } | undefined;
        recommendation: string;
    }>;
} | {
    name: string;
    description: string;
    schema: {
        type: "object";
        properties: {
            to: {
                type: string;
                description: string;
            };
            value: {
                type: string;
                description: string;
            };
            chain: {
                type: string;
                description: string;
            };
            address?: undefined;
            rating?: undefined;
            comment?: undefined;
            reviewer?: undefined;
            tags?: undefined;
            wallet?: undefined;
            query?: undefined;
        };
        required: string[];
    };
    handler: (params: {
        to: string;
        value?: string;
        chain?: string;
    }) => Promise<{
        approved: boolean;
        score: number;
        risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
        address: string;
    }>;
} | {
    name: string;
    description: string;
    schema: {
        type: "object";
        properties: {
            address: {
                type: string;
                description: string;
            };
            rating: {
                type: string;
                description: string;
            };
            comment: {
                type: string;
                description: string;
            };
            reviewer: {
                type: string;
                description: string;
            };
            tags: {
                type: string;
                description: string;
            };
            chain?: undefined;
            to?: undefined;
            value?: undefined;
            wallet?: undefined;
            query?: undefined;
        };
        required: string[];
    };
    handler: (params: ReviewSubmission) => Promise<{
        success: boolean;
        reviewId: string;
        scarabReward: number;
        qualityScore: number | null;
        interactionVerified: boolean;
        message: string;
    }>;
} | {
    name: string;
    description: string;
    schema: {
        type: "object";
        properties: {
            wallet: {
                type: string;
                description: string;
            };
            address?: undefined;
            chain?: undefined;
            to?: undefined;
            value?: undefined;
            rating?: undefined;
            comment?: undefined;
            reviewer?: undefined;
            tags?: undefined;
            query?: undefined;
        };
        required: string[];
    };
    handler: (params: {
        wallet: string;
    }) => Promise<{
        wallet: string;
        interactedCount: number;
        contracts: {
            name: string;
            address: string;
            category: string;
            txCount: number;
            trustScore: number | null;
            canReview: boolean;
            hasReviewed: boolean;
        }[];
        message: string;
    }>;
} | {
    name: string;
    description: string;
    schema: {
        type: "object";
        properties: {
            wallet: {
                type: string;
                description: string;
            };
            address?: undefined;
            chain?: undefined;
            to?: undefined;
            value?: undefined;
            rating?: undefined;
            comment?: undefined;
            reviewer?: undefined;
            tags?: undefined;
            query?: undefined;
        };
        required: string[];
    };
    handler: (params: {
        wallet: string;
    }) => Promise<{
        trustLevel: "new" | "trusted" | "verified" | "guardian";
        reputationScore: number;
        totalReviews: number;
        scarabBalance: number;
        feeTier: {
            rate: number;
            discount: string;
            label: string;
        };
        nextLevel: string | null;
        pointsToNext: number | null;
        benefits: string[];
        message: string;
    }>;
} | {
    name: string;
    description: string;
    schema: {
        type: "object";
        properties: {
            query: {
                type: string;
                description: string;
            };
            address?: undefined;
            chain?: undefined;
            to?: undefined;
            value?: undefined;
            rating?: undefined;
            comment?: undefined;
            reviewer?: undefined;
            tags?: undefined;
            wallet?: undefined;
        };
        required: string[];
    };
    handler: (params: {
        query: string;
    }) => Promise<{
        name: string;
        address: string;
        category: string;
        trustScore: number | null;
        reviews: number;
        avgRating: number;
        url: string;
    }>;
})[];
/**
 * Create a Maiat trust plugin for AgentKit
 *
 * @example
 * ```ts
 * import { maiatTrustPlugin } from "@maiat/agentkit-plugin";
 *
 * const plugin = maiatTrustPlugin({
 *   minScore: 3.0,
 *   onBlocked: (addr, score) => console.log(`Blocked ${addr}: ${score}/10`)
 * });
 *
 * // Use with AgentKit
 * agent.use(plugin);
 * ```
 */
export declare function maiatTrustPlugin(config?: MaiatPluginConfig): {
    name: string;
    version: string;
    actions: ({
        name: string;
        description: string;
        schema: {
            type: "object";
            properties: {
                address: {
                    type: string;
                    description: string;
                };
                chain: {
                    type: string;
                    description: string;
                };
                to?: undefined;
                value?: undefined;
                rating?: undefined;
                comment?: undefined;
                reviewer?: undefined;
                tags?: undefined;
                wallet?: undefined;
                query?: undefined;
            };
            required: string[];
        };
        handler: (params: {
            address: string;
            chain?: string;
        }) => Promise<{
            score: number;
            risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
            type: string;
            flags: string[];
            safe: boolean;
            breakdown: {
                onChainHistory: number;
                contractAnalysis: number;
                blacklistCheck: number;
                activityPattern: number;
            };
            details: {
                txCount: number;
                balanceETH: number;
                isContract: boolean;
                walletAge: string | null;
                lastActive: string | null;
            };
            protocol: {
                name: string;
                category: string;
                auditedBy?: string[];
            } | undefined;
            recommendation: string;
        }>;
    } | {
        name: string;
        description: string;
        schema: {
            type: "object";
            properties: {
                to: {
                    type: string;
                    description: string;
                };
                value: {
                    type: string;
                    description: string;
                };
                chain: {
                    type: string;
                    description: string;
                };
                address?: undefined;
                rating?: undefined;
                comment?: undefined;
                reviewer?: undefined;
                tags?: undefined;
                wallet?: undefined;
                query?: undefined;
            };
            required: string[];
        };
        handler: (params: {
            to: string;
            value?: string;
            chain?: string;
        }) => Promise<{
            approved: boolean;
            score: number;
            risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
            address: string;
        }>;
    } | {
        name: string;
        description: string;
        schema: {
            type: "object";
            properties: {
                address: {
                    type: string;
                    description: string;
                };
                rating: {
                    type: string;
                    description: string;
                };
                comment: {
                    type: string;
                    description: string;
                };
                reviewer: {
                    type: string;
                    description: string;
                };
                tags: {
                    type: string;
                    description: string;
                };
                chain?: undefined;
                to?: undefined;
                value?: undefined;
                wallet?: undefined;
                query?: undefined;
            };
            required: string[];
        };
        handler: (params: ReviewSubmission) => Promise<{
            success: boolean;
            reviewId: string;
            scarabReward: number;
            qualityScore: number | null;
            interactionVerified: boolean;
            message: string;
        }>;
    } | {
        name: string;
        description: string;
        schema: {
            type: "object";
            properties: {
                wallet: {
                    type: string;
                    description: string;
                };
                address?: undefined;
                chain?: undefined;
                to?: undefined;
                value?: undefined;
                rating?: undefined;
                comment?: undefined;
                reviewer?: undefined;
                tags?: undefined;
                query?: undefined;
            };
            required: string[];
        };
        handler: (params: {
            wallet: string;
        }) => Promise<{
            wallet: string;
            interactedCount: number;
            contracts: {
                name: string;
                address: string;
                category: string;
                txCount: number;
                trustScore: number | null;
                canReview: boolean;
                hasReviewed: boolean;
            }[];
            message: string;
        }>;
    } | {
        name: string;
        description: string;
        schema: {
            type: "object";
            properties: {
                wallet: {
                    type: string;
                    description: string;
                };
                address?: undefined;
                chain?: undefined;
                to?: undefined;
                value?: undefined;
                rating?: undefined;
                comment?: undefined;
                reviewer?: undefined;
                tags?: undefined;
                query?: undefined;
            };
            required: string[];
        };
        handler: (params: {
            wallet: string;
        }) => Promise<{
            trustLevel: "new" | "trusted" | "verified" | "guardian";
            reputationScore: number;
            totalReviews: number;
            scarabBalance: number;
            feeTier: {
                rate: number;
                discount: string;
                label: string;
            };
            nextLevel: string | null;
            pointsToNext: number | null;
            benefits: string[];
            message: string;
        }>;
    } | {
        name: string;
        description: string;
        schema: {
            type: "object";
            properties: {
                query: {
                    type: string;
                    description: string;
                };
                address?: undefined;
                chain?: undefined;
                to?: undefined;
                value?: undefined;
                rating?: undefined;
                comment?: undefined;
                reviewer?: undefined;
                tags?: undefined;
                wallet?: undefined;
            };
            required: string[];
        };
        handler: (params: {
            query: string;
        }) => Promise<{
            name: string;
            address: string;
            category: string;
            trustScore: number | null;
            reviews: number;
            avgRating: number;
            url: string;
        }>;
    })[];
    client: MaiatClient;
};
export default maiatTrustPlugin;
