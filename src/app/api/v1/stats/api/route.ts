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
      trending,
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
      prisma.queryLog.groupBy({
        by: ["target"],
        _count: { _all: true },
        orderBy: { _count: { target: 'desc' } },
        take: 10
      }),
    ]);

    // Fetch trust grades for trending targets
    const trendingTargets = trending.map(t => t.target);
    const projects = await prisma.project.findMany({
      where: { address: { in: trendingTargets } },
      select: { address: true, trustScore: true, trustGrade: true }
    });
    const trustMap = Object.fromEntries(projects.map(p => [p.address, p]));

    // Extract unique callers + resolve identities
    const recentWithMeta = await prisma.queryLog.findMany({
      where: { createdAt: { gte: d7 } },
      select: { metadata: true, clientId: true },
    });
    const uniqueIps = new Set<string>();
    const clientCounts: Record<string, number> = {};
    for (const r of recentWithMeta) {
      const meta = r.metadata as Record<string, unknown> | null;
      if (meta?.callerIp) uniqueIps.add(meta.callerIp as string);
      const cid = (r.clientId || meta?.userAgent as string || "unknown");
      clientCounts[cid] = (clientCounts[cid] || 0) + 1;
    }

    // Resolve top clients to names/wallets
    const topClientEntries = Object.entries(clientCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const resolvedClients = await Promise.all(
      topClientEntries.map(async ([clientId, count]) => {
        // Try to find a CallerWallet first
        const caller = await prisma.callerWallet.findUnique({
          where: { clientId },
          select: { walletAddress: true }
        });

        if (caller) {
          const user = await prisma.user.findUnique({
            where: { address: caller.walletAddress.toLowerCase() },
            select: { displayName: true }
          });
          return {
            client: clientId,
            count,
            wallet: caller.walletAddress,
            name: user?.displayName || null,
            type: 'sdk'
          };
        }

        // If not an SDK client, check if it's a known User-Agent with a browser pattern
        const isBrowser = clientId.toLowerCase().includes('browser') || clientId.toLowerCase().includes('mozilla');
        return {
          client: clientId,
          count,
          wallet: null,
          name: null,
          type: isBrowser ? 'browser' : 'external'
        };
      })
    );

    return NextResponse.json({
      overview: { 
        total, 
        last24h, 
        last7d, 
        last30d, 
        uniqueBuyers, 
        uniqueTargets, 
        uniqueCallers7d: uniqueIps.size 
      },
      byType: Object.fromEntries(byType.map((r) => [r.type, r._count])),
      byVerdict: Object.fromEntries(byVerdict.map((r) => [r.verdict ?? "pending", r._count])),
      outcomes: Object.fromEntries(outcomeStats.map((r) => [r.outcome ?? "unreported", r._count])),
      trending: trending.map(t => ({
        target: t.target,
        count: t._count._all,
        trustScore: trustMap[t.target]?.trustScore || null,
        trustGrade: trustMap[t.target]?.trustGrade || null
      })),
      recent: recentQueries,
      topClients: resolvedClients,
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    console.error("stats/api error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
