import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getQuote, getSwap } from "@/lib/uniswap";
import { computeTrustScore } from "@/lib/scoring";
import { createRateLimiter, checkIpRateLimit } from "@/lib/ratelimit";
import { logQuery } from "@/lib/query-logger";
import { Attribution } from "ox/erc8021";

// Base Builder Code — bc_cozhkj23 (registered at base.dev)
// Appended to every trust_swap calldata for Base attribution + rewards
const BASE_DATA_SUFFIX = Attribution.toDataSuffix({ codes: ["bc_cozhkj23"] });

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

    // Get swap calldata (unsigned tx) — safe, no on-chain side effects
    let swapCalldata: string | null = null;
    let swapTo: string | null = null;
    let swapValue: string | null = null;
    const isRealSwapper =
      swapper !== "0x0000000000000000000000000000000000000000";
    if (isRealSwapper) {
      try {
        const swapResult = await getSwap(quote);
        const rawCalldata = swapResult.swap?.data ?? null;
        // Append Base Builder Code attribution suffix (ERC-8021, zero gas overhead)
        swapCalldata = rawCalldata
          ? rawCalldata + BASE_DATA_SUFFIX.slice(2)
          : null;
        swapTo = swapResult.swap?.to ?? null;
        swapValue = swapResult.swap?.value ?? null;
      } catch (swapErr) {
        console.error("[swap/quote] getSwap failed:", swapErr instanceof Error ? swapErr.message : swapErr);
        // calldata unavailable — quote-only mode
      }
    }

    // Log trust_swap query (fire-and-forget) — generate jobId for outcome tracking
    const jobId = randomUUID();
    const innerQuote = ((quote as unknown) as Record<string, unknown>)?.quote as Record<string, unknown> | undefined;
    const amountOut = String(innerQuote?.output && typeof innerQuote.output === "object"
      ? (innerQuote.output as Record<string, unknown>).amount ?? ""
      : "");
    const _callerIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || undefined;
    const _userAgent = request.headers.get("user-agent") || undefined;
    const _clientId = request.headers.get("x-maiat-client") ?? undefined;
    logQuery({
      type: "trust_swap",
      target: tokenOut,
      buyer: swapper !== "0x0000000000000000000000000000000000000000" ? swapper : undefined,
      jobId,
      trustScore: tokenOutScore ? Math.round(tokenOutScore.score * 10) : null,
      verdict: tokenOutScore ? (tokenOutScore.score >= 7 ? "proceed" : tokenOutScore.score >= 4 ? "caution" : "avoid") : null,
      amountIn: amount,
      amountOut: amountOut || undefined,
      clientId: _clientId,
      callerIp: _callerIp,
      userAgent: _userAgent,
      metadata: { tokenIn, calldataGenerated: !!swapCalldata },
    });

    return NextResponse.json(
      {
        jobId,
        quote,
        calldata: swapCalldata,
        to: swapTo,
        value: swapValue,
        trust: {
          tokenIn: tokenInScore
            ? { score: Math.round(tokenInScore.score * 10), risk: tokenInScore.risk }
            : null,
          tokenOut: tokenOutScore
            ? { score: Math.round(tokenOutScore.score * 10), risk: tokenOutScore.risk }
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
