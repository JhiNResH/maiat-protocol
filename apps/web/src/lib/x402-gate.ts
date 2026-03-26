/**
 * x402 Payment Gate — Manual Implementation with CDP Facilitator
 *
 * Uses CDP facilitator (api.cdp.coinbase.com) for production payment
 * verification on Base mainnet. Auth via @coinbase/x402 JWT signing.
 *
 * Flow:
 * 1. Request comes in without PAYMENT-SIGNATURE header → return 402 + payment instructions
 * 2. Request has PAYMENT-SIGNATURE → verify with CDP facilitator → if valid, run handler
 */

import { NextRequest, NextResponse } from "next/server";
import { createAuthHeader, createCorrelationHeader } from "@coinbase/x402";

const PAY_TO = "0xB1e504aE1ce359B4C2a6DC5d63aE6199a415f312";
const NETWORK = process.env.X402_NETWORK || "eip155:8453";

// CDP Facilitator (production — supports Base mainnet)
const FACILITATOR_BASE_URL = "https://api.cdp.coinbase.com";
const FACILITATOR_PATH = "/platform/v2/x402";
const CDP_API_KEY_ID = process.env.CDP_API_KEY_ID || "";
const CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET || "";

/**
 * Get CDP auth headers for facilitator requests
 */
async function getCdpAuthHeaders(path: string): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Correlation-Context": createCorrelationHeader(),
  };
  if (CDP_API_KEY_ID && CDP_API_KEY_SECRET) {
    headers["Authorization"] = await createAuthHeader(
      CDP_API_KEY_ID,
      CDP_API_KEY_SECRET,
      "POST",
      FACILITATOR_BASE_URL.replace("https://", ""),
      path,
    );
  }
  return headers;
}

// USDC contract addresses
const USDC_ADDRESSES: Record<string, string> = {
  "eip155:8453": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base mainnet
  "eip155:84532": "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia
};

export const X402_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, X-Payment, X-Payment-Response, Payment-Signature, Payment-Required",
  "x-powered-by": "maiat-x402",
  "x-payment-protocol": "x402",
} as const;

/**
 * Build PAYMENT-REQUIRED header value (base64-encoded JSON)
 *
 * Must satisfy BOTH:
 * - x402scan (@agentcash/discovery) validation: needs `resource` as URL, `extra.name/version`, `outputSchema` with `discoverable:true`
 * - CDP Bazaar: needs `extensions.bazaar` with info + schema
 */
function buildPaymentRequired(priceUsd: string, description: string, resourceUrl: string, bazaar?: BazaarMetadata): string {
  // Convert "$0.02" to micro-units (USDC has 6 decimals)
  const dollars = parseFloat(priceUsd.replace("$", ""));
  const microUnits = Math.round(dollars * 1_000_000).toString();

  // Build v1-compatible outputSchema for x402scan discovery
  const outputSchema: Record<string, unknown> = {};
  if (bazaar) {
    const inputSpec: Record<string, unknown> = {
      discoverable: true,
      type: "http",
    };
    if (bazaar.input?.queryParams) {
      inputSpec.method = "GET";
      inputSpec.queryParams = bazaar.input.queryParams;
    } else {
      inputSpec.method = "POST";
      if (bazaar.input && "bodyFields" in bazaar.input) {
        inputSpec.bodyFields = (bazaar.input as Record<string, unknown>).bodyFields;
        inputSpec.bodyType = "json";
      }
    }
    outputSchema.input = inputSpec;
    if (bazaar.output?.example) {
      outputSchema.output = bazaar.output.example;
    }
  }

  // Build v2 bazaar extension (schema only — no redundant "info" block)
  const extensions: Record<string, unknown> = {};
  if (bazaar) {
    extensions.bazaar = {
      schema: {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        properties: {
          // validator reads: schema.properties.input.properties.queryParams OR .body
          input: {
            type: "object",
            properties: bazaar.input?.queryParams
              ? { queryParams: { type: "object", properties: Object.fromEntries(
                    Object.entries(bazaar.input.queryParams).map(([k, v]) => [k, v])
                  )}}
              : bazaar.input && "bodyFields" in bazaar.input
                ? { body: { type: "object", properties: (bazaar.input as Record<string, unknown>).bodyFields }}
                : {},
          },
          // validator reads: schema.properties.output.properties.example
          output: {
            type: "object",
            properties: {
              example: bazaar.output?.example ?? {},
            },
          },
        },
      },
    };
  }

  const paymentRequirements = {
    x402Version: 2,
    // Capminal requires "error" field at top level
    error: "Payment Required",
    // resource and extensions at top level (Capminal parser reads x402Data.resource, x402Data.extensions)
    resource: {
      url: resourceUrl,
      description,
    },
    // v1 outputSchema at top level for x402scan
    ...(Object.keys(outputSchema).length > 0 && { outputSchema }),
    // extensions at top level for Capminal
    ...(Object.keys(extensions).length > 0 && { extensions }),
    accepts: [
      {
        scheme: "exact",
        network: NETWORK,
        asset: USDC_ADDRESSES[NETWORK] || USDC_ADDRESSES["eip155:8453"],
        // v2 uses "amount" (not "maxAmountRequired")
        amount: microUnits,
        payTo: PAY_TO,
        maxTimeoutSeconds: 300,
        extra: { name: "USD Coin", version: "2" },
      },
    ],
  };

  return Buffer.from(JSON.stringify(paymentRequirements)).toString("base64");
}

