/**
 * GET /api/v1/cron/write-intuition-triples
 *
 * Vercel Cron Job — runs daily at 05:00 UTC
 * Writes Maiat trust scores to Intuition knowledge graph as Triples.
 *
 * Picks top 50 agents (score ≥ 60) per run to stay within gas/time budget.
 * Stores tripleId back into AgentScore for deduplication next run.
 *
 * Required env vars:
 *   CRON_SECRET            — Authorization header bearer token
 *   INTUITION_PRIVATE_KEY  — Treasury wallet private key (hex)
 *   INTUITION_NETWORK      — "testnet" | "mainnet" (default: "testnet")
 *
 * Optional query params:
 *   ?dryRun=true           — Simulate without writing to chain
 *   ?limit=N               — Override batch size (max 100)
 *   ?minScore=N            — Override minimum trust score (default: 60)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { batchWriteTrustTriples } from "@/lib/intuition-triple-writer";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min — batch of 50 agents

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }

  const { searchParams } = request.nextUrl;
  const dryRun = searchParams.get("dryRun") === "true";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
  const minScore = parseInt(searchParams.get("minScore") ?? "60", 10);

  try {
    // ── Fetch agents that haven't been written to Intuition yet ────────────────
    // We use a JSON field in rawMetrics to track intuitionTripleId
    // to avoid adding a new DB column right now.
    const agents = await prisma.agentScore.findMany({
      where: {
        trustScore: { gte: minScore },
        // Skip agents whose rawMetrics already has intuitionTripleId set
        NOT: {
          rawMetrics: {
            path: ["intuitionTripleId"],
            not: null,
          },
        },
      },
      orderBy: { trustScore: "desc" },
      take: limit,
      select: {
        walletAddress: true,
        trustScore: true,
        rawMetrics: true,
      },
    });

    if (agents.length === 0) {
      return NextResponse.json(
        {
          success: true,
          message: "No eligible agents to process",
          processed: 0,
          dryRun,
          timestamp: new Date().toISOString(),
        },
        { headers: CORS_HEADERS }
      );
    }

    // ── Write triples ──────────────────────────────────────────────────────────
    const batchResult = await batchWriteTrustTriples(
      agents.map((a) => ({ walletAddress: a.walletAddress, trustScore: a.trustScore })),
      { dryRun }
    );

    // ── Persist tripleId back into rawMetrics ──────────────────────────────────
    if (!dryRun) {
      const updatePromises = batchResult.results
        .filter((r) => r.status === "created" && r.tripleId)
        .map((r) => {
          const agent = agents.find((a) => a.walletAddress === r.walletAddress);
          const existingMetrics = (agent?.rawMetrics as Record<string, unknown>) ?? {};
          return prisma.agentScore.update({
            where: { walletAddress: r.walletAddress },
            data: {
              rawMetrics: {
                ...existingMetrics,
                intuitionTripleId: r.tripleId,
                intuitionWrittenAt: new Date().toISOString(),
                intuitionNetwork: process.env.INTUITION_NETWORK ?? "testnet",
              },
            },
          });
        });

      // Fire-and-forget DB updates — don't block the response
      Promise.allSettled(updatePromises).catch((err) => {
        console.error("[write-intuition-triples] DB update error:", err);
      });
    }

    return NextResponse.json(
      {
        success: true,
        dryRun,
        network: batchResult.network,
        processed: batchResult.total,
        created: batchResult.created,
        existing: batchResult.existing,
        failed: batchResult.failed,
        durationMs: batchResult.durationMs,
        failedAgents: batchResult.results
          .filter((r) => r.status === "failed")
          .map((r) => ({ address: r.walletAddress, error: r.error })),
        timestamp: new Date().toISOString(),
      },
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("[cron/write-intuition-triples]", err);
    return NextResponse.json(
      { error: "Cron failed", details: String(err) },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
