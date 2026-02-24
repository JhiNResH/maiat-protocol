import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import { getUserReputation } from "@/lib/reputation";
import { apiLog } from "@/lib/logger";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * GET /api/v1/wallet/:address/passport
 *
 * Returns a user's reputation passport — their cumulative trust profile.
 *
 * Includes:
 * - Trust level & fee tier
 * - Scarab balance
 * - Review history summary
 * - Addresses reviewed
 * - Interaction count
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  if (!isAddress(address)) {
    return NextResponse.json(
      { error: "Invalid Ethereum address" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const checksummed = getAddress(address);

  try {
    // Get reputation data
    const reputation = await getUserReputation(checksummed);

    // Get additional data from DB
    let reviewedAddresses: string[] = [];
    let reviewHistory: Array<{
      address: string;
      rating: number;
      createdAt: string;
    }> = [];
    let scarabHistory: {
      totalEarned: number;
      totalSpent: number;
      streak: number;
    } | null = null;

    try {
      const { prisma } = await import("@/lib/prisma");

      // Get reviewed addresses
      const reviews = await prisma.trustReview.findMany({
        where: { reviewer: checksummed },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          address: true,
          rating: true,
          createdAt: true,
        },
      });

      reviewHistory = reviews.map((r) => ({
        address: r.address,
        rating: r.rating,
        createdAt: r.createdAt.toISOString(),
      }));

      reviewedAddresses = [
        ...new Set(reviews.map((r) => r.address)),
      ];

      // Get Scarab stats
      const scarabBalance = await prisma.scarabBalance.findUnique({
        where: { address: checksummed.toLowerCase() },
      });

      if (scarabBalance) {
        scarabHistory = {
          totalEarned: scarabBalance.totalEarned,
          totalSpent: scarabBalance.totalSpent,
          streak: scarabBalance.streak,
        };
      }
    } catch {
      // DB not available
    }

    return NextResponse.json(
      {
        wallet: checksummed,
        passport: {
          trustLevel: reputation.trustLevel,
          reputationScore: reputation.reputationScore,
          totalReviews: reputation.totalReviews,
          totalUpvotes: reputation.totalUpvotes,
          feeTier: {
            rate: reputation.feeTier,
            discount: reputation.feeDiscount,
            label: reputation.trustLevel.toUpperCase(),
          },
        },
        scarab: {
          balance: reputation.scarabPoints,
          ...(scarabHistory || {}),
        },
        reviews: {
          count: reviewHistory.length,
          addressesReviewed: reviewedAddresses,
          recent: reviewHistory.slice(0, 10),
        },
        progression: {
          current: reputation.trustLevel,
          nextLevel: getNextLevel(reputation.trustLevel),
          pointsToNext: getPointsToNext(
            reputation.reputationScore,
            reputation.trustLevel
          ),
          benefits: getLevelBenefits(reputation.trustLevel),
        },
        meta: {
          api_version: "v1",
          timestamp: new Date().toISOString(),
        },
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    apiLog.error("wallet-passport", error, { address: checksummed });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

// --- Helpers ---

function getNextLevel(
  current: "new" | "trusted" | "verified" | "guardian"
): string | null {
  switch (current) {
    case "new":
      return "trusted";
    case "trusted":
      return "verified";
    case "verified":
      return "guardian";
    case "guardian":
      return null;
  }
}

function getPointsToNext(
  currentScore: number,
  level: "new" | "trusted" | "verified" | "guardian"
): number | null {
  switch (level) {
    case "new":
      return Math.max(0, 10 - currentScore);
    case "trusted":
      return Math.max(0, 50 - currentScore);
    case "verified":
      return Math.max(0, 200 - currentScore);
    case "guardian":
      return null; // Max level
  }
}

function getLevelBenefits(
  level: "new" | "trusted" | "verified" | "guardian"
): string[] {
  switch (level) {
    case "new":
      return ["Submit reviews", "Earn Scarab rewards"];
    case "trusted":
      return ["0.3% swap fee (40% discount)", "Priority review visibility"];
    case "verified":
      return [
        "0.1% swap fee (80% discount)",
        "Verified badge",
        "Review weight boost",
      ];
    case "guardian":
      return [
        "0% swap fee (free!)",
        "Guardian badge",
        "Maximum review weight",
        "Community moderator",
      ];
  }
}
