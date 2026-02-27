import { NextRequest, NextResponse } from "next/server";
import { checkInteraction } from "@/lib/interaction-check";

// --- Simple in-memory rate limiter ---
const ipHits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60;
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

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * GET /api/v1/wallet/:address/check-interaction?target=0x...
 *
 * Checks if `address` has ever interacted with `target` on-chain (Base).
 * Used by the frontend to gate review submission before the user fills out the form.
 *
 * Returns:
 *   { hasInteracted: boolean, txCount: number, firstTxDate: string|null, lastTxDate: string|null }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  const target = request.nextUrl.searchParams.get("target");

  // Validate reviewer address
  if (!isValidAddress(address)) {
    return NextResponse.json(
      { error: "Invalid wallet address" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // Validate target address
  if (!target || !isValidAddress(target)) {
    return NextResponse.json(
      { error: "Invalid or missing target address (?target=0x...)" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // Rate limit by IP
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
    const proof = await checkInteraction(address.toLowerCase(), target.toLowerCase());

    return NextResponse.json(
      {
        wallet: address.toLowerCase(),
        target: target.toLowerCase(),
        hasInteracted: proof.hasInteracted,
        txCount: proof.txCount,
        firstTxDate: proof.firstTxDate,
        lastTxDate: proof.lastTxDate,
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("[check-interaction] Error:", err);
    // Fail open — don't block users when Alchemy is unavailable
    return NextResponse.json(
      {
        wallet: address.toLowerCase(),
        target: target.toLowerCase(),
        hasInteracted: true,   // fail open
        txCount: 0,
        firstTxDate: null,
        lastTxDate: null,
        warning: "Interaction check unavailable — proceeding with caution",
      },
      { status: 200, headers: CORS_HEADERS }
    );
  }
}
