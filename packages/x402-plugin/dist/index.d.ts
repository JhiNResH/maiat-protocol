/**
 * @maiat/x402-plugin
 *
 * Trust-gated x402 payments for AI agents.
 * Wraps Coinbase's x402 protocol with Maiat trust verification so agents
 * never pay untrusted counterparties.
 *
 * @example
 * ```ts
 * import { createTrustGatedClient } from "@maiat/x402-plugin";
 *
 * const client = createTrustGatedClient({
 *   minScore: 3.0,
 *   walletClient,           // viem WalletClient
 *   onBlocked: (addr, score) => console.log(`Blocked ${addr}: ${score}/10`),
 * });
 *
 * // Every x402 payment is trust-checked first
 * const response = await client.fetch("https://api.example.com/paid-endpoint");
 * ```
 */
import { type MaiatPluginConfig, type TrustScoreResult } from "@maiat/agentkit-plugin";
export interface X402TrustConfig extends MaiatPluginConfig {
    /** viem WalletClient for signing x402 payments */
    walletClient?: unknown;
    /** x402 facilitator URL. Default: https://facilitator.x402.org */
    facilitatorUrl?: string;
    /** Maximum USDC to pay per request (safety cap). Default: 1.00 */
    maxPriceUsd?: number;
    /** Cache trust scores for N milliseconds. Default: 300000 (5 min) */
    cacheTtlMs?: number;
    /** Custom header name for payment. Default: X-Payment */
    paymentHeader?: string;
    /** Callback on successful trust-gated payment */
    onPayment?: (url: string, price: string, score: number) => void;
    /** Callback when payment skipped due to trust failure */
    onSkipped?: (url: string, address: string, score: number) => void;
}
export interface TrustGatedResponse {
    /** The HTTP response from the x402 resource */
    response: Response;
    /** Trust score of the payment recipient (if checked) */
    trustScore?: TrustScoreResult;
    /** Whether trust check was performed */
    trustChecked: boolean;
    /** Whether payment was made */
    paid: boolean;
}
export interface PaymentRequirement {
    scheme: string;
    network: string;
    payTo: string;
    price: string;
    description?: string;
    mimeType?: string;
    maxTimeoutSeconds?: number;
    outputSchema?: unknown;
}
export declare class TrustGatedX402Client {
    private maiat;
    private config;
    private trustCache;
    constructor(config?: X402TrustConfig);
    /**
     * Fetch a URL with trust-gated x402 payment.
     *
     * Flow:
     * 1. GET the URL
     * 2. If 402 → parse payment requirements
     * 3. Trust-check the payTo address via Maiat
     * 4. If trusted → sign payment → retry with X-Payment header
     * 5. If untrusted → block/warn based on config
     */
    fetch(url: string, init?: RequestInit): Promise<TrustGatedResponse>;
    /**
     * Pre-check if a payment recipient is trustworthy without making a payment.
     */
    precheck(payTo: string): Promise<{
        trusted: boolean;
        score: number;
        risk: string;
        recommendation: string;
    }>;
    /**
     * Get trust score for an address (cached).
     */
    getTrustScore(address: string): Promise<TrustScoreResult>;
    private checkTrustCached;
    private parsePaymentRequirements;
    private createPayment;
}
export declare class X402TrustError extends Error {
    url: string;
    payTo: string;
    score: number;
    risk: string;
    minScore: number;
    constructor(url: string, payTo: string, score: number, risk: string, minScore: number);
}
export declare class X402PriceError extends Error {
    url: string;
    price: number;
    maxPrice: number;
    constructor(url: string, price: number, maxPrice: number);
}
/**
 * AgentKit-compatible actions for trust-gated x402 payments.
 * Adds these tools to any AgentKit-powered agent:
 * - x402_trust_pay: Make a trust-gated x402 payment
 * - x402_precheck: Pre-check a payment recipient's trust
 * - x402_price_check: Check price and trust before committing
 */
