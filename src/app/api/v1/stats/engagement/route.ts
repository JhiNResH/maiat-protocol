import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [
      totalUsers,
      totalAgents,
      totalTrustReviews,
      totalProjectReviews,
      uniqueReviewers,
      totalVotes,
      totalBets,
      recentReviews,
      recentBets,
      recentVotes,
      allUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.agentScore.count(),
      prisma.trustReview.count(),
      prisma.review.count({ where: { status: "active" } }),
      prisma.trustReview.groupBy({ by: ['reviewer'] }).then(r => r.length),
      prisma.reviewVote.count().then(async (v: number) => v + (await prisma.vote.count())),
      prisma.marketPosition.count(),
      prisma.trustReview.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
      prisma.marketPosition.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
      prisma.reviewVote.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
      prisma.user.findMany({ 
        where: {
          NOT: {
            AND: [
              { reputationScore: { gt: 100 } },
              { totalReviews: 0 }
            ]
          }
        },
        orderBy: { reputationScore: 'desc' }, 
        take: 20 
      }),
    ]);

    // Fetch user details for display names
    const userAddresses = [...new Set([
      ...recentReviews.map(r => r.reviewer),
      ...recentBets.map(b => b.voterId),
      ...recentVotes.map(v => v.voter)
    ])];

    const [users, callerWallets, agentScores] = await Promise.all([
      prisma.user.findMany({
        where: { address: { in: userAddresses } },
        select: { address: true, displayName: true }
      }),
      prisma.callerWallet.findMany({
        where: { walletAddress: { in: userAddresses } },
        select: { walletAddress: true }
      }),
      prisma.agentScore.findMany({
        where: { walletAddress: { in: userAddresses } },
        select: { walletAddress: true }
      })
    ]);

    const userMap = Object.fromEntries(users.map(u => [u.address, u.displayName]));
    const agentWalleSet = new Set([
      ...callerWallets.map(cw => cw.walletAddress),
      ...agentScores.map(as => as.walletAddress)
    ]);

    // Consolidate activity feed
    const feed = [
      ...recentReviews.map(r => ({
        id: r.id,
        type: 'review',
        user: r.reviewer,
        userName: userMap[r.reviewer] || null,
        isAgent: r.source === 'agent' || agentWalleSet.has(r.reviewer),
        target: r.address,
        value: r.rating,
        detail: r.comment,
        createdAt: r.createdAt
      })),
      ...recentBets.map(b => ({
        id: b.id,
        type: 'bet',
        user: b.voterId,
        userName: userMap[b.voterId] || null,
        isAgent: agentWalleSet.has(b.voterId),
        target: b.projectId,
        value: b.amount,
        createdAt: b.createdAt
      })),
      ...recentVotes.map(v => ({
        id: v.id,
        type: 'vote',
        user: v.voter,
        userName: userMap[v.voter] || null,
        isAgent: agentWalleSet.has(v.voter),
        target: v.reviewId,
        value: v.vote === 'up' ? 1 : -1,
        createdAt: v.createdAt
      }))
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      overview: {
        totalUsers,
        totalAgents,
        totalReviews: totalTrustReviews + totalProjectReviews,
        uniqueReviewers,
        totalVotes,
        totalBets,
      },
      people: allUsers.map(u => ({
        address: u.address,
        displayName: u.displayName,
        reputation: u.reputationScore,
        reviews: u.totalReviews
      })),
      feed: feed.slice(0, 20),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("stats/engagement error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
