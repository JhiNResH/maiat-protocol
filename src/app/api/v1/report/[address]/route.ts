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
import { computeTrustScore } from "@/lib/scoring";

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
      // Use computeTrustScore (real on-chain: tx count, age, blacklist, contract analysis)
      const onChainData = await computeTrustScore(address, "base").catch(() => null);

      // Blend: on-chain dynamic score + DB stored score (community reviews + seeded)
      const onChainScore = onChainData?.score ?? null;
      const dbScore = project.trustScore ?? null;

      // Final score: prefer on-chain if available, blend with DB if both exist
      let finalScore: number | null = null;
      if (onChainScore !== null && dbScore !== null) {
        // 60% on-chain real data + 40% community/seed data
        finalScore = Math.round(onChainScore * 0.6 + dbScore * 0.4);
      } else {
        finalScore = onChainScore ?? dbScore;
      }

      const riskLevel =
        finalScore === null ? "Unknown"
        : finalScore >= 70 ? "Low"
        : finalScore >= 40 ? "Medium"
        : finalScore >= 20 ? "High"
        : "Critical";

      const avgRating =
        project.reviews.length > 0
          ? Math.round(
              (project.reviews.reduce((s, r) => s + r.rating, 0) /
                project.reviews.length) *
                10
            ) / 10
          : (project.avgRating ?? null);

      // Build breakdown from real on-chain data
      const breakdown = onChainData?.breakdown
        ? {
            onChainHistory:    Math.round((onChainData.breakdown.onChainHistory    ?? 0) * 10),
            contractAnalysis:  Math.round((onChainData.breakdown.contractAnalysis  ?? 0) * 10),
            blacklistCheck:    Math.round((onChainData.breakdown.blacklistCheck    ?? 0) * 10),
            activityPattern:   Math.round((onChainData.breakdown.activityPattern   ?? 0) * 10),
            communityReviews:  project.reviewCount ?? 0,
            dbTrustScore:      dbScore ?? null,
          }
        : null;

      const flags = onChainData?.flags ?? [];
      const strengths: string[] = [];
      const riskFlags: string[] = [];

      if (flags.includes("KNOWN_PROTOCOL")) strengths.push("Known audited protocol");
      if (flags.includes("AUDITED")) strengths.push("Audited by security firms");
      if (flags.includes("VERIFIED")) strengths.push("Verified on-chain identity");
      if (onChainData?.details?.txCount && onChainData.details.txCount > 1000)
        strengths.push(`High on-chain activity (${onChainData.details.txCount.toLocaleString()} txs)`);
      if (flags.includes("KNOWN_SCAM_ADDRESS")) riskFlags.push("⚠️ Known scam address");
      if (onChainScore !== null && onChainScore < 20) riskFlags.push("Very low on-chain trust score");

      return NextResponse.json(
        {
          reportType: "contract",
          address: addr,
          name: project.name,
          slug: project.slug,
          category: project.category,
          description: project.description,
          website: project.website,
          chain: onChainData?.chain ?? project.chain ?? "base",
          trustScore: finalScore,
          onChainScore,
          dbScore,
          riskLevel,
          risk: onChainData?.risk ?? riskLevel,
          dataSource: onChainData?.dataSource ?? "db",
          reviewCount: project.reviewCount ?? project.reviews.length,
          avgRating,
          breakdown,
          flags,
          riskFlags,
          strengths,
          recentReviews: project.reviews.map((r) => ({
            rating: r.rating,
            comment: r.content,
            reviewer: r.reviewer?.address?.slice(0, 8) + "...",
            createdAt: r.createdAt.toISOString(),
          })),
          details: onChainData?.details ?? null,
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
