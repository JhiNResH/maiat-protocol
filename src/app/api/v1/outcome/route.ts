/**
 * POST /api/v1/outcome
 *
 * Phase 1B: Trust Swap Outcome Feedback (Spec: 2026-03-06-maiat-v2-trust-foundation)
 *
 * Records the actual result of a trust_swap execution on-chain, enabling:
 * - Evidence chain feedback loop (jobId → QueryLog.outcome update)
 * - Dynamic trust score recomputation (on-chain 40% + outcomes 60%)
 * - Anti-spam optional signature verification (Phase 2 enforces)
 *
 * Flow: trust_swap job → execute on-chain → POST /api/v1/outcome → newTrustScore
 */

import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { prisma } from "@/lib/prisma";
import { createRateLimiter, checkIpRateLimit } from "@/lib/ratelimit";

const rateLimiter = createRateLimiter("outcome", 50, 60);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Maiat-Key, X-Maiat-Client",
};

const VALID_OUTCOMES = ["success", "failure", "partial", "expired"];

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Recompute trust score blending on-chain data with outcome history
 * @param agentAddress wallet address to score
 * @param onchainScore 0-100 from on-chain behavioral data (existing)
 * @returns newTrustScore blending 40% on-chain + 60% outcome history (if >= 5 outcomes)
 */
async function recomputeTrustScore(agentAddress: string, onchainScore: number): Promise<number> {
  const outcomes = await prisma.queryLog.findMany({
    where: {
      target: agentAddress.toLowerCase(),
      outcome: { not: null },
    },
  });

  if (outcomes.length === 0) {
    return onchainScore;
  }

  // Count successful outcomes
  const successCount = outcomes.filter((q) => q.outcome === "success").length;
  const successRate = successCount / outcomes.length;
  const outcomeScore = Math.round(successRate * 100);

  // Blend: 
  // - If < 5 outcomes: weight 90% on-chain, 10% outcomes (insufficient history)
  // - If >= 5 outcomes: weight 40% on-chain, 60% outcomes (sufficient history)
  const weight = outcomes.length >= 5 ? 0.4 : 0.9;
  const blended = Math.round(onchainScore * weight + outcomeScore * (1 - weight));

  return Math.max(0, Math.min(100, blended));
}

export async function POST(request: NextRequest) {
  // Auth: require X-Maiat-Key header matching MAIAT_API_KEY env var
  const apiKey = request.headers.get("X-Maiat-Key");
  const expectedKey = process.env.MAIAT_API_KEY;
  if (!expectedKey || apiKey !== expectedKey) {
    return NextResponse.json(
      { error: "Unauthorized: valid X-Maiat-Key required" },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  const { success: rlOk } = await checkIpRateLimit(request, rateLimiter);
  if (!rlOk) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: CORS_HEADERS }
    );
  }

  try {
    const body = await request.json();

    // Validate required fields (Phase 1: signature optional)
    const { jobId, agentAddress, outcome, actualAmountOut, callerSignature } = body as {
      jobId?: string;
      agentAddress?: string;
      outcome?: string;
      actualAmountOut?: string;
      callerSignature?: string;
    };

    if (!jobId || typeof jobId !== "string") {
      return NextResponse.json(
        { error: "jobId required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!agentAddress || !isAddress(agentAddress)) {
      return NextResponse.json(
        { error: "Valid agentAddress required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!outcome || !VALID_OUTCOMES.includes(outcome)) {
      return NextResponse.json(
        { error: `outcome must be one of: ${VALID_OUTCOMES.join(", ")}` },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const normalizedAgent = agentAddress.toLowerCase();

    // Find the QueryLog for this job
    const queryLog = await prisma.queryLog.findFirst({
      where: {
        jobId,
        target: normalizedAgent,
        type: "trust_swap",
      },
    });

    if (!queryLog) {
      return NextResponse.json(
        {
          error: "QueryLog not found for this jobId + agentAddress",
          recorded: false,
        },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // Prevent double-recording (idempotent)
    if (queryLog.outcome !== null) {
      return NextResponse.json(
        {
          recorded: false,
          message: "Outcome already recorded for this jobId",
          existingOutcome: queryLog.outcome,
        },
        { status: 409, headers: CORS_HEADERS }
      );
    }

    // Update the QueryLog with outcome + optional signature
    const updatedLog = await prisma.queryLog.update({
      where: { id: queryLog.id },
      data: {
        outcome,
        metadata: {
          ...((queryLog.metadata as Record<string, unknown>) || {}),
          actualAmountOut: actualAmountOut ?? null,
          callerSignature: callerSignature ?? null,
          outcomeRecordedAt: new Date().toISOString(),
        },
      },
    });

    // Recompute trust score (use existing on-chain score as base)
    const onchainScore = queryLog.trustScore ?? 50; // fallback to neutral
    const newTrustScore = await recomputeTrustScore(normalizedAgent, onchainScore);
    const delta = newTrustScore - onchainScore;

    // Persist newTrustScore back to AgentScore table
    await prisma.agentScore.upsert({
      where: { walletAddress: normalizedAgent },
      update: { trustScore: newTrustScore, lastUpdated: new Date() },
      create: {
        walletAddress: normalizedAgent,
        trustScore: newTrustScore,
        completionRate: 0,
        paymentRate: 0,
        expireRate: 0,
        totalJobs: 0,
        rawMetrics: {},
      },
    });

    return NextResponse.json(
      {
        recorded: true,
        jobId,
        agentAddress: normalizedAgent,
        outcome: updatedLog.outcome,
        newTrustScore,
        delta,
      },
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("[outcome]", err);
    return NextResponse.json(
      { error: "Failed to record outcome" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
