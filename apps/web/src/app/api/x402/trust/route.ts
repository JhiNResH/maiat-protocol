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
import { isAddress, getAddress } from "viem";
import { prisma } from "@/lib/prisma";
import { logQuery } from "@/lib/query-logger";

// CORS headers — payment gate is handled by middleware.ts
const X402_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Payment, X-Payment-Response, Payment-Signature, Payment-Required",
  "x-powered-by": "maiat-x402",
  "x-payment-protocol": "x402",
} as const;

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
    logQuery({
      type: "agent_trust",
      target: checksumAddress.toLowerCase(),
      trustScore: agent.trustScore,
      verdict: v,
      callerIp: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
      metadata: { endpoint: "/api/x402/trust", resultType: "agent", paid: true },
    });
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
    logQuery({
      type: "token_check",
      target: checksumAddress.toLowerCase(),
      trustScore: score,
      verdict: v,
      callerIp: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
      metadata: { endpoint: "/api/x402/trust", resultType: "token", paid: true, projectName: project.name },
    });
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

import { withPaymentGate } from "@/lib/x402-gate";

export const GET = withPaymentGate(trustHandler, "$0.02", "Trust score lookup for agents and tokens", "agent_trust", {
  input: { queryParams: { address: { type: "string", description: "Ethereum address (agent or token)" } } },
  output: {
    example: { trustScore: 85, verdict: "proceed", summary: "Reliable ACP agent — 42 jobs, 95% completion" },
    schema: { properties: { trustScore: { type: "number" }, verdict: { type: "string" }, summary: { type: "string" } }, required: ["trustScore", "verdict"] },
  },
}, "/api/x402/trust");

export const POST = withPaymentGate(trustHandler, "$0.02", "Trust score lookup for agents and tokens", "agent_trust", {
  input: { queryParams: { address: { type: "string", description: "Ethereum address (agent or token)" } } },
  output: {
    example: { trustScore: 85, verdict: "proceed", summary: "Reliable ACP agent — 42 jobs, 95% completion" },
    schema: { properties: { trustScore: { type: "number" }, verdict: { type: "string" }, summary: { type: "string" } }, required: ["trustScore", "verdict"] },
  },
}, "/api/x402/trust");
