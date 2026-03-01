import { NextRequest, NextResponse } from "next/server";
import { getQuote, getSwap } from "@/lib/uniswap";
import { computeTrustScore } from "@/lib/scoring";

// --- Simple in-memory IP rate limiter ---
const ipHits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 15;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipHits.get(ip);

  if (!entry || entry.resetAt < now) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }

  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  return false;
}

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
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (isRateLimited(ip)) {
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

    // Get swap calldata (unsigned tx) — safe, no on-chain side effects
    let swapCalldata: string | null = null;
    let swapTo: string | null = null;
    let swapValue: string | null = null;
    const isRealSwapper =
      swapper !== "0x0000000000000000000000000000000000000000";
    if (isRealSwapper) {
      try {
        const swapResult = await getSwap(quote);
        swapCalldata = swapResult.swap?.data ?? null;
        swapTo = swapResult.swap?.to ?? null;
        swapValue = swapResult.swap?.value ?? null;
      } catch {
        // calldata unavailable — quote-only mode
      }
    }

    return NextResponse.json(
      {
        quote,
        calldata: swapCalldata,
        to: swapTo,
        value: swapValue,
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
