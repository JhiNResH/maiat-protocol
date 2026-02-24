import { NextRequest, NextResponse } from "next/server";
import { computeTrustScore } from "@/lib/scoring";

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
    const result = await computeTrustScore(address);

    return NextResponse.json(
      {
        address,
        score: result.score,
        risk: result.risk,
        type: result.type,
        flags: result.flags,
        details: result.details,
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

    console.error("[score/[address]]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
