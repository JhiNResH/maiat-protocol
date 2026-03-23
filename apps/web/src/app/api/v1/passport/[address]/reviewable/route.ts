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

    // Also check on-chain interactions via Alchemy and cross-reference with known agents
    try {
      const interactionsRes = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || 'https://app.maiat.io'}/api/v1/wallet/${wallet}/interactions`
      );
      if (interactionsRes.ok) {
        const interactionsData = await interactionsRes.json();
        const interacted = interactionsData.interacted ?? [];
        // Only add addresses that are known agents (isKnown = true from agentScore)
        for (const item of interacted) {
          if (item.isKnown && !targetMap.has(item.address.toLowerCase())) {
            targetMap.set(item.address.toLowerCase(), {
              lastInteraction: new Date(),
              trustScore: item.trustScore,
            });
          }
        }
      }
    } catch {
      // On-chain lookup failed — continue with ACP data only
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
        where: { walletAddress: { in: targets, mode: 'insensitive' } },
        select: { walletAddress: true, tokenSymbol: true, rawMetrics: true },
      });
      agentNames = new Map(agents.map((a) => {
        const raw = a.rawMetrics as Record<string, unknown> | null;
        const name = (raw?.name as string) || a.tokenSymbol || "";
        return [a.walletAddress.toLowerCase(), name];
      }));
      // Build logo map from rawMetrics.profilePic
      var agentLogos = new Map<string, string>(
        agents
          .filter((a) => {
            const raw = a.rawMetrics as Record<string, unknown> | null;
            return typeof raw?.profilePic === "string";
          })
          .map((a) => {
            const raw = a.rawMetrics as Record<string, unknown>;
            return [a.walletAddress.toLowerCase(), raw.profilePic as string];
          })
      );
    } catch {
      // AgentScore table may not exist — that's fine
    }

    // 4. Build response
    const agentList = targets.map((target) => {
      const info = targetMap.get(target)!;
      const reviewed = reviewedSet.has(target);
      return {
        address: target,
        name: agentNames.get(target.toLowerCase()) || `${target.slice(0, 6)}…${target.slice(-4)}`,
        logo: agentLogos?.get(target.toLowerCase()) || null,
        score: info.trustScore,
        lastInteraction: info.lastInteraction.toISOString(),
        reviewed,
      };
    });

    // Filter: exclude test agents and zero-trust unverified addresses
    const filteredList = agentList.filter((a) => {
      const name = a.name.toLowerCase();
      // Skip test agents (test*, sandbox, demo*)
      if (/^(test|sandbox|demo)\d*/.test(name)) return false;
      // Skip addresses not in agentScore table (no real name resolved) with zero trust
      const hasRealName = agentNames.has(a.address.toLowerCase());
      if (!hasRealName && (a.score === null || a.score === 0)) return false;
      return true;
    });

    // Sort: unreviewed first, then by most recent interaction
    filteredList.sort((a, b) => {
      if (a.reviewed !== b.reviewed) return a.reviewed ? 1 : -1;
      return new Date(b.lastInteraction).getTime() - new Date(a.lastInteraction).getTime();
    });

    return NextResponse.json({ agents: filteredList });
  } catch (err) {
    console.error("[reviewable] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
