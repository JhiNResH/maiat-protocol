/**
 * POST /api/x402/trust-swap
 *
 * x402 Payment-Protected Trust-Gated Swap Endpoint
 * Price: $0.05 per request
 *
 * Execute a Uniswap swap using a quote response.
 * No rate limiting (x402 payment IS the rate limit).
 */

import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { getSwap, type QuoteResponse } from "@/lib/uniswap";
import { apiLog } from "@/lib/logger";
import {
  x402Server,
  X402_PRICES,
  createRouteConfig,
  X402_CORS_HEADERS,
} from "@/lib/x402-server";

export const dynamic = "force-dynamic";

// OPTIONS handler for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: X402_CORS_HEADERS });
}

function isValidQuoteResponse(body: unknown): body is QuoteResponse {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.quoteId === "string" &&
    typeof b.tokenIn === "string" &&
    typeof b.tokenOut === "string" &&
    typeof b.amountIn === "string" &&
    typeof b.swapper === "string" &&
    typeof b.chainId === "number"
  );
}

// Core handler logic
async function trustSwapHandler(request: NextRequest): Promise<NextResponse<unknown>> {
  try {
    const body: unknown = await request.json();

    if (!isValidQuoteResponse(body)) {
      return NextResponse.json(
        {
          error:
            "Invalid quote response body. Must include quoteId, tokenIn, tokenOut, amountIn, swapper, chainId.",
        },
        { status: 400, headers: X402_CORS_HEADERS }
      );
    }

    const swap = await getSwap(body);

    return NextResponse.json(
      {
        ...swap,
        timestamp: new Date().toISOString(),
      },
      { status: 200, headers: X402_CORS_HEADERS }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Swap failed";
    apiLog.error("swap", err);
    return NextResponse.json(
      { error: message },
      { status: 500, headers: X402_CORS_HEADERS }
    );
  }
}

// Wrap with x402 payment protection
export const POST = withX402(
  trustSwapHandler,
  createRouteConfig(X402_PRICES.trustSwap, "Trust-gated Uniswap swap execution"),
  x402Server
);
