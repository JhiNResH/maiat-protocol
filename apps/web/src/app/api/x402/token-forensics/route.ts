/**
 * POST /api/x402/token-forensics
 *
 * x402 Payment-Protected Deep Token/Project Analysis
 * Price: $0.05 per request
 *
 * AI-powered deep analysis of a project/agent.
 * No rate limiting (x402 payment IS the rate limit).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeProject } from "@/app/actions/analyze";
// CORS headers — payment gate is handled by middleware.ts
const X402_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Payment, X-Payment-Response, Payment-Signature, Payment-Required",
  "x-powered-by": "maiat-x402",
  "x-payment-protocol": "x402",
} as const;

export const dynamic = "force-dynamic";

// OPTIONS handler for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: X402_CORS_HEADERS });
}

interface ReviewRecord {
  rating: number;
  content: string | null;
  txHash: string | null;
  createdAt: Date;
}

function getRatingDistribution(reviews: ReviewRecord[]) {
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  reviews.forEach((r) => {
    if (r.rating >= 1 && r.rating <= 5) dist[r.rating]++;
  });
  return dist;
}

interface Analysis {
  score: number;
  status: string;
  summary: string;
  features: string[];
  warnings: string[];
  chain: string[];
}

interface ReviewSummary {
  total: number;
  avgRating: number | null;
  verified: number;
}

function getDetailedRecommendation(analysis: Analysis, reviews: ReviewSummary) {
  const signals = [];

  if (analysis.score >= 80) signals.push("HIGH_AI_SCORE");
  else if (analysis.score >= 50) signals.push("MODERATE_AI_SCORE");
  else signals.push("LOW_AI_SCORE");

  if (reviews.total >= 10 && reviews.avgRating !== null && reviews.avgRating >= 4)
    signals.push("STRONG_COMMUNITY");
  else if (reviews.total < 3) signals.push("LOW_REVIEW_COUNT");

  if (reviews.verified > reviews.total * 0.5) signals.push("MOSTLY_VERIFIED");

  if (analysis.warnings?.length > 2) signals.push("MULTIPLE_WARNINGS");

  return {
    signals,
    verdict:
      analysis.score >= 70 && reviews.avgRating !== null && reviews.avgRating >= 3.5
        ? "LIKELY_SAFE"
        : analysis.score >= 40
          ? "PROCEED_WITH_CAUTION"
          : "HIGH_RISK",
    confidence:
      reviews.total >= 5 ? "HIGH" : reviews.total >= 2 ? "MEDIUM" : "LOW",
  };
}

// Core handler logic
async function tokenForensicsHandler(request: NextRequest): Promise<NextResponse<unknown>> {
  try {
    const body = await request.json();
    const { projectId, projectName } = body;

    if (!projectId && !projectName) {
      return NextResponse.json(
        {
          error: "Provide projectId or projectName",
          docs: "https://docs.maiat.xyz/api/deep-insight",
        },
        { status: 400, headers: X402_CORS_HEADERS }
      );
    }

    // Find project
    let project;
    if (projectId) {
      project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          reviews: { where: { status: "active" }, orderBy: { createdAt: "desc" } },
        },
      });
    } else {
      project = await prisma.project.findFirst({
        where: { name: { contains: projectName, mode: "insensitive" } },
        include: {
          reviews: { where: { status: "active" }, orderBy: { createdAt: "desc" } },
        },
      });
    }

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404, headers: X402_CORS_HEADERS }
      );
    }

    // Run AI analysis
    const analysis = await analyzeProject(project.name);

    // Build review summary
    // A review is "verified" if it has a txHash (on-chain attestation)
    const reviewSummary = {
      total: project.reviews.length,
      verified: project.reviews.filter((r) => r.txHash !== null).length,
      avgRating: project.avgRating,
      ratingDistribution: getRatingDistribution(project.reviews as unknown as ReviewRecord[]),
      recentReviews: project.reviews.slice(0, 3).map((r) => ({
        rating: r.rating,
        content: r.content?.substring(0, 200),
        verified: r.txHash !== null,
        createdAt: r.createdAt,
      })),
    };

    return NextResponse.json(
      {
        project: {
          id: project.id,
          name: project.name,
          category: project.category,
          address: project.address,
        },
        analysis: {
          score: analysis.score,
          status: analysis.status,
          summary: analysis.summary,
          features: analysis.features,
          warnings: analysis.warnings,
          chain: analysis.chain,
        },
        reviews: reviewSummary,
        recommendation: getDetailedRecommendation(analysis, {
          total: reviewSummary.total,
          avgRating: reviewSummary.avgRating,
          verified: reviewSummary.verified,
        }),
        timestamp: new Date().toISOString(),
        attestation: {
          chain: "base-sepolia",
          oracle: "0x115Ab8cEdb7A362e3a7Da03582108d6AF990F21F",
        },
      },
      { headers: X402_CORS_HEADERS }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[x402/token-forensics] Error:", msg);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: X402_CORS_HEADERS }
    );
  }
}

// Payment gate handled by middleware.ts — export handler directly
export const POST = tokenForensicsHandler;
