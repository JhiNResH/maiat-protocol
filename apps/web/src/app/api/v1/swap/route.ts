import { NextRequest, NextResponse } from "next/server";
import { getSwap, type QuoteResponse } from "@/lib/uniswap";
import { apiLog } from "@/lib/logger";
import { createRateLimiter, checkIpRateLimit } from "@/lib/ratelimit";

const rateLimiter = createRateLimiter("swap:execute", 10, 60);

// --- CORS helpers ---
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
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

export async function POST(request: NextRequest) {
  const { success: rateLimitOk } = await checkIpRateLimit(request, rateLimiter);
  if (!rateLimitOk) {
    return NextResponse.json(
      { error: "Too many requests. Retry after 1 minute." },
      { status: 429, headers: CORS_HEADERS }
    );
  }

  try {
    const body: unknown = await request.json();

    if (!isValidQuoteResponse(body)) {
      return NextResponse.json(
        { error: "Invalid quote response body. Must include quoteId, tokenIn, tokenOut, amountIn, swapper, chainId." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const swap = await getSwap(body);

    return NextResponse.json(
      {
        ...swap,
        timestamp: new Date().toISOString(),
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Swap failed";
    apiLog.error('swap', err);
    return NextResponse.json(
      { error: message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
