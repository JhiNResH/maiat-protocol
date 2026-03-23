import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAddress, getAddress } from "viem";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Maiat-Client, X-Maiat-Key",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/v1/wallet/[address]/positions
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;

    if (!isAddress(address)) {
      return NextResponse.json({ positions: [] }, { headers: CORS_HEADERS });
    }

    const checksummed = getAddress(address);

    const rawPositions = await prisma.marketPosition.findMany({
      where: { voterId: { equals: checksummed, mode: "insensitive" } },
      include: {
        market: {
          select: { id: true, title: true, status: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Enrich with project names
    const projectIds = [...new Set(rawPositions.map(p => p.projectId))];
    const projects = await prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, name: true },
    });
    const projectMap = new Map(projects.map(p => [p.id, p.name]));

    // Also check AgentScore for wallet-address-based projectIds
    const walletProjectIds = projectIds.filter(id => isAddress(id));
    const agents = walletProjectIds.length > 0
      ? await prisma.agentScore.findMany({
          where: { walletAddress: { in: walletProjectIds.map(id => getAddress(id)), mode: "insensitive" } },
          select: { walletAddress: true, rawMetrics: true },
        })
      : [];
    for (const a of agents) {
      const name = (a.rawMetrics as Record<string, unknown> | null)?.name as string;
      if (name) projectMap.set(a.walletAddress, name);
    }

    const positions = rawPositions.map(p => ({
      marketId: p.market.id,
      marketTitle: p.market.title,
      projectId: p.projectId,
      projectName: projectMap.get(p.projectId) ?? `${p.projectId.slice(0, 8)}...`,
      amount: p.amount,
      status: p.market.status,
      payout: p.payout,
      createdAt: p.createdAt.toISOString(),
    }));

    return NextResponse.json({ positions }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error("[wallet/positions] Error:", err);
    return NextResponse.json({ positions: [] }, { status: 500, headers: CORS_HEADERS });
  }
}