/**
 * Verify payment with CDP facilitator
 */
async function verifyPayment(
  paymentSignature: string,
  paymentRequired: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const verifyPath = `${FACILITATOR_PATH}/verify`;
    const headers = await getCdpAuthHeaders(verifyPath);
    const res = await fetch(`${FACILITATOR_BASE_URL}${verifyPath}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        paymentSignature,
        paymentRequirements: JSON.parse(
          Buffer.from(paymentRequired, "base64").toString()
        ),
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const body = await res.text();
      return { valid: false, error: `CDP facilitator returned ${res.status}: ${body}` };
    }

    const data = await res.json();
    return { valid: data.valid === true || data.isValid === true };
  } catch (e: any) {
    return { valid: false, error: e.message };
  }
}

/**
 * Settle payment with CDP facilitator after successful handler execution
 */
async function settlePayment(paymentSignature: string): Promise<void> {
  try {
    const settlePath = `${FACILITATOR_PATH}/settle`;
    const headers = await getCdpAuthHeaders(settlePath);
    await fetch(`${FACILITATOR_BASE_URL}${settlePath}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ paymentSignature }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    console.error("[x402-gate] CDP settlement failed:", e);
  }
}

type RouteHandler = (request: NextRequest) => Promise<NextResponse<unknown>>;

type QueryType = "agent_trust" | "agent_deep_check" | "token_check" | "trust_swap" | "token_forensics" | "passport_register";

interface BazaarMetadata {
  output?: {
    example?: Record<string, unknown>;
    schema?: Record<string, unknown>;
  };
  input?: {
    queryParams?: Record<string, { type: string; description?: string }>;
  };
}

/**
 * Wrap a route handler with x402 payment gate.
 * This is a lazy wrapper — no SDK initialization at import time.
 *
 * @param endpointPath - The URL path (e.g. "/api/x402/trust") used as `resource` in 402 response
 */
export function withPaymentGate(
  handler: RouteHandler,
  priceUsd: string,
  description: string,
  queryType?: QueryType,
  bazaar?: BazaarMetadata,
  endpointPath?: string
): RouteHandler {
  const resourceUrl = endpointPath
    ? `https://app.maiat.io${endpointPath}`
    : PAY_TO; // fallback to wallet address
  const paymentRequiredHeader = buildPaymentRequired(priceUsd, description, resourceUrl, bazaar);

  return async (request: NextRequest): Promise<NextResponse<unknown>> => {
    // Check for payment signature
    const paymentSig =
      request.headers.get("payment-signature") ||
      request.headers.get("x-payment");

    if (!paymentSig) {
      // No payment — return 402 with payment instructions
      // Body includes decoded payment requirements for compatibility with health checkers (402index)
      const paymentRequirementsJson = JSON.parse(
        Buffer.from(paymentRequiredHeader, "base64").toString()
      );
      return NextResponse.json(paymentRequirementsJson, {
        status: 402,
        headers: {
          ...X402_CORS_HEADERS,
          "Payment-Required": paymentRequiredHeader,
        },
      });
    }

    // Verify payment with facilitator
    const verification = await verifyPayment(paymentSig, paymentRequiredHeader);

    if (!verification.valid) {
      return NextResponse.json(
        { error: "Payment verification failed", detail: verification.error },
        { status: 402, headers: X402_CORS_HEADERS }
      );
    }

    // Payment valid — run the actual handler
    const response = await handler(request);

    // Log paid query (fire-and-forget)
    if (queryType) {
      const target = request.nextUrl.searchParams.get("address") || 
                     request.nextUrl.searchParams.get("token") || 
                     "unknown";
      import("@/lib/query-logger").then(({ logQuery }) => {
        logQuery({
          type: queryType,
          target: target.toLowerCase(),
          clientId: "x402",
          metadata: { 
            channel: "x402",
            priceUsd,
            paymentProtocol: "x402",
          },
        });
      }).catch(() => {});
    }

    // Settle payment in background (don't block response)
    settlePayment(paymentSig).catch(() => {});

    return response;
  };
}
