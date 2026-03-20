/**
 * GET /api/x402/trust?address=0x...
 *
 * x402 Payment-Protected Trust Score Endpoint
 * Price: $0.02 per request
 *
 * Returns unified trust score for agents AND tokens.
 * No rate limiting (x402 payment IS the rate limit).
 */

import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { isAddress, getAddress } from "viem";
import { prisma } from "@/lib/prisma";
import {
  x402Server,
  X402_PRICES,
  createRouteConfig,
  X402_CORS_HEADERS,
} from "@/lib/x402-server";

export const dynamic = "force-dynamic";

// Verdict helper
function verdict(score: number): "proceed" | "caution" | "avoid" {
  if (score >= 80) return "proceed";
  if (score >= 60) return "caution";
  return "avoid";
}

function agentSummary(
  score: number,
  totalJobs: number,
  completionRate: number
): string {
  if (totalJobs === 0) return "No ACP job history found.";
  const pct = Math.round(completionRate * 100);
  if (score >= 80) return `Reliable ACP agent — ${totalJobs} jobs, ${pct}% completion`;
  if (score >= 60) return `Active ACP agent — ${totalJobs} jobs, ${pct}% completion`;
  return `Low-trust agent — ${totalJobs} jobs, ${pct}% completion`;
}

// OPTIONS handler for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: X402_CORS_HEADERS });
}

// Core handler logic (reused from v1/trust)
async function trustHandler(request: NextRequest): Promise<NextResponse<unknown>> {
  const address = request.nextUrl.searchParams.get("address");

  if (!address || !isAddress(address)) {
    return NextResponse.json(
      { error: "Missing or invalid address. Use ?address=0x..." },
      { status: 400, headers: X402_CORS_HEADERS }
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
    return NextResponse.json(
      {
        address: checksumAddress,
        type: "agent",
        trustScore: agent.trustScore,
        verdict: v,
        summary: agentSummary(agent.trustScore, agent.totalJobs, agent.completionRate),
        learnMore: `GET /api/x402/reputation?address=${checksumAddress}`,
      },
      { headers: X402_CORS_HEADERS }
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
    return NextResponse.json(
      {
        address: checksumAddress,
        type: "token",
        trustScore: score,
        verdict: v,
        summary: `${project.name ?? checksumAddress} — ${project.category ?? "unknown"} on Base`,
        learnMore: `GET /api/x402/token-check?address=${checksumAddress}`,
      },
      { headers: X402_CORS_HEADERS }
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
      learnMore: `GET /api/x402/reputation?address=${checksumAddress} or GET /api/x402/token-check?address=${checksumAddress}`,
    },
    { status: 404, headers: X402_CORS_HEADERS }
  );
}

// Wrap with x402 payment protection
export const GET = withX402(
  trustHandler,
  createRouteConfig(X402_PRICES.trust, "Trust score lookup for agents and tokens"),
  x402Server
);
