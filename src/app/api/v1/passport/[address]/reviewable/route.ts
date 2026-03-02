/**
 * GET /api/v1/passport/[address]/reviewable
 *
 * Returns agents/projects this wallet interacted with (via ACP query logs)
 * but hasn't reviewed yet.
 */

import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const wallet = address.toLowerCase();

  try {
    // 1. Get all distinct targets this wallet queried via ACP
    const logs = await prisma.queryLog.findMany({
      where: { buyer: wallet },
      select: { target: true, createdAt: true, trustScore: true },
      orderBy: { createdAt: "desc" },
    });

    // Deduplicate: keep latest interaction per target
    const targetMap = new Map<
      string,
      { lastInteraction: Date; trustScore: number | null }
    >();
    for (const log of logs) {
      if (!targetMap.has(log.target)) {
        targetMap.set(log.target, {
          lastInteraction: log.createdAt,
          trustScore: log.trustScore,
        });
      }
    }

    if (targetMap.size === 0) {
      return NextResponse.json({ agents: [] });
    }

    // 2. Get reviews already written by this wallet
    const reviews = await prisma.trustReview.findMany({
      where: { reviewer: wallet },
      select: { address: true },
    });
    const reviewedSet = new Set(reviews.map((r) => r.address.toLowerCase()));

    // 3. Try to enrich with agent names from AgentScore if available
    const targets = Array.from(targetMap.keys());
    let agentNames: Map<string, string> = new Map();
    try {
      const agents = await prisma.agentScore.findMany({
        where: { walletAddress: { in: targets } },
        select: { walletAddress: true, tokenSymbol: true },
      });
      agentNames = new Map(agents.map((a) => [a.walletAddress, a.tokenSymbol ?? ""]));
    } catch {
      // AgentScore table may not exist — that's fine
    }

    // 4. Build response
    const agentList = targets.map((target) => {
      const info = targetMap.get(target)!;
      const reviewed = reviewedSet.has(target);
      return {
        address: target,
        name: agentNames.get(target) || `${target.slice(0, 6)}…${target.slice(-4)}`,
        score: info.trustScore,
        lastInteraction: info.lastInteraction.toISOString(),
        reviewed,
      };
    });

    // Sort: unreviewed first, then by most recent interaction
    agentList.sort((a, b) => {
      if (a.reviewed !== b.reviewed) return a.reviewed ? 1 : -1;
      return new Date(b.lastInteraction).getTime() - new Date(a.lastInteraction).getTime();
    });

    return NextResponse.json({ agents: agentList });
  } catch (err) {
    console.error("[reviewable] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
