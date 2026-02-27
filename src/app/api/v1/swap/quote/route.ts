import { NextRequest, NextResponse } from "next/server";
import { getQuote } from "@/lib/uniswap";
import { computeTrustScore } from "@/lib/scoring";
import { createRateLimiter, checkIpRateLimit } from "@/lib/ratelimit";

const rateLimiter = createRateLimiter("swap:quote", 15, 60);

// --- CORS helpers ---
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

interface QuoteBody {
  swapper: string;
  tokenIn: string;
  tokenOut: string;
  amount: string;
  chainId?: number;
  slippage?: number;
}

function isValidQuoteBody(body: unknown): body is QuoteBody {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.swapper === "string" &&
    typeof b.tokenIn === "string" &&
    typeof b.tokenOut === "string" &&
    typeof b.amount === "string" &&
    (b.chainId === undefined || typeof b.chainId === "number") &&
    (b.slippage === undefined || typeof b.slippage === "number")
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

    if (!isValidQuoteBody(body)) {
      return NextResponse.json(
        { error: "Missing required fields: swapper, tokenIn, tokenOut, amount" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const { swapper, tokenIn, tokenOut, amount, chainId, slippage } = body;

    // Get quote and trust scores in parallel
    const [quote, tokenInScore, tokenOutScore] = await Promise.all([
      getQuote(swapper, tokenIn, tokenOut, amount, chainId, slippage),
      computeTrustScore(tokenIn).catch(() => null),
      computeTrustScore(tokenOut).catch(() => null),
    ]);

    return NextResponse.json(
      {
        quote,
        trust: {
          tokenIn: tokenInScore
            ? { score: tokenInScore.score, risk: tokenInScore.risk }
            : null,
          tokenOut: tokenOutScore
            ? { score: tokenOutScore.score, risk: tokenOutScore.risk }
            : null,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Quote failed";
    console.error("[swap/quote]", err);
    return NextResponse.json(
      { error: message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
