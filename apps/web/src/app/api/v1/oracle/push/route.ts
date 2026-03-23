/**
 * POST /api/v1/oracle/push
 *
 * Immediate oracle score push — used by:
 * 1. Wadjet Sentinel alerts (rug detected → push low score immediately)
 * 2. Manual seed for demo (pre-populate Oracle with test tokens)
 * 3. Any event-driven score update that can't wait for the 6h cron
 *
 * Auth: CRON_SECRET or MAIAT_INTERNAL_TOKEN
 */

import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { pushSingleScore } from "@/lib/oracle-updater";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // Vercel Pro plan

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Internal-Token",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const internalToken = request.headers.get("x-internal-token");
  const cronSecret = process.env.CRON_SECRET;
  const internalSecret = process.env.MAIAT_INTERNAL_TOKEN;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  if (internalSecret && internalToken === internalSecret) return true;
  // Also accept Wadjet's cron key
  const wadjetKey = request.headers.get("x-cron-api-key");
  if (cronSecret && wadjetKey === cronSecret) return true;

  return false;
}

interface PushBody {
  tokenAddress: string;
  score: number;
  reviewCount?: number;
  avgRating?: number;
  dataSource?: "API" | "COMMUNITY" | "VERIFIED" | "SEED";
  reason?: string;
}

interface BatchPushBody {
  tokens: PushBody[];
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }

  try {
    const body = await request.json();

    // Support both single and batch push
    const tokens: PushBody[] = body.tokens
      ? (body as BatchPushBody).tokens
      : [body as PushBody];

    if (tokens.length === 0) {
      return NextResponse.json({ error: "No tokens provided" }, { status: 400, headers: CORS_HEADERS });
    }

    if (tokens.length > 20) {
      return NextResponse.json({ error: "Max 20 tokens per request" }, { status: 400, headers: CORS_HEADERS });
    }

    const results: Array<{ token: string; score: number; result: unknown }> = [];

    for (const t of tokens) {
      if (!t.tokenAddress || !isAddress(t.tokenAddress)) {
        results.push({ token: t.tokenAddress, score: t.score, result: { error: "Invalid address" } });
        continue;
      }
      if (typeof t.score !== "number" || t.score < 0 || t.score > 100) {
        results.push({ token: t.tokenAddress, score: t.score, result: { error: "Score must be 0-100" } });
        continue;
      }

      const result = await pushSingleScore(
        t.tokenAddress,
        t.score,
        t.reviewCount ?? 0,
        t.avgRating ?? 0,
        t.dataSource ?? "API",
      );

      results.push({ token: t.tokenAddress, score: t.score, result });
    }

    const succeeded = results.filter((r) => "txHash" in (r.result as Record<string, unknown>));
    const failed = results.filter((r) => "error" in (r.result as Record<string, unknown>));

    return NextResponse.json(
      {
        pushed: succeeded.length,
        failed: failed.length,
        results,
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("[oracle/push]", err);
    return NextResponse.json(
      { error: "Push failed" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
