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

import { MaiatClient, type MaiatPluginConfig, type TrustScoreResult } from "@maiat/agentkit-plugin";

// ═══════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════

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

// ═══════════════════════════════════════════
//  Trust-Gated x402 Client
// ═══════════════════════════════════════════

export class TrustGatedX402Client {
  private maiat: MaiatClient;
  private config: Required<Pick<X402TrustConfig, "minScore" | "maxPriceUsd" | "cacheTtlMs" | "paymentHeader">> & X402TrustConfig;
  private trustCache: Map<string, { result: TrustScoreResult; expiresAt: number }> = new Map();

  constructor(config: X402TrustConfig = {}) {
    this.config = {
      minScore: 3.0,
      maxPriceUsd: 1.0,
      cacheTtlMs: 300_000,
      paymentHeader: "X-Payment",
      facilitatorUrl: "https://facilitator.x402.org",
      ...config,
    };
    this.maiat = new MaiatClient({
      apiUrl: config.apiUrl,
      apiKey: config.apiKey,
      chain: config.chain,
    });
  }

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
  async fetch(url: string, init?: RequestInit): Promise<TrustGatedResponse> {
    // Step 1: Initial request
    const initialResponse = await fetch(url, init);

    // Not a 402 → return as-is
    if (initialResponse.status !== 402) {
      return {
        response: initialResponse,
        trustChecked: false,
        paid: false,
      };
    }

    // Step 2: Parse payment requirements from 402 response
    const requirements = await this.parsePaymentRequirements(initialResponse);
    if (!requirements) {
      return {
        response: initialResponse,
        trustChecked: false,
        paid: false,
      };
    }

    // Step 3: Price safety check
    const priceUsd = parseFloat(requirements.price.replace("$", ""));
    if (priceUsd > this.config.maxPriceUsd) {
      throw new X402PriceError(url, priceUsd, this.config.maxPriceUsd);
    }

    // Step 4: Trust-check the payment recipient
    const payTo = requirements.payTo;
    const trustResult = await this.checkTrustCached(payTo);
    const isTrusted = trustResult.score >= this.config.minScore!;

    this.config.onCheck?.(payTo, trustResult.score, trustResult.risk);

    if (!isTrusted) {
      this.config.onBlocked?.(payTo, trustResult.score, trustResult.risk);
      this.config.onSkipped?.(url, payTo, trustResult.score);

      if (!this.config.warnOnly) {
        throw new X402TrustError(url, payTo, trustResult.score, trustResult.risk, this.config.minScore!);
      }
    }

    // Step 5: Sign and pay (if walletClient available)
    if (!this.config.walletClient) {
      // No wallet → return the 402 with trust info attached
      return {
        response: initialResponse,
        trustScore: trustResult,
        trustChecked: true,
        paid: false,
      };
    }

    const paymentPayload = await this.createPayment(requirements);

    // Step 6: Retry with payment header
    const paidResponse = await fetch(url, {
      ...init,
      headers: {
        ...Object.fromEntries(new Headers(init?.headers).entries()),
        [this.config.paymentHeader]: paymentPayload,
      },
    });

    this.config.onPayment?.(url, requirements.price, trustResult.score);

    return {
      response: paidResponse,
      trustScore: trustResult,
      trustChecked: true,
      paid: true,
    };
  }

  /**
   * Pre-check if a payment recipient is trustworthy without making a payment.
   */
  async precheck(payTo: string): Promise<{
    trusted: boolean;
    score: number;
    risk: string;
    recommendation: string;
  }> {
    const result = await this.checkTrustCached(payTo);
    const trusted = result.score >= this.config.minScore!;

    return {
      trusted,
      score: result.score,
      risk: result.risk,
      recommendation: trusted
        ? `✅ Recipient ${payTo} is trusted (${result.score}/10). Safe to pay.`
        : `⚠️ Recipient ${payTo} has low trust (${result.score}/10, ${result.risk} risk). Payment blocked.`,
    };
  }

  /**
   * Get trust score for an address (cached).
   */
  async getTrustScore(address: string): Promise<TrustScoreResult> {
    return this.checkTrustCached(address);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async checkTrustCached(address: string): Promise<TrustScoreResult> {
    const cached = this.trustCache.get(address.toLowerCase());
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }

    const result = await this.maiat.checkTrust(address);
    this.trustCache.set(address.toLowerCase(), {
      result,
      expiresAt: Date.now() + this.config.cacheTtlMs,
    });
    return result;
  }

  private async parsePaymentRequirements(response: Response): Promise<PaymentRequirement | null> {
    try {
      const body = await response.json();
      // x402 standard: { accepts: PaymentRequirement | PaymentRequirement[] }
      if (body.accepts) {
        const accepts = Array.isArray(body.accepts) ? body.accepts[0] : body.accepts;
        return accepts as PaymentRequirement;
      }
      return null;
    } catch {
      return null;
    }
  }

  private async createPayment(requirements: PaymentRequirement): Promise<string> {
    // This is a simplified payment creation.
    // In production, this would use @x402/evm to create a proper signed payment.
    // For now, we create the payment envelope that the facilitator expects.

    const payment = {
      x402Version: 1,
      scheme: requirements.scheme,
      network: requirements.network,
      payload: {
        payTo: requirements.payTo,
        price: requirements.price,
        timestamp: Date.now(),
      },
    };

    return btoa(JSON.stringify(payment));
  }
}

// ═══════════════════════════════════════════
//  Error Classes
// ═══════════════════════════════════════════

