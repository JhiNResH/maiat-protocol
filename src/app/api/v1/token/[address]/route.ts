import { NextRequest, NextResponse } from "next/server";
import { computeTrustScore } from "@/lib/scoring";
import { analyzeToken } from "@/lib/token-analysis";

// --- Rate limiter ---
const ipHits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

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
    // Run trust score and token analysis in parallel
    const [trustResult, tokenResult] = await Promise.all([
      computeTrustScore(address),
      analyzeToken(address),
    ]);

    if (!tokenResult) {
      return NextResponse.json(
        {
          address,
          isToken: false,
          score: trustResult.score,
          risk: trustResult.risk,
          type: trustResult.type,
          message: "Address is not a recognized ERC-20 token",
          timestamp: new Date().toISOString(),
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      {
        address,
        isToken: true,
        name: tokenResult.name,
        symbol: tokenResult.symbol,
        decimals: tokenResult.decimals,
        totalSupply: tokenResult.totalSupply,
        score: trustResult.score,
        risk: trustResult.risk,
        type: "TOKEN",
        flags: trustResult.flags,
        breakdown: trustResult.breakdown,
        ...(trustResult.protocol && { protocol: trustResult.protocol }),
        safetyChecks: tokenResult.safetyChecks,
        topHolders: tokenResult.topHolders,
        market: {
          tvl: tokenResult.tvl,
          volume24h: tokenResult.volume24h,
          marketCap: tokenResult.marketCap,
          trend7d: tokenResult.trend7d,
        },
        details: trustResult.details,
        timestamp: new Date().toISOString(),
        oracle: "maiat-trust-v1",
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";

    if (message.includes("Invalid Ethereum address")) {
      return NextResponse.json(
        { error: message },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    console.error("[token/[address]]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
