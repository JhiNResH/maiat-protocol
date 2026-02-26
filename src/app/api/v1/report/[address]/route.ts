/**
 * GET /api/v1/report/[address]
 *
 * Unified 2-in-1 report endpoint for maiat-agent's onchain-report offering.
 * Auto-detects: contract/protocol → trust score report | wallet → passport report
 *
 * Response schema is stable — maiat-agent calls this one endpoint, no local assembly needed.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserReputation } from "@/lib/reputation";
import { calculateTrustScore } from "@/lib/trust-score";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function isValidAddress(addr: string) {
  return /^0x[a-fA-F0-9]{40}$/i.test(addr);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  if (!isValidAddress(address)) {
    return NextResponse.json(
      { error: "Invalid address" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const addr = address.toLowerCase();

  try {
    // ── 1. Check if address is an indexed project (protocol / AI agent) ────────
    const project = await prisma.project.findFirst({
      where: { address: addr },
      include: {
        reviews: {
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { reviewer: true },
        },
      },
    });

    if (project) {
      // ── Contract / Protocol report ──────────────────────────────────────────
      const trustData = await calculateTrustScore(addr).catch(() => null);
      const score: number | null = trustData?.score ?? null;
      const riskLevel =
        score === null ? "Unknown"
        : score >= 70 ? "Low"
        : score >= 40 ? "Medium"
        : "High";

      const avgRating =
        project.reviews.length > 0
          ? Math.round(
              (project.reviews.reduce((s, r) => s + r.rating, 0) /
                project.reviews.length) *
                10
            ) / 10
          : null;

      return NextResponse.json(
        {
          reportType: "contract",
          address: addr,
          name: project.name,
          slug: project.slug,
          category: project.category,
          description: project.description,
          website: project.website,
          trustScore: score,
          riskLevel,
          reviewCount: project.reviews.length,
          avgRating,
          breakdown: trustData?.breakdown ?? null,
          recentReviews: project.reviews.map((r) => ({
            rating: r.rating,
            comment: r.content,
            reviewer: r.reviewer?.address?.slice(0, 8) + "...",
            createdAt: r.createdAt.toISOString(),
          })),
          riskFlags: [],
          strengths: [],
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // ── 2. Not a known project → treat as wallet ─────────────────────────────
    const [reputation, user] = await Promise.all([
      getUserReputation(addr),
      prisma.user.findUnique({ where: { address: addr } }),
    ]);

    let recentReviews: Array<{
      id: string;
      rating: number;
      comment: string;
      projectAddress: string;
      projectName: string | null;
      projectSlug: string | null;
      createdAt: string;
    }> = [];

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
        projectAddress: r.project.address,
        projectName: r.project.name,
        projectSlug: r.project.slug,
        createdAt: r.createdAt.toISOString(),
      }));
    }

    return NextResponse.json(
      {
        reportType: "wallet",
        address: addr,
        trustLevel: reputation.trustLevel,
        reputationScore: reputation.reputationScore,
        scarabBalance: reputation.scarabPoints,
        totalReviews: reputation.totalReviews,
        totalUpvotes: reputation.totalUpvotes,
        feeTier: reputation.feeTier,
        feeDiscount: reputation.feeDiscount,
        recentReviews,
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("[/api/v1/report] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
