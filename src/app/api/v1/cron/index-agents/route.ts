/**
 * GET /api/v1/cron/index-agents
 * Vercel Cron Job — runs daily at 02:00 UTC
 * Protected by CRON_SECRET header
 *
 * Set CRON_SECRET in Vercel env vars.
 */

import { NextRequest, NextResponse } from "next/server";
import { runAcpIndexer } from "@/lib/acp-indexer";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min timeout for Vercel Pro

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

  try {
    const result = await runAcpIndexer({ dryRun: false });

    return NextResponse.json(
      {
        success: true,
        indexed: result.indexed,
        updated: result.updated,
        failed: result.failed,
        stats: result.stats,
        timestamp: new Date().toISOString(),
      },
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("[cron/index-agents]", err);
    return NextResponse.json(
      { error: "Indexer failed", details: String(err) },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
