import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { awardScarab } from "@/lib/scarab-markets";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const BURN_RATE = 0.05; // 5% burn

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// POST /api/cron/resolve-markets — resolve all markets that have closed
// Called by Vercel cron every 2 weeks on Sunday at 00:00 UTC
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret if configured
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const now = new Date();

    // Find all markets that need resolution (closed but not yet resolved)
    const marketsToResolve = await prisma.market.findMany({
      where: {
        status: "open",
        closesAt: { lte: now },
      },
      include: {
        positions: true,
      },
    });

    if (marketsToResolve.length === 0) {
      return NextResponse.json(
        { message: "No markets to resolve", resolved: 0 },
        { headers: CORS_HEADERS }
      );
    }

    const results: any[] = [];

    for (const market of marketsToResolve) {
      try {
        const resolution = await resolveMarket(market);
        results.push({
          marketId: market.id,
          title: market.title,
          ...resolution,
        });
      } catch (err) {
        console.error(`[resolve-markets] Failed to resolve market ${market.id}:`, err);
        results.push({
          marketId: market.id,
          title: market.title,
          error: (err as Error).message,
        });
      }
    }

    // Seed next markets for each resolved category
    const categories = [...new Set(marketsToResolve.map((m) => m.category))];
    const seededMarkets: any[] = [];

    for (const category of categories) {
      try {
        const newMarket = await seedNextMarket(category);
        seededMarkets.push(newMarket);
      } catch (err) {
        console.error(`[resolve-markets] Failed to seed new ${category} market:`, err);
      }
    }

    return NextResponse.json(
      {
        resolved: results.length,
        results,
        seeded: seededMarkets.length,
        seededMarkets,
      },
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("[resolve-markets] Error:", err);
    return NextResponse.json(
      { error: "Failed to resolve markets" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

interface MarketWithPositions {
  id: string;
  title: string;
  category: string;
  totalPool: number;
  positions: {
    id: string;
    projectId: string;
    voterId: string;
    amount: number;
  }[];
}

async function resolveMarket(market: MarketWithPositions) {
  // 1. Get all unique project IDs from positions
  const projectIds = [...new Set(market.positions.map((p) => p.projectId))];

  if (projectIds.length === 0) {
    // No positions, just close the market
    await prisma.market.update({
      where: { id: market.id },
      data: {
        status: "resolved",
        resolvedAt: new Date(),
        winnerIds: [],
      },
    });
    return { winners: [], payouts: 0, burned: 0 };
  }

  // 2. Fetch current trust scores for all staked projects
  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    select: { id: true, name: true, trustScore: true },
  });

  // 3. Rank by trustScore DESC → top 3 are winners
  const ranked = [...projects].sort((a, b) => (b.trustScore ?? 0) - (a.trustScore ?? 0));
  const winnerIds = ranked.slice(0, 3).map((p) => p.id);
  const winnerSet = new Set(winnerIds);

  // 4. Calculate pools
  let winningPool = 0;
  let losingPool = 0;

  const positionsByProject: Record<string, { voterId: string; amount: number }[]> = {};

  for (const pos of market.positions) {
    if (!positionsByProject[pos.projectId]) {
      positionsByProject[pos.projectId] = [];
    }
    positionsByProject[pos.projectId].push({ voterId: pos.voterId, amount: pos.amount });

    if (winnerSet.has(pos.projectId)) {
      winningPool += pos.amount;
    } else {
      losingPool += pos.amount;
    }
  }

  // 5. Calculate payout distribution
  // Winners get: (their stake / total winning stakes) * (loser pool * 0.95) + original stake
  const redistributablePool = Math.floor(losingPool * (1 - BURN_RATE));
  const burnedAmount = losingPool - redistributablePool;

  const payouts: { positionId: string; voterId: string; originalStake: number; winnings: number; totalPayout: number }[] = [];

  for (const pos of market.positions) {
    if (winnerSet.has(pos.projectId)) {
      // Winner: gets share of loser pool + original stake back
      const shareOfPool = winningPool > 0 ? pos.amount / winningPool : 0;
      const winnings = Math.floor(shareOfPool * redistributablePool);
      const totalPayout = pos.amount + winnings;

      payouts.push({
        positionId: pos.id,
        voterId: pos.voterId,
        originalStake: pos.amount,
        winnings,
        totalPayout,
      });
    } else {
      // Loser: gets nothing (stake already deducted when position was created)
      payouts.push({
        positionId: pos.id,
        voterId: pos.voterId,
        originalStake: pos.amount,
        winnings: 0,
        totalPayout: 0,
      });
    }
  }

  // 6. Execute payouts and update positions
  for (const payout of payouts) {
    // Update position with payout amount
    await prisma.marketPosition.update({
      where: { id: payout.positionId },
      data: { payout: payout.totalPayout },
    });

    // Award Scarab to winners
    if (payout.totalPayout > 0) {
      await awardScarab(
        payout.voterId,
        payout.totalPayout,
        `Market win: ${market.title} — ${payout.winnings} winnings + ${payout.originalStake} stake 🏆`,
        market.id
      );
    }
  }

  // 7. Update market as resolved
  await prisma.market.update({
    where: { id: market.id },
    data: {
      status: "resolved",
      resolvedAt: new Date(),
      winnerIds,
    },
  });

  return {
    winners: winnerIds,
    winningPool,
    losingPool,
    redistributed: redistributablePool,
    burned: burnedAmount,
    payoutCount: payouts.filter((p) => p.totalPayout > 0).length,
  };
}

async function seedNextMarket(category: string) {
  const now = new Date();
  const closesAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days

  const titles: Record<string, string> = {
    "ai-agents": "Top AI Agent This Fortnight",
    defi: "Most Trusted DeFi Protocol",
    mixed: "Rising Star",
  };

  const descriptions: Record<string, string> = {
    "ai-agents": "Stake Scarab on which AI agent will have the highest trust score in 2 weeks",
    defi: "Stake Scarab on which DeFi protocol will be most trusted in 2 weeks",
    mixed: "Stake Scarab on which rising star (trust score < 70) will climb highest",
  };

  const newMarket = await prisma.market.create({
    data: {
      title: titles[category] ?? `Market: ${category}`,
      description: descriptions[category] ?? `Opinion market for ${category}`,
      category,
      status: "open",
      opensAt: now,
      closesAt,
      totalPool: 0,
      winnerIds: [],
    },
  });

  return {
    id: newMarket.id,
    title: newMarket.title,
    category: newMarket.category,
    closesAt: newMarket.closesAt.toISOString(),
  };
}
