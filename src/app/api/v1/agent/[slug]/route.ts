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
 * GET /api/v1/agent/:slug
 *
 * SEO-friendly endpoint for AI agents.
 * Accepts slug (e.g. "aixbt", "virtuals") or address (e.g. "0x4f9fd6...").
 *
 * Example:
 *   /api/v1/agent/aixbt
 *   /api/v1/agent/virtuals
 *   /api/v1/agent/0x4f9fd6be4a90f2620860d680c0d4d5fb53d1a825
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    // Resolve slug → entity
    const entity = resolveSlug(slug, "agent");

    if (!entity) {
      return NextResponse.json(
        {
          error: "AI agent not found",
          slug,
          hint: "Try: aixbt, virtuals, luna, vaderai, freysa, sekoia",
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

    // Also try to get project-level data (richer info for agents)
    let projectData = null;
    try {
      const { prisma } = await import("@/lib/prisma");
      const project = await prisma.project.findFirst({
        where: {
          OR: [
            { address: entity.address.toLowerCase() },
            { slug: entity.slug },
          ],
        },
        select: {
          name: true,
          description: true,
          image: true,
          website: true,
          twitter: true,
          github: true,
          docs: true,
          chain: true,
          symbol: true,
          tier: true,
          coreFunctions: true,
          trustScore: true,
          trustGrade: true,
          marketCap: true,
          price: true,
          volume24h: true,
        },
      });
      if (project) {
        projectData = {
          ...project,
          coreFunctions: project.coreFunctions
            ? JSON.parse(project.coreFunctions)
            : [],
        };
      }
    } catch {
      // DB not available
    }

    return NextResponse.json(
      {
        entity: {
          address: entity.address,
          slug: entity.slug,
          name: projectData?.name || entity.name,
          type: entity.type,
          category: entity.category,
          description: projectData?.description || null,
          image: projectData?.image || null,
          chain: projectData?.chain || "base",
          symbol: projectData?.symbol || null,
          tier: projectData?.tier || null,
          functions: projectData?.coreFunctions || [],
          links: {
            website: projectData?.website || null,
            twitter: projectData?.twitter || null,
            github: projectData?.github || null,
            docs: projectData?.docs || null,
          },
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
          : projectData?.trustScore
            ? {
                score: projectData.trustScore,
                grade: projectData.trustGrade,
              }
            : null,
        market: projectData
          ? {
              marketCap: projectData.marketCap,
              price: projectData.price,
              volume24h: projectData.volume24h,
            }
          : null,
        reviews: {
          total: reviewData.total,
          avgRating: reviewData.avgRating,
          recent: recentReviews,
        },
        canonical: {
          url: `/api/v1/agent/${entity.slug}`,
          address_url: `/api/v1/agent/${entity.address}`,
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
    apiLog.error("agent-slug", error, { slug });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
