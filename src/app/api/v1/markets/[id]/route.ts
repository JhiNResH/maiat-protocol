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

// GET /api/v1/markets/[id] — market detail + positions
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const market = await prisma.market.findUnique({
      where: { id },
      include: {
        positions: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            projectId: true,
            voterId: true,
            amount: true,
            payout: true,
            createdAt: true,
          },
        },
      },
    });

    if (!market) {
      return NextResponse.json(
        { error: "Market not found" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // Aggregate positions by project
    const projectStakes: Record<string, { totalStake: number; positionCount: number; voters: string[] }> = {};
    for (const pos of market.positions) {
      if (!projectStakes[pos.projectId]) {
        projectStakes[pos.projectId] = { totalStake: 0, positionCount: 0, voters: [] };
      }
      projectStakes[pos.projectId].totalStake += pos.amount;
      projectStakes[pos.projectId].positionCount += 1;
      if (!projectStakes[pos.projectId].voters.includes(pos.voterId)) {
        projectStakes[pos.projectId].voters.push(pos.voterId);
      }
    }

    // Fetch project details for all staked projects
    const projectIds = Object.keys(projectStakes);
    const projects = await prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: {
        id: true,
        name: true,
        slug: true,
        trustScore: true,
        category: true,
        image: true,
      },
    });

    const projectMap = new Map(projects.map((p) => [p.id, p]));

    // Build project standings
    const projectStandings = Object.entries(projectStakes)
      .map(([projectId, stats]) => {
        const project = projectMap.get(projectId);
        return {
          projectId,
          projectName: project?.name ?? "Unknown",
          projectSlug: project?.slug ?? projectId,
          trustScore: project?.trustScore ?? 0,
          category: project?.category ?? "unknown",
          image: project?.image ?? null,
          totalStake: stats.totalStake,
          positionCount: stats.positionCount,
          voterCount: stats.voters.length,
        };
      })
      .sort((a, b) => b.totalStake - a.totalStake);

    return NextResponse.json(
      {
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
        projectStandings,
        positions: market.positions.map((p) => ({
          id: p.id,
          projectId: p.projectId,
          projectName: projectMap.get(p.projectId)?.name ?? "Unknown",
          voterId: p.voterId,
          amount: p.amount,
          payout: p.payout,
          createdAt: p.createdAt.toISOString(),
        })),
        createdAt: market.createdAt.toISOString(),
      },
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("[markets/[id] GET] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch market" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
