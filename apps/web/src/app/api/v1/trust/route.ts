/**
 * GET /api/v1/trust?address=0x...
 *
 * Unified simplified trust score — works for agents AND tokens.
 * No auth required. Rate limit: 20 req/day per IP.
 *
 * Response:
 * {
 *   "address": "0x...",
 *   "type": "agent" | "token" | "unknown",
 *   "trustScore": 52,
 *   "verdict": "proceed" | "caution" | "avoid",
 *   "summary": "Active ACP agent — 7 jobs, 87.5% completion",
 *   "learnMore": "GET /api/v1/agent/0x... for full breakdown"
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import { prisma } from "@/lib/prisma";
import { createRateLimiter, checkIpRateLimit } from "@/lib/ratelimit";
import { logQuery } from "@/lib/query-logger";

export const dynamic = "force-dynamic";

const rateLimiter = createRateLimiter("trust:simple", 20, 86400); // 20/day per IP

function verdict(score: number): "proceed" | "caution" | "avoid" {
  if (score >= 80) return "proceed";
  if (score >= 60) return "caution";
  return "avoid";
}

function agentSummary(score: number, totalJobs: number, completionRate: number): string {
  if (totalJobs === 0) return "No ACP job history found.";
  const pct = Math.round(completionRate * 100);
  if (score >= 80) return `Reliable ACP agent — ${totalJobs} jobs, ${pct}% completion`;
  if (score >= 60) return `Active ACP agent — ${totalJobs} jobs, ${pct}% completion`;
  return `Low-trust agent — ${totalJobs} jobs, ${pct}% completion`;
}

export async function GET(request: NextRequest) {
  // Rate limit
  const { success: ok } = await checkIpRateLimit(request, rateLimiter);
  if (!ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Max 20 requests/day per IP." },
      { status: 429 }
    );
  }

  const address = request.nextUrl.searchParams.get("address");

  if (!address || !isAddress(address)) {
    return NextResponse.json(
      { error: "Missing or invalid address. Use ?address=0x..." },
      { status: 400 }
    );
  }

  const checksumAddress = getAddress(address);

  // 1. Try agent score first (ACP behavioral)
  const agent = await prisma.agentScore.findFirst({
    where: {
      walletAddress: { equals: checksumAddress, mode: "insensitive" },
    },
    select: {
      walletAddress: true,
      trustScore: true,
      completionRate: true,
      totalJobs: true,
    },
  });

  if (agent) {
    const v = verdict(agent.trustScore);
    logQuery({
      type: "agent_trust",
      target: checksumAddress.toLowerCase(),
      trustScore: agent.trustScore,
      verdict: v,
      callerIp: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
      metadata: { endpoint: "/api/v1/trust", resultType: "agent" },
    });
    return NextResponse.json(
      {
        address: checksumAddress,
        type: "agent",
        trustScore: agent.trustScore,
        verdict: v,
        summary: agentSummary(agent.trustScore, agent.totalJobs, agent.completionRate),
        learnMore: `GET /api/v1/agent/${checksumAddress}`,
      },
      {
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
      }
    );
  }

  // 2. Try project/token table
  const project = await prisma.project.findFirst({
    where: {
      address: { equals: checksumAddress, mode: "insensitive" },
    },
    select: {
      address: true,
      name: true,
      trustScore: true,
      category: true,
    },
  });

  if (project) {
    const score = project.trustScore ?? 50;
    const v = verdict(score);
    logQuery({
      type: "token_check",
      target: checksumAddress.toLowerCase(),
      trustScore: score,
      verdict: v,
      callerIp: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
      metadata: { endpoint: "/api/v1/trust", resultType: "token", projectName: project.name },
    });
    return NextResponse.json(
      {
        address: checksumAddress,
        type: "token",
        trustScore: score,
        verdict: v,
        summary: `${project.name ?? checksumAddress} — ${project.category ?? "unknown"} on Base`,
        learnMore: `GET /api/v1/token/${checksumAddress}`,
      },
      {
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
      }
    );
  }

  // 3. Unknown
  return NextResponse.json(
    {
      address: checksumAddress,
      type: "unknown",
      trustScore: null,
      verdict: "unknown",
      summary: "No data found. Address not indexed as agent or token.",
      learnMore: `GET /api/v1/agent/${checksumAddress} or GET /api/v1/token/${checksumAddress}`,
    },
    { status: 200 }
  );
}
