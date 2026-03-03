import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserReputation } from "@/lib/reputation";
import { createRateLimiter, checkIpRateLimit } from "@/lib/ratelimit";

const rateLimiter = createRateLimiter("wallet:passport", 30, 60);

// --- CORS helpers ---
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  // Validate address format
  if (!isValidAddress(address)) {
    return NextResponse.json(
      { error: "Invalid address" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // Rate limit
  const { success: rateLimitOk } = await checkIpRateLimit(request, rateLimiter);
  if (!rateLimitOk) {
    return NextResponse.json(
      { error: "Too many requests. Retry after 1 minute." },
      { status: 429, headers: CORS_HEADERS }
    );
  }

  try {
    const normalizedAddress = address.toLowerCase();

    // Get user reputation (includes scarab balance)
    const reputation = await getUserReputation(normalizedAddress);

    // Fetch user from DB
    const user = await prisma.user.findUnique({
      where: { address: normalizedAddress },
    });

    // Fetch recent reviews by this user
    let recentReviews: Array<{
      id: string;
      rating: number;
      comment: string;
      address: string;
      name: string | null;
      createdAt: string;
    }> = [];
    let reviewCount = 0;
    let averageRating = 0;

    if (user) {
      const reviews = await prisma.review.findMany({
        where: { reviewerId: user.id },
        include: { project: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      // Enrich reviews with agent names from agentScore table
      const reviewAddresses = reviews.map(r => r.project.address).filter(Boolean);
      const agents = reviewAddresses.length > 0 ? await prisma.agentScore.findMany({
        where: { walletAddress: { in: reviewAddresses, mode: 'insensitive' } },
        select: { walletAddress: true, rawMetrics: true },
      }) : [];
      const nameMap = new Map<string, string>();
      for (const a of agents) {
        const raw = a.rawMetrics as Record<string, unknown> | null;
        const name = (raw?.name as string) || null;
        if (name) nameMap.set(a.walletAddress.toLowerCase(), name);
      }

      recentReviews = reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.content,
        address: r.project.address,
        name: nameMap.get(r.project.address.toLowerCase()) || r.project.name || null,
        createdAt: r.createdAt.toISOString(),
      }));

      reviewCount = reputation.totalReviews;

      // Calculate average rating from user's reviews
      if (reviews.length > 0) {
        const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
        averageRating = Math.round((totalRating / reviews.length) * 10) / 10;
      }
    }

    return NextResponse.json(
      {
        address: normalizedAddress,
        passport: {
          trustLevel: reputation.trustLevel,
          reputationScore: reputation.reputationScore,
          totalReviews: reputation.totalReviews,
          totalUpvotes: reputation.totalUpvotes,
          feeTier: reputation.feeTier,
          feeDiscount: reputation.feeDiscount,
        },
        scarab: {
          balance: reputation.scarabPoints,
        },
        reviews: {
          recent: recentReviews,
          count: reviewCount,
          averageRating,
        },
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("Passport API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
