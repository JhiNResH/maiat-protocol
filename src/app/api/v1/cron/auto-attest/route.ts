/**
 * GET /api/v1/cron/auto-attest
 * Vercel Cron Job — runs daily at 03:00 UTC
 * Protected by CRON_SECRET header
 *
 * Queries recent query_logs (last 24h) for trust_swap type,
 * then fires attestTrustScore() for each unique buyer-target pair.
 */

import { NextRequest, NextResponse } from "next/server";
import { attestTrustScore, EAS_TRUST_SCORE_SCHEMA_UID } from "@/lib/eas";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  // Verify cron secret (mandatory)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  if (!EAS_TRUST_SCORE_SCHEMA_UID) {
    return NextResponse.json(
      { error: "EAS_TRUST_SCORE_SCHEMA_UID not configured" },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  try {
    const { prisma } = await import("@/lib/prisma");

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Attest ALL ACP interactions — every query becomes a Maiat Receipt
    const logs = await prisma.queryLog.findMany({
      where: {
        type: { in: ["trust_swap", "token_check", "agent_trust", "agent_deep_check"] },
        createdAt: { gte: since },
        buyer: { not: null },
      },
      select: {
        buyer: true,
        target: true,
        trustScore: true,
        verdict: true,
      },
    });

    // Deduplicate by buyer-target pair
    const seen = new Set<string>();
    const pairs: { buyer: string; target: string; score: number; verdict: string }[] = [];

    for (const log of logs) {
      if (!log.buyer || !log.target) continue;
      const key = `${log.buyer.toLowerCase()}-${log.target.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({
        buyer: log.buyer,
        target: log.target,
        score: log.trustScore ?? 50,
        verdict: log.verdict ?? "unknown",
      });
    }

    // Fire-and-forget attestations
    let attempted = 0;
    for (const pair of pairs) {
      try {
        attestTrustScore(pair.target, pair.score, pair.verdict).catch((err) => {
          console.warn(`[auto-attest] attestTrustScore failed for ${pair.target}:`, err.message);
        });
        attempted++;
      } catch (err: any) {
        console.warn(`[auto-attest] failed to queue attestation for ${pair.target}:`, err.message);
      }
    }

    return NextResponse.json(
      {
        success: true,
        logsFound: logs.length,
        uniquePairs: pairs.length,
        attestationsAttempted: attempted,
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error("[auto-attest] cron error:", err);
    return NextResponse.json(
      { error: "Internal error", detail: err.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
