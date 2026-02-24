import { NextRequest, NextResponse } from "next/server";
import { resolveSlug } from "@/lib/slug-resolver";
import { computeTrustScore } from "@/lib/scoring";
import { getReviewCountForAddress } from "@/lib/trust-score";
import { apiLog } from "@/lib/logger";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * GET /api/v1/defi/:slug
 *
 * SEO-friendly endpoint for DeFi protocols.
 * Accepts slug (e.g. "usdc", "aerodrome") or address (e.g. "0x833589...").
 *
 * Example:
 *   /api/v1/defi/usdc
 *   /api/v1/defi/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    // Resolve slug → entity
    const entity = resolveSlug(slug, "defi");

    if (!entity) {
      return NextResponse.json(
        {
          error: "DeFi protocol not found",
          slug,
          hint: "Try: usdc, weth, aerodrome, aave, compound, morpho, uniswap, chainlink, stargate, base-bridge, dai",
        },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // Get live trust score
    let trustScore = null;
    try {
      trustScore = await computeTrustScore(entity.address);
    } catch {
      // Score computation failed — continue without it
    }

    // Get review counts (unified)
    const reviewData = await getReviewCountForAddress(entity.address);

    // Get reviews from DB
    let recentReviews: Array<{
      rating: number;
      comment: string;
      reviewer: string;
      createdAt: string;
    }> = [];
    try {
      const { prisma } = await import("@/lib/prisma");
      const reviews = await prisma.trustReview.findMany({
        where: { address: { equals: entity.address, mode: "insensitive" } },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      recentReviews = reviews.map((r) => ({
        rating: r.rating,
        comment: r.comment,
        reviewer: r.reviewer,
        createdAt: r.createdAt.toISOString(),
      }));
    } catch {
      // DB not available
    }

    return NextResponse.json(
      {
        entity: {
          address: entity.address,
          slug: entity.slug,
          name: entity.name,
          type: entity.type,
          category: entity.category,
          auditedBy: entity.auditedBy || [],
        },
        trust: trustScore
          ? {
              score: trustScore.score,
              risk: trustScore.risk,
              type: trustScore.type,
              flags: trustScore.flags,
              breakdown: trustScore.breakdown,
              dataSource: trustScore.dataSource,
            }
          : null,
        reviews: {
          total: reviewData.total,
          avgRating: reviewData.avgRating,
          recent: recentReviews,
        },
        canonical: {
          url: `/api/v1/defi/${entity.slug}`,
          address_url: `/api/v1/defi/${entity.address}`,
        },
        meta: {
          api_version: "v1",
          timestamp: new Date().toISOString(),
          oracle: "maiat-trust-v1",
        },
      },
      {
        headers: {
          ...CORS_HEADERS,
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    apiLog.error("defi-slug", error, { slug });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
