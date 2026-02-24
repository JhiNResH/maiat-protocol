import { NextResponse } from "next/server";
import { apiLog } from "@/lib/logger";

export const dynamic = "force-dynamic";

// --- Cache ---
let cachedStats: { data: object; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
      return NextResponse.json(cachedStats.data, {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Lazy import prisma to handle environments without DB
    let prisma: import("@prisma/client").PrismaClient;
    try {
      const mod = await import("@/lib/prisma");
      prisma = mod.prisma;
    } catch {
      return NextResponse.json(
        {
          addressesScored: 0,
          totalReviews: 0,
          contributors: 0,
          avgScore: 0,
          lastUpdated: new Date().toISOString(),
        },
        { headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Query real stats
    const [
      trustReviewCount,
      trustReviewAddresses,
      trustReviewContributors,
      projectReviewCount,
      projectCount,
    ] = await Promise.all([
      // TrustReview stats (v1 API reviews)
      prisma.trustReview.count(),
      prisma.trustReview
        .groupBy({ by: ["address"] })
        .then((groups) => groups.length),
      prisma.trustReview
        .groupBy({ by: ["reviewer"] })
        .then((groups) => groups.length),
      // Project-based Review stats
      prisma.review.count({ where: { status: "active" } }),
      prisma.project.count({ where: { status: "active" } }),
    ]);

    const totalReviews = trustReviewCount + projectReviewCount;

    const stats = {
      addressesScored: trustReviewAddresses + projectCount,
      totalReviews,
      contributors: trustReviewContributors,
      projectCount,
      lastUpdated: new Date().toISOString(),
    };

    // Cache the result
    cachedStats = { data: stats, expiresAt: Date.now() + CACHE_TTL_MS };

    return NextResponse.json(stats, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    apiLog.error("stats", error, {});
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
