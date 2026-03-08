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
    // Gracefully skip — schema not registered yet
    console.log("[auto-attest] Skipping: EAS_TRUST_SCORE_SCHEMA_UID not configured");
    return NextResponse.json(
      { skipped: true, reason: "EAS_TRUST_SCORE_SCHEMA_UID not configured" },
      { status: 200, headers: CORS_HEADERS }
    );
  }

  if (!process.env.EAS_DEPLOYER_KEY && !process.env.MAIAT_ADMIN_PRIVATE_KEY) {
    console.log("[auto-attest] Skipping: EAS_DEPLOYER_KEY not configured");
    return NextResponse.json(
      { skipped: true, reason: "EAS_DEPLOYER_KEY not configured" },
      { status: 200, headers: CORS_HEADERS }
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

    // Attest up to 20 per run (gas budget)
    const MAX_ATTESTATIONS = 20;
    const batch = pairs.slice(0, MAX_ATTESTATIONS);
    let attested = 0;
    let failed = 0;
    const attestedTargets: { target: string; score: number }[] = [];

    for (const pair of batch) {
      try {
        const uid = await attestTrustScore(pair.target, pair.score, pair.verdict);
        attested++;
        attestedTargets.push({ target: pair.target, score: pair.score });
        console.log(`[auto-attest] ✅ ${pair.target} score=${pair.score} uid=${uid}`);
      } catch (err: any) {
        failed++;
        console.warn(`[auto-attest] ❌ ${pair.target}: ${err.message}`);
      }
    }

    // Oracle sync: update TrustScoreOracle on-chain for attested agents
    let oracleUpdated = 0;
    if (attestedTargets.length > 0) {
      try {
        const { syncOracleScores } = await import("@/lib/oracle-sync");
        oracleUpdated = await syncOracleScores(attestedTargets);
        console.log(`[auto-attest] Oracle synced: ${oracleUpdated} agents`);
      } catch (err: any) {
        console.warn(`[auto-attest] Oracle sync failed: ${err.message}`);
      }
    }

    return NextResponse.json(
      {
        success: true,
        logsFound: logs.length,
        uniquePairs: pairs.length,
        attested,
        failed,
        skippedOverLimit: Math.max(0, pairs.length - MAX_ATTESTATIONS),
        oracleUpdated,
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
