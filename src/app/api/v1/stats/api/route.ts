import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/stats/api
 *
 * Public API usage analytics — aggregated stats + recent queries.
 */
export async function GET() {
  try {
    const now = new Date();
    const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      total,
      last24h,
      last7d,
      last30d,
      byType,
      byVerdict,
      outcomeStats,
      recentQueries,
      uniqueBuyers,
      uniqueTargets,
    ] = await Promise.all([
      prisma.queryLog.count(),
      prisma.queryLog.count({ where: { createdAt: { gte: h24 } } }),
      prisma.queryLog.count({ where: { createdAt: { gte: d7 } } }),
      prisma.queryLog.count({ where: { createdAt: { gte: d30 } } }),
      prisma.queryLog.groupBy({ by: ["type"], _count: true }),
      prisma.queryLog.groupBy({ by: ["verdict"], _count: true }),
      prisma.queryLog.groupBy({ by: ["outcome"], _count: true }),
      prisma.queryLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          type: true,
          target: true,
          buyer: true,
          trustScore: true,
          verdict: true,
          outcome: true,
          createdAt: true,
        },
      }),
      prisma.queryLog
        .groupBy({ by: ["buyer"], where: { buyer: { not: null } } })
        .then((g) => g.length),
      prisma.queryLog.groupBy({ by: ["target"] }).then((g) => g.length),
    ]);

    return NextResponse.json({
      overview: { total, last24h, last7d, last30d, uniqueBuyers, uniqueTargets },
      byType: Object.fromEntries(byType.map((r) => [r.type, r._count])),
      byVerdict: Object.fromEntries(byVerdict.map((r) => [r.verdict ?? "pending", r._count])),
      outcomes: Object.fromEntries(outcomeStats.map((r) => [r.outcome ?? "unreported", r._count])),
      recent: recentQueries,
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    console.error("stats/api error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
