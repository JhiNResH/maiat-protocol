/**
 * x402 Payment Gate — Manual Implementation
 *
 * Instead of using @x402/next's withX402 (which eagerly fetches from facilitator
 * at module init and crashes Vercel builds), we manually construct the 402 response
 * and delegate payment verification to the facilitator at request time only.
 *
 * Flow:
 * 1. Request comes in without PAYMENT-SIGNATURE header → return 402 + payment instructions
 * 2. Request has PAYMENT-SIGNATURE → verify with facilitator → if valid, run handler
 */

import { NextRequest, NextResponse } from "next/server";

const PAY_TO = "0xB1e504aE1ce359B4C2a6DC5d63aE6199a415f312";
const NETWORK = process.env.X402_NETWORK || "eip155:8453";
const FACILITATOR_URL =
  process.env.X402_FACILITATOR_URL || "https://x402.org/facilitator";

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
 */
function buildPaymentRequired(priceUsd: string, description: string, bazaar?: BazaarMetadata): string {
  // Convert "$0.02" to micro-units (USDC has 6 decimals)
  const dollars = parseFloat(priceUsd.replace("$", ""));
  const microUnits = Math.round(dollars * 1_000_000).toString();

  // Build bazaar extension if provided
  const extensions: Record<string, unknown> = {};
  if (bazaar) {
    extensions.bazaar = {
      info: {
        input: {
          type: "http",
          queryParams: bazaar.input?.queryParams || {},
        },
        output: {
          type: "json",
          ...(bazaar.output?.example && { example: bazaar.output.example }),
        },
      },
      ...(bazaar.output?.schema && {
        schema: {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          type: "object",
          properties: {
            output: {
              type: "object",
              properties: {
                example: bazaar.output.schema,
              },
            },
          },
        },
      }),
    };
  }

  const paymentRequirements = {
    x402Version: 2,
    accepts: [
      {
        scheme: "exact",
        network: NETWORK,
        maxAmountRequired: microUnits,
        resource: PAY_TO,
        description,
        mimeType: "application/json",
        payTo: PAY_TO,
        maxTimeoutSeconds: 300,
        asset: USDC_ADDRESSES[NETWORK] || USDC_ADDRESSES["eip155:8453"],
        extra: {},
        ...(Object.keys(extensions).length > 0 && { extensions }),
      },
    ],
  };

  return Buffer.from(JSON.stringify(paymentRequirements)).toString("base64");
}

/**
 * Verify payment with facilitator
 */
async function verifyPayment(
  paymentSignature: string,
  paymentRequired: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(`${FACILITATOR_URL}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      return { valid: false, error: `Facilitator returned ${res.status}: ${body}` };
    }

    const data = await res.json();
    return { valid: data.valid === true || data.isValid === true };
  } catch (e: any) {
    return { valid: false, error: e.message };
  }
}

/**
 * Settle payment after successful handler execution
 */
async function settlePayment(paymentSignature: string): Promise<void> {
  try {
    await fetch(`${FACILITATOR_URL}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentSignature }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    console.error("[x402-gate] Settlement failed:", e);
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
 */
export function withPaymentGate(
  handler: RouteHandler,
  priceUsd: string,
  description: string,
  queryType?: QueryType,
  bazaar?: BazaarMetadata
): RouteHandler {
  const paymentRequiredHeader = buildPaymentRequired(priceUsd, description, bazaar);

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
