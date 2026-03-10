import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/v1/markets — list active markets
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "open";
    const category = searchParams.get("category");

    const where: any = {};

    if (status !== "all") {
      where.status = status;
    }

    if (category) {
      where.category = category;
    }

    const markets = await prisma.market.findMany({
      where,
      orderBy: { closesAt: "asc" },
      include: {
        positions: {
          select: {
            id: true,
            projectId: true,
            amount: true,
          },
        },
      },
    });

    // Aggregate positions by project for each market
    const marketsWithStats = markets.map((market) => {
      // Group positions by projectId
      const projectStakes: Record<string, number> = {};
      for (const pos of market.positions) {
        projectStakes[pos.projectId] = (projectStakes[pos.projectId] || 0) + pos.amount;
      }

      // Sort by stake amount and get top 3
      const topProjects = Object.entries(projectStakes)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([projectId, totalStake]) => ({ projectId, totalStake }));

      return {
        id: market.id,
        title: market.title,
        description: market.description,
        category: market.category,
        status: market.status,
        opensAt: market.opensAt.toISOString(),
        closesAt: market.closesAt.toISOString(),
        resolvedAt: market.resolvedAt?.toISOString() ?? null,
        totalPool: market.totalPool,
        winnerIds: market.winnerIds,
        positionCount: market.positions.length,
        voterCount: new Set(market.positions.map(p => p.voterId)).size,
        topProjects,
        createdAt: market.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ markets: marketsWithStats }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error("[markets GET] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch markets" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