export class X402TrustError extends Error {
  constructor(
    public url: string,
    public payTo: string,
    public score: number,
    public risk: string,
    public minScore: number,
  ) {
    super(
      `x402 payment blocked: recipient ${payTo} has trust score ${score}/10 (${risk} risk), ` +
      `minimum required: ${minScore}. URL: ${url}`
    );
    this.name = "X402TrustError";
  }
}

export class X402PriceError extends Error {
  constructor(
    public url: string,
    public price: number,
    public maxPrice: number,
  ) {
    super(
      `x402 payment blocked: price $${price} exceeds safety cap $${maxPrice}. URL: ${url}`
    );
    this.name = "X402PriceError";
  }
}

// ═══════════════════════════════════════════
//  AgentKit Actions (for use with Coinbase AgentKit)
// ═══════════════════════════════════════════

/**
 * AgentKit-compatible actions for trust-gated x402 payments.
 * Adds these tools to any AgentKit-powered agent:
 * - x402_trust_pay: Make a trust-gated x402 payment
 * - x402_precheck: Pre-check a payment recipient's trust
 * - x402_price_check: Check price and trust before committing
 */
export function x402TrustActions(config: X402TrustConfig = {}) {
  const client = new TrustGatedX402Client(config);

  return [
    {
      name: "x402_trust_pay",
      description:
        "Make a trust-gated x402 payment to an API endpoint. Automatically checks the recipient's " +
        "trust score before paying. Blocks payments to untrusted recipients.",
      schema: {
        type: "object" as const,
        properties: {
          url: { type: "string", description: "The x402-enabled API endpoint URL" },
          method: { type: "string", description: "HTTP method (GET, POST). Default: GET" },
          body: { type: "string", description: "Request body (for POST requests)" },
        },
        required: ["url"],
      },
      handler: async (params: { url: string; method?: string; body?: string }) => {
        const result = await client.fetch(params.url, {
          method: params.method || "GET",
          body: params.body,
        });

        const responseBody = await result.response.text();

        return {
          status: result.response.status,
          paid: result.paid,
          trustChecked: result.trustChecked,
          trustScore: result.trustScore?.score ?? null,
          trustRisk: result.trustScore?.risk ?? null,
          body: responseBody,
          message: result.paid
            ? `✅ Paid and received response (trust: ${result.trustScore?.score}/10)`
            : result.trustChecked
              ? `⚠️ Payment blocked — recipient trust too low (${result.trustScore?.score}/10)`
              : `ℹ️ No payment required (HTTP ${result.response.status})`,
        };
      },
    },
    {
      name: "x402_precheck",
      description:
        "Pre-check if an x402 payment recipient is trustworthy before committing to a payment. " +
        "Use this to evaluate whether it's safe to interact with a paid API.",
      schema: {
        type: "object" as const,
        properties: {
          address: { type: "string", description: "Payment recipient address (0x...)" },
        },
        required: ["address"],
      },
      handler: async (params: { address: string }) => {
        return client.precheck(params.address);
      },
    },
    {
      name: "x402_price_check",
      description:
        "Probe an x402 endpoint to discover its price and payment requirements without paying. " +
        "Also checks the recipient's trust score.",
      schema: {
        type: "object" as const,
        properties: {
          url: { type: "string", description: "The x402-enabled API endpoint URL" },
        },
        required: ["url"],
      },
      handler: async (params: { url: string }) => {
        // Make a probe request (will get 402)
        const probeResponse = await fetch(params.url);

        if (probeResponse.status !== 402) {
          return {
            requiresPayment: false,
            status: probeResponse.status,
            message: "This endpoint does not require x402 payment.",
          };
        }

        try {
          const body = await probeResponse.json();
          const accepts = Array.isArray(body.accepts) ? body.accepts[0] : body.accepts;

          if (!accepts) {
            return {
              requiresPayment: true,
              parseable: false,
              message: "Endpoint requires payment but requirements could not be parsed.",
            };
          }

          // Trust check the recipient
          const trustResult = await client.getTrustScore(accepts.payTo);

          return {
            requiresPayment: true,
            price: accepts.price,
            payTo: accepts.payTo,
            network: accepts.network,
            scheme: accepts.scheme,
            description: accepts.description || null,
            trustScore: trustResult.score,
            trustRisk: trustResult.risk,
            safe: trustResult.score >= (config.minScore ?? 3.0),
            message: trustResult.score >= (config.minScore ?? 3.0)
              ? `✅ ${accepts.price} to trusted recipient (${trustResult.score}/10). Safe to proceed.`
              : `⚠️ ${accepts.price} to untrusted recipient (${trustResult.score}/10, ${trustResult.risk}). Not recommended.`,
          };
        } catch {
          return {
            requiresPayment: true,
            parseable: false,
            message: "Endpoint requires payment but requirements could not be parsed.",
          };
        }
      },
    },
  ];
}

// ═══════════════════════════════════════════
//  Convenience Exports
// ═══════════════════════════════════════════

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
export function x402TrustPlugin(config: X402TrustConfig = {}) {
  return {
    name: "maiat-x402-trust",
    version: "0.1.0",
    actions: x402TrustActions(config),
    client: new TrustGatedX402Client(config),
  };
}

/**
 * Create a standalone trust-gated x402 client (no AgentKit dependency).
 */
export function createTrustGatedClient(config: X402TrustConfig = {}): TrustGatedX402Client {
  return new TrustGatedX402Client(config);
}

export { MaiatClient } from "@maiat/agentkit-plugin";
export default x402TrustPlugin;
