import { NextRequest, NextResponse } from "next/server";
import { computeTrustScore, type SupportedChain } from "@/lib/scoring";
import { generateSummary } from "@/lib/ai-summary";
import { apiLog } from "@/lib/logger";

const SUPPORTED_CHAINS: SupportedChain[] = ["base", "eth", "bnb"];

// --- Simple in-memory IP rate limiter ---
const ipHits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;        // requests
const RATE_WINDOW_MS = 60_000; // per 1 minute

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

  // Rate limit
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
    // Parse ?chain= (default: base)
    const chainParam = request.nextUrl.searchParams.get("chain")?.toLowerCase() as SupportedChain | null;
    const chain: SupportedChain = chainParam && SUPPORTED_CHAINS.includes(chainParam) ? chainParam : "base";

    const result = await computeTrustScore(address, chain);

    // Optional AI summary
    const wantSummary = request.nextUrl.searchParams.get("summary") === "true";
    let summary: string | null = null;
    if (wantSummary) {
      summary = await generateSummary({
        address,
        score: result.score,
        risk: result.risk,
        type: result.type,
        flags: result.flags,
        protocolName: result.protocol?.name,
        txCount: result.details.txCount,
        balanceETH: result.details.balanceETH,
        walletAge: result.details.walletAge,
      });
    }

    return NextResponse.json(
      {
        address,
        chain: result.chain,
        score: result.score,
        risk: result.risk,
        type: result.type,
        flags: result.flags,
        breakdown: result.breakdown,
        ...(result.protocol && { protocol: result.protocol }),
        details: result.details,
        ...(summary && { summary }),
        timestamp: new Date().toISOString(),
        oracle: "maiat-trust-v1",
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scoring failed";

    if (message.includes("Invalid Ethereum address")) {
      return NextResponse.json(
        { error: message },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    apiLog.error('score', err, { address });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