export declare function x402TrustActions(config?: X402TrustConfig): ({
    name: string;
    description: string;
    schema: {
        type: "object";
        properties: {
            url: {
                type: string;
                description: string;
            };
            method: {
                type: string;
                description: string;
            };
            body: {
                type: string;
                description: string;
            };
            address?: undefined;
        };
        required: string[];
    };
    handler: (params: {
        url: string;
        method?: string;
        body?: string;
    }) => Promise<{
        status: number;
        paid: boolean;
        trustChecked: boolean;
        trustScore: number | null;
        trustRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null;
        body: string;
        message: string;
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
            url?: undefined;
            method?: undefined;
            body?: undefined;
        };
        required: string[];
    };
    handler: (params: {
        address: string;
    }) => Promise<{
        trusted: boolean;
        score: number;
        risk: string;
        recommendation: string;
    }>;
} | {
    name: string;
    description: string;
    schema: {
        type: "object";
        properties: {
            url: {
                type: string;
                description: string;
            };
            method?: undefined;
            body?: undefined;
            address?: undefined;
        };
        required: string[];
    };
    handler: (params: {
        url: string;
    }) => Promise<{
        requiresPayment: boolean;
        status: number;
        message: string;
        parseable?: undefined;
        price?: undefined;
        payTo?: undefined;
        network?: undefined;
        scheme?: undefined;
        description?: undefined;
        trustScore?: undefined;
        trustRisk?: undefined;
        safe?: undefined;
    } | {
        requiresPayment: boolean;
        parseable: boolean;
        message: string;
        status?: undefined;
        price?: undefined;
        payTo?: undefined;
        network?: undefined;
        scheme?: undefined;
        description?: undefined;
        trustScore?: undefined;
        trustRisk?: undefined;
        safe?: undefined;
    } | {
        requiresPayment: boolean;
        price: any;
        payTo: any;
        network: any;
        scheme: any;
        description: any;
        trustScore: number;
        trustRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
        safe: boolean;
        message: string;
        status?: undefined;
        parseable?: undefined;
    }>;
})[];
/**
 * Create a trust-gated x402 plugin for AgentKit.
 *
 * @example
 * ```ts
 * import { x402TrustPlugin } from "@maiat/x402-plugin";
 * import { maiatTrustPlugin } from "@maiat/agentkit-plugin";
 *
 * // Use both plugins together for complete trust + payment protection
 * agent.use(maiatTrustPlugin({ minScore: 3.0 }));
 * agent.use(x402TrustPlugin({ minScore: 3.0, walletClient }));
 * ```
 */
export declare function x402TrustPlugin(config?: X402TrustConfig): {
    name: string;
    version: string;
    actions: ({
        name: string;
        description: string;
        schema: {
            type: "object";
            properties: {
                url: {
                    type: string;
                    description: string;
                };
                method: {
                    type: string;
                    description: string;
                };
                body: {
                    type: string;
                    description: string;
                };
                address?: undefined;
            };
            required: string[];
        };
        handler: (params: {
            url: string;
            method?: string;
            body?: string;
        }) => Promise<{
            status: number;
            paid: boolean;
            trustChecked: boolean;
            trustScore: number | null;
            trustRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null;
            body: string;
            message: string;
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
                url?: undefined;
                method?: undefined;
                body?: undefined;
            };
            required: string[];
        };
        handler: (params: {
            address: string;
        }) => Promise<{
            trusted: boolean;
            score: number;
            risk: string;
            recommendation: string;
        }>;
    } | {
        name: string;
        description: string;
        schema: {
            type: "object";
            properties: {
                url: {
                    type: string;
                    description: string;
                };
                method?: undefined;
                body?: undefined;
                address?: undefined;
            };
            required: string[];
        };
        handler: (params: {
            url: string;
        }) => Promise<{
            requiresPayment: boolean;
            status: number;
            message: string;
            parseable?: undefined;
            price?: undefined;
            payTo?: undefined;
            network?: undefined;
            scheme?: undefined;
            description?: undefined;
            trustScore?: undefined;
            trustRisk?: undefined;
            safe?: undefined;
        } | {
            requiresPayment: boolean;
            parseable: boolean;
            message: string;
            status?: undefined;
            price?: undefined;
            payTo?: undefined;
            network?: undefined;
            scheme?: undefined;
            description?: undefined;
            trustScore?: undefined;
            trustRisk?: undefined;
            safe?: undefined;
        } | {
            requiresPayment: boolean;
            price: any;
            payTo: any;
            network: any;
            scheme: any;
            description: any;
            trustScore: number;
            trustRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
            safe: boolean;
            message: string;
            status?: undefined;
            parseable?: undefined;
        }>;
    })[];
    client: TrustGatedX402Client;
};
/**
 * Create a standalone trust-gated x402 client (no AgentKit dependency).
 */
export declare function createTrustGatedClient(config?: X402TrustConfig): TrustGatedX402Client;
export { MaiatClient } from "@maiat/agentkit-plugin";
export default x402TrustPlugin;
//# sourceMappingURL=index.d.ts.map