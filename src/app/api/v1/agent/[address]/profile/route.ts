/**
 * GET /api/v1/agent/[address]/profile
 *
 * Deep behavioral profile for an agent — goes beyond the basic trust score.
 * Analyzes: job completion trends, buyer diversity, payment behavior,
 * cross-agent interaction quality, and Wadjet risk signals.
 *
 * This powers the `agent_profile` ACP offering ($0.03).
 * All data is derived from on-chain ACP history + Wadjet ML — no opinion markets.
 */

import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import { prisma } from "@/lib/prisma";
import { logQueryAsync } from "@/lib/query-logger";
import { predictAgent, getProfile, type WadjetAgentResult } from "@/lib/wadjet-client";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Maiat-Client",
};

export const dynamic = "force-dynamic";
export const maxDuration = 25;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// ── Behavioral Trend Analysis ──────────────────────────────────────────────────

interface BehavioralTrend {
  direction: "improving" | "declining" | "stable" | "unknown";
  recentCompletionRate: number | null;
  historicalCompletionRate: number | null;
  delta: number | null;
}

function analyzeTrend(rawMetrics: Record<string, unknown>): BehavioralTrend {
  const result: BehavioralTrend = {
    direction: "unknown",
    recentCompletionRate: null,
    historicalCompletionRate: null,
    delta: null,
  };

  // Check if we have previousCompletionRate stored from acp_poller
  const current = typeof rawMetrics.completionRate === "number" ? rawMetrics.completionRate : null;
  const previous = typeof rawMetrics.previousCompletionRate === "number" ? rawMetrics.previousCompletionRate : null;

  if (current !== null) result.recentCompletionRate = current;
  if (previous !== null) result.historicalCompletionRate = previous;

  if (current !== null && previous !== null) {
    result.delta = +(current - previous).toFixed(4);
    if (result.delta > 0.05) result.direction = "improving";
    else if (result.delta < -0.05) result.direction = "declining";
    else result.direction = "stable";
  }

  return result;
}

// ── Buyer Diversity Score ──────────────────────────────────────────────────────

interface BuyerDiversity {
  uniqueBuyers: number;
  totalJobs: number;
  diversityScore: number; // 0-100
  singleBuyerRisk: boolean;
  assessment: string;
}

function analyzeBuyerDiversity(agent: {
  uniqueBuyers: number | null;
  totalJobs: number | null;
}): BuyerDiversity {
  const buyers = agent.uniqueBuyers ?? 0;
  const jobs = agent.totalJobs ?? 0;

  const singleBuyerRisk = buyers <= 1 && jobs > 3;

  // Diversity formula: log(uniqueBuyers+1) / log(totalJobs+1) * 100, capped
  let diversityScore = 0;
  if (jobs > 0 && buyers > 0) {
    diversityScore = Math.min(100, Math.round(
      (Math.log(buyers + 1) / Math.log(Math.max(jobs, buyers) + 1)) * 100
    ));
  }

  let assessment: string;
  if (singleBuyerRisk) assessment = "Single buyer pattern — possible self-dealing or wash activity";
  else if (diversityScore >= 70) assessment = "Healthy buyer diversity — serves multiple distinct clients";
  else if (diversityScore >= 40) assessment = "Moderate diversity — growing client base";
  else if (jobs === 0) assessment = "No job history yet";
  else assessment = "Low diversity — concentrated buyer base";

  return { uniqueBuyers: buyers, totalJobs: jobs, diversityScore, singleBuyerRisk, assessment };
}

// ── Payment Behavior ───────────────────────────────────────────────────────────

interface PaymentBehavior {
  paymentRate: number | null;
  expireRate: number | null;
  reliability: "excellent" | "good" | "concerning" | "poor" | "unknown";
}

function analyzePayment(agent: {
  paymentRate: number | null;
  expireRate: number | null;
}): PaymentBehavior {
  const pr = agent.paymentRate;
  const er = agent.expireRate;

  let reliability: PaymentBehavior["reliability"] = "unknown";
  if (pr !== null) {
    if (pr >= 0.95) reliability = "excellent";
    else if (pr >= 0.8) reliability = "good";
    else if (pr >= 0.5) reliability = "concerning";
    else reliability = "poor";
  }

  return { paymentRate: pr, expireRate: er, reliability };
}

