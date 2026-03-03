/**
 * GET /api/v1/cron/oracle-sync
 * Vercel Cron — runs every 6 hours
 * Syncs trust scores from DB → on-chain TrustScoreOracle
 */

import { NextRequest, NextResponse } from "next/server";
import { syncOracleScores } from "@/lib/oracle-updater";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncOracleScores();
    console.log(`[oracle-sync] Synced ${result.synced} scores, ${result.txHashes.length} txs`);
    return NextResponse.json({
      synced: result.synced,
      txHashes: result.txHashes,
      ...(result.errors.length > 0 && { errors: result.errors }),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[oracle-sync] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
