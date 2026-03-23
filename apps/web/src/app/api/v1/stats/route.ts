import { NextResponse } from "next/server";
import { apiLog } from "@/lib/logger";

export const dynamic = "force-dynamic";

// --- Cache ---
let cachedStats: { data: object; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const CORS_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
  "Access-Control-Allow-Origin": "*",
};

/**
 * GET /api/v1/stats
 *
 * Returns real platform statistics from the database.
 * Cached for 5 minutes.
 */
export async function GET() {
  try {
    // Check cache
    if (cachedStats && cachedStats.expiresAt > Date.now()) {
      return NextResponse.json(cachedStats.data, { headers: CORS_HEADERS });
    }

    // Lazy import prisma to handle environments without DB
    let prisma: import("@prisma/client").PrismaClient;
    try {
      const mod = await import("@/lib/prisma");
      prisma = mod.prisma;
    } catch {
      return NextResponse.json(
        {
          agentsIndexed: 0,
          totalQueries: 0,
          uniqueCallers: 0,
          addressesScored: 0,
          totalReviews: 0,
          contributors: 0,
          lastUpdated: new Date().toISOString(),
        },
        { headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Query real stats
    const [
      agentsIndexed,
      totalQueries,
      uniqueCallers,
      trustReviewCount,
      trustReviewAddresses,
      trustReviewContributors,
    ] = await Promise.all([
      prisma.agentScore.count(),
      prisma.queryLog.count(),
      prisma.queryLog
        .groupBy({ by: ["clientId"] })
        .then((groups) => groups.length),
      prisma.trustReview.count(),
      prisma.trustReview
        .groupBy({ by: ["address"] })
        .then((groups) => groups.length),
      prisma.trustReview
        .groupBy({ by: ["reviewer"] })
        .then((groups) => groups.length),
    ]);

    // Fetch Virtuals live total (with short timeout, non-blocking)
    let virtualsTotal = 0;
    try {
      const vRes = await fetch(
        "https://acpx.virtuals.io/api/agents?pagination%5Bpage%5D=1&pagination%5BpageSize%5D=1",
        { signal: AbortSignal.timeout(4_000) }
      );
      if (vRes.ok) {
        const vJson = await vRes.json() as { meta?: { pagination?: { total?: number } } };
        virtualsTotal = vJson.meta?.pagination?.total ?? 0;
      }
    } catch {
      // Non-critical — fall back to DB count
    }

    const stats = {
      // Total agents on Virtuals ACP (live) — falls back to DB count if Virtuals is unreachable
      agentsIndexed: virtualsTotal > agentsIndexed ? virtualsTotal : agentsIndexed,
      agentsInDB: agentsIndexed,         // how many we've actually indexed
      agentsVirtuals: virtualsTotal,     // live Virtuals count
      totalQueries,
      uniqueCallers,
      addressesScored: trustReviewAddresses,
      totalReviews: trustReviewCount,
      contributors: trustReviewContributors,
      lastUpdated: new Date().toISOString(),
    };

    // Cache the result
    cachedStats = { data: stats, expiresAt: Date.now() + CACHE_TTL_MS };

    return NextResponse.json(stats, { headers: CORS_HEADERS });
  } catch (error) {
    apiLog.error("stats", error, {});
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
