import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserReputation } from "@/lib/reputation";

// --- Simple in-memory IP rate limiter ---
const ipHits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipHits.get(ip);

  if (!entry || entry.resetAt < now) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }

  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  return false;
}

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
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (isRateLimited(ip)) {
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

      recentReviews = reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.content,
        address: r.project.address,
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
