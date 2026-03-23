/**
 * GET|POST /api/v1/cron/oracle-sync
 *
 * Vercel Cron — triggered every 6 hours (vercel.json).
 * Can also be manually triggered via POST with Authorization: Bearer <CRON_SECRET>.
 *
 * Flow:
 * 1. Auth via CRON_SECRET
 * 2. Delegate to syncOracleScores() in oracle-updater.ts
 *    → fetches AgentScore records updated since last sync
 *    → batch-writes to TrustScoreOracle on Base Sepolia
 * 3. Return { synced, skipped, txHashes, errors }
 *
 * Signing key: MAIAT_ADMIN_PRIVATE_KEY (or ORACLE_UPDATER_KEY if set)
 * RPC:         ALCHEMY_BASE_RPC (Base mainnet) or ALCHEMY_BASE_SEPOLIA_RPC (testnet)
 * Oracle:      ORACLE_ADDRESS env or hardcoded fallback (0xf662902...)
 */

import { NextRequest, NextResponse } from "next/server";
import { syncOracleScores } from "@/lib/oracle-updater";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return authHeader === `Bearer ${cronSecret}`;
}

async function runSync(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncOracleScores();

    console.log(
      `[oracle-sync] synced=${result.synced} skipped=${result.skippedNoDelta} ` +
        `txs=${result.txHashes.length} errors=${result.errors.length}`
    );

    return NextResponse.json({
      synced: result.synced,
      skipped: result.skippedNoDelta,
      txHashes: result.txHashes,
      ...(result.errors.length > 0 && { errors: result.errors }),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[oracle-sync] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Vercel Cron triggers via GET */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return runSync(request);
}

/** Manual trigger via POST (e.g. from admin UI or internal service) */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return runSync(request);
}
