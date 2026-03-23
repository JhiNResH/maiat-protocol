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
        address: true,
        trustScore: true,
        category: true,
        image: true,
      },
    });

    const projectMap = new Map(projects.map((p) => [p.id, p]));

    // Enrich with AgentScore data (real trust scores + logos)
    const projectAddresses = projects.map(p => p.address).filter(Boolean) as string[];
    const agentScores = projectAddresses.length > 0
      ? await prisma.agentScore.findMany({
          where: { walletAddress: { in: projectAddresses, mode: 'insensitive' } },
          select: { walletAddress: true, trustScore: true, rawMetrics: true },
        })
      : [];
    
    // Also try matching by name for agents indexed under different addresses
    const projectNames = projects.map(p => p.name).filter(Boolean) as string[];
    const agentScoresByName: typeof agentScores = [];
    for (const name of projectNames) {
      const matches = await prisma.agentScore.findMany({
        where: { rawMetrics: { path: ['name'], string_contains: name } },
        select: { walletAddress: true, trustScore: true, rawMetrics: true },
        take: 3,
      });
      agentScoresByName.push(...matches);
    }

    const allAgentScores = [...agentScores, ...agentScoresByName];
    
    // Build lookup: project address/name → agent score (keep highest trust score)
    const agentScoreMap = new Map<string, { trustScore: number; profilePic: string | null }>();
    // Sort by trust score descending so highest wins in map
    allAgentScores.sort((a, b) => b.trustScore - a.trustScore);
    for (const as of allAgentScores) {
      const raw = as.rawMetrics as Record<string, unknown> | null;
      const entry = { trustScore: as.trustScore, profilePic: (raw?.profilePic as string) ?? null };
      
      const addrKey = as.walletAddress.toLowerCase();
      if (!agentScoreMap.has(addrKey)) agentScoreMap.set(addrKey, entry);
      
      const name = raw?.name as string;
      if (name && !agentScoreMap.has(name.toLowerCase())) {
        agentScoreMap.set(name.toLowerCase(), entry);
      }
    }

    // Pre-resolve agent names for wallet-address projectIds not in Project table
    const walletProjectIds = Object.keys(projectStakes).filter(
      id => id.startsWith('0x') && !projectMap.get(id)?.name
    );
    const agentNameMap = new Map<string, string>();
    if (walletProjectIds.length > 0) {
      const extraAgentScores = await prisma.agentScore.findMany({
        where: { walletAddress: { in: walletProjectIds, mode: 'insensitive' } },
        select: { walletAddress: true, trustScore: true, rawMetrics: true },
      });
      for (const as of extraAgentScores) {
        const raw = as.rawMetrics as Record<string, unknown> | null;
        const name = raw?.name as string;
        const addrKey = as.walletAddress.toLowerCase();
        if (name) agentNameMap.set(addrKey, name);
        // Also populate agentScoreMap if missing (wallet-only agents)
        if (!agentScoreMap.has(addrKey)) {
          agentScoreMap.set(addrKey, {
            trustScore: as.trustScore,
            profilePic: (raw?.profilePic as string) ?? null,
          });
        }
      }
    }

    // Build project standings
    const projectStandings = Object.entries(projectStakes)
      .map(([projectId, stats]) => {
        const project = projectMap.get(projectId);
        // Try to get real trust score + logo from AgentScore
        const agentData = (project?.address ? agentScoreMap.get(project.address.toLowerCase()) : null)
          ?? (project?.name ? agentScoreMap.get(project.name.toLowerCase()) : null)
          ?? (projectId.startsWith('0x') ? agentScoreMap.get(projectId.toLowerCase()) : null);
        
        const resolvedName = project?.name 
          ?? agentNameMap.get(projectId.toLowerCase())
          ?? (projectId.startsWith('0x') ? `${projectId.slice(0, 6)}...${projectId.slice(-4)}` : "Unknown");

        return {
          projectId,
          projectName: resolvedName,
          projectSlug: project?.slug ?? projectId,
          trustScore: agentData?.trustScore ?? project?.trustScore ?? 0,
          category: project?.category ?? "unknown",
          image: project?.image ?? agentData?.profilePic ?? null,
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
          projectName: projectMap.get(p.projectId)?.name 
            ?? projectStandings.find(s => s.projectId === p.projectId)?.projectName
            ?? (p.projectId.startsWith('0x') ? `${p.projectId.slice(0, 6)}...${p.projectId.slice(-4)}` : "Unknown"),
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