// ── Main Handler ───────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address: rawAddress } = await params;
  const clientId = request.headers.get("x-maiat-client") ?? undefined;
  const callerIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
  const userAgent = request.headers.get("user-agent") || undefined;

  if (!rawAddress || !isAddress(rawAddress)) {
    return NextResponse.json(
      { error: "Invalid wallet address" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const address = getAddress(rawAddress);

  try {
    // Fetch from DB
    const agent = await prisma.agentScore.findUnique({
      where: { walletAddress: address },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found in index", address },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const rawMetrics = (agent.rawMetrics as Record<string, unknown>) ?? {};

    // Run analyses in parallel
    const [wadjetResult] = await Promise.all([
      predictAgent(address).catch((err) => {
        console.warn("[agent-profile] Wadjet unavailable:", err);
        return null as WadjetAgentResult | null;
      }),
    ]);

    const trend = analyzeTrend(rawMetrics);
    const diversity = analyzeBuyerDiversity({
      uniqueBuyers: (agent as Record<string, unknown>).uniqueBuyers as number | null ?? null,
      totalJobs: agent.totalJobs,
    });
    const payment = analyzePayment({
      paymentRate: agent.paymentRate ? Number(agent.paymentRate) : null,
      expireRate: agent.expireRate ? Number(agent.expireRate) : null,
    });

    // Overall profile verdict
    const trustScore = agent.trustScore ?? 50;
    let profileVerdict: string;
    if (trustScore >= 80 && diversity.diversityScore >= 50 && payment.reliability === "excellent") {
      profileVerdict = "Strong — high trust, diverse clients, reliable payments";
    } else if (trustScore >= 60 && !diversity.singleBuyerRisk) {
      profileVerdict = "Moderate — decent trust but room for improvement";
    } else if (diversity.singleBuyerRisk) {
      profileVerdict = "Suspicious — single buyer pattern detected, exercise caution";
    } else if (trustScore < 40) {
      profileVerdict = "Risky — low trust score, limited or poor track record";
    } else {
      profileVerdict = "Inconclusive — insufficient data for strong assessment";
    }

    // Log
    const queryId = await logQueryAsync({
      type: "agent_profile",
      target: address,
      clientId,
      callerIp,
      userAgent,
      trustScore,
      verdict: trustScore >= 80 ? "proceed" : trustScore >= 60 ? "caution" : "avoid",
      metadata: {
        diversityScore: diversity.diversityScore,
        trendDirection: trend.direction,
        paymentReliability: payment.reliability,
      },
    });

    return NextResponse.json(
      {
        address,
        name: (agent as Record<string, unknown>).name ?? null,
        trustScore,
        profileVerdict,
        behavioral: {
          trend,
          buyerDiversity: diversity,
          payment,
        },
        wadjet: wadjetResult
          ? {
              rugProbability: wadjetResult.rug_probability,
              riskLevel: wadjetResult.risk_level,
              confidence: wadjetResult.confidence,
              note: "Wadjet ML risk assessment for this agent's token",
            }
          : { available: false },
        stats: {
          totalJobs: agent.totalJobs,
          completionRate: agent.completionRate ? Number(agent.completionRate) : null,
          dataSource: (agent as Record<string, unknown>).dataSource ?? "ACP_BEHAVIORAL",
          lastUpdated: (agent as Record<string, unknown>).lastUpdated ?? agent.updatedAt,
        },
        feedback: queryId
          ? { queryId, reportOutcome: "POST /api/v1/outcome" }
          : undefined,
      },
      {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Cache-Control": "public, s-maxage=180, stale-while-revalidate=360",
        },
      }
    );
  } catch (err) {
    console.error("[agent-profile]", err);
    return NextResponse.json(
      { error: "Profile analysis failed" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
