/**
 * GET /api/x402/reputation?address=0x...
 *
 * x402 Payment-Protected Agent Reputation Endpoint
 * Price: $0.03 per request
 *
 * Returns full ACP behavioral trust score breakdown for an agent.
 * No rate limiting (x402 payment IS the rate limit).
 */

import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import { prisma } from "@/lib/prisma";
import { computeTrustScore, getBlendedTrustScore, type AcpAgent } from "@/lib/acp-indexer";
import { getERC8004Data, type ERC8004Data } from "@/lib/erc8004";
// CORS headers — payment gate is handled by middleware.ts
const X402_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Payment, X-Payment-Response, Payment-Signature, Payment-Required",
  "x-powered-by": "maiat-x402",
  "x-payment-protocol": "x402",
} as const;

export const dynamic = "force-dynamic";

const ACP_AGENTS_URL = "https://acpx.virtuals.io/api/agents";

// Map trust score to verdict
function scoreToVerdict(score: number): "trusted" | "proceed" | "caution" | "avoid" {
  if (score >= 80) return "trusted";
  if (score >= 60) return "proceed";
  if (score >= 40) return "caution";
  return "avoid";
}

// Generate analysis summary
function generateAnalysis(
  score: number,
  _verdict: string,
  totalJobs: number,
  completionRate: number,
  expireRate: number,
  uniqueBuyerCount: number | null,
  name: string | null
): string {
  const agentName = name || "This agent";
  const parts: string[] = [];

  if (score >= 80) {
    parts.push(`${agentName} is a highly reliable ACP agent with a strong track record.`);
  } else if (score >= 60) {
    parts.push(
      `${agentName} shows mixed reliability — some successful jobs but notable concerns.`
    );
  } else if (totalJobs > 0) {
    parts.push(
      `${agentName} has a poor track record and should be engaged with extreme caution.`
    );
  } else {
    parts.push(
      `${agentName} has no job history on ACP yet — trust cannot be determined from behavioral data.`
    );
    return parts[0];
  }

  if (totalJobs >= 50)
    parts.push(
      `With ${totalJobs} completed jobs, there is strong statistical confidence in this score.`
    );
  else if (totalJobs >= 10)
    parts.push(`${totalJobs} jobs provide moderate confidence — score may shift with more data.`);
  else if (totalJobs > 0)
    parts.push(`Only ${totalJobs} jobs recorded — limited data, score is preliminary.`);

  if (completionRate >= 0.95) parts.push("Excellent completion rate — rarely abandons jobs.");
  else if (completionRate < 0.5)
    parts.push("Low completion rate is a red flag — frequently fails to deliver.");

  if (expireRate > 0.2)
    parts.push(
      `High expire rate (${(expireRate * 100).toFixed(0)}%) suggests the agent often lets jobs time out.`
    );

  if (uniqueBuyerCount !== null && uniqueBuyerCount >= 5) {
    parts.push(
      `Trusted by ${uniqueBuyerCount} unique buyers — indicates broad market acceptance.`
    );
  }

  return parts.join(" ");
}

// ERC-8004 data lookup (safe)
async function fetchERC8004DataSafe(address: string): Promise<ERC8004Data> {
  try {
    return await getERC8004Data(address);
  } catch (err) {
    console.error("[x402/reputation] ERC-8004 lookup failed:", err);
    return null;
  }
}

// On-demand lookup from Virtuals API
interface AgentScoreRecord {
  walletAddress: string;
  trustScore: number;
  completionRate: number;
  paymentRate: number;
  expireRate: number;
  totalJobs: number;
  dataSource: string;
  lastUpdated: Date;
  rawMetrics: unknown;
}

async function fetchAndIndexAgent(
  checksumAddress: string
): Promise<AgentScoreRecord | null> {
  try {
    const url = `${ACP_AGENTS_URL}?filters[walletAddress]=${checksumAddress}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;

    const json = (await res.json()) as { data?: AcpAgent[] };
    const agent = json.data?.[0];
    if (!agent?.walletAddress) return null;

    const score = computeTrustScore(agent);

    // Upsert into DB for future cache
    const upserted = await prisma.agentScore.upsert({
      where: { walletAddress: checksumAddress },
      update: {
        trustScore: score.trustScore,
        completionRate: score.completionRate,
        paymentRate: score.paymentRate,
        expireRate: score.expireRate,
        totalJobs: score.totalJobs,
        dataSource: "ACP_BEHAVIORAL",
        rawMetrics: JSON.parse(JSON.stringify(agent ?? {})),
      },
      create: {
        walletAddress: checksumAddress,
        trustScore: score.trustScore,
        completionRate: score.completionRate,
        paymentRate: score.paymentRate,
        expireRate: score.expireRate,
        totalJobs: score.totalJobs,
        dataSource: "ACP_BEHAVIORAL",
        rawMetrics: JSON.parse(JSON.stringify(agent ?? {})),
      },
    });

    return upserted;
  } catch {
    return null;
  }
}

// Build response from record
async function buildResponse(
  checksumAddress: string,
  record: AgentScoreRecord
): Promise<NextResponse> {
  // Calculate ageWeeks from rawMetrics if available
  let ageWeeks: number | null = null;
  try {
    const raw = record.rawMetrics as {
      firstJobTimestamp?: number | null;
    } | null;
    if (raw?.firstJobTimestamp) {
      const nowSec = Math.floor(Date.now() / 1000);
      const ageSec = nowSec - raw.firstJobTimestamp;
      ageWeeks = Math.floor(ageSec / (7 * 86_400));
    }
  } catch {
    // rawMetrics may not have expected shape; that's fine
  }

  // Blend on-chain score with outcome history
  const blended = await getBlendedTrustScore(
    checksumAddress,
    record.trustScore,
    prisma
  );

  const finalTrustScore = blended.blendedScore;
  const verdict = scoreToVerdict(finalTrustScore);

  // Extract enrichment data from rawMetrics
  const raw = record.rawMetrics as Record<string, unknown> | null;
  const name = (raw?.name as string) || null;
  const profilePic = (raw?.profilePic as string) || null;
  const category = (raw?.category as string) || null;
  const description = (raw?.description as string) || null;
  const uniqueBuyerCount = (raw?.uniqueBuyerCount as number) ?? null;
  const successRate = (raw?.successRate as number) ?? null;

  // Generate analysis summary
  const analysis = generateAnalysis(
    finalTrustScore,
    verdict,
    record.totalJobs,
    record.completionRate,
    record.expireRate,
    uniqueBuyerCount,
    name
  );

  // Fetch ERC-8004 data
  const erc8004Data = await fetchERC8004DataSafe(checksumAddress);

  return NextResponse.json(
    {
      address: checksumAddress,
      name,
      profilePic,
      category,
      description,
      trustScore: finalTrustScore,
      dataSource: record.dataSource,
      breakdown: {
        completionRate: record.completionRate,
        paymentRate: record.paymentRate,
        expireRate: record.expireRate,
        totalJobs: record.totalJobs,
        ageWeeks,
        uniqueBuyerCount,
        successRate,
        agdp: (raw?.grossAgenticAmount as number) ?? null,
        revenue: (raw?.revenue as number) ?? null,
        transactionCount: (raw?.transactionCount as number) ?? null,
        outcomeCount: blended.outcomeCount,
        chainIntegrity: blended.chainIntegrity,
        onchainScore: blended.onchainScore,
      },
      verdict,
      analysis,
      lastUpdated: record.lastUpdated.toISOString(),
      erc8004: erc8004Data ?? null,
    },
    { headers: X402_CORS_HEADERS }
  );
}

// OPTIONS handler for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: X402_CORS_HEADERS });
}

// Core handler logic
async function reputationHandler(request: NextRequest): Promise<NextResponse<unknown>> {
  try {
    const rawAddress = request.nextUrl.searchParams.get("address");

    if (!rawAddress || !isAddress(rawAddress)) {
      return NextResponse.json(
        {
          error: "Invalid address",
          message: "Please provide a valid EVM wallet address (0x...)",
        },
        { status: 400, headers: X402_CORS_HEADERS }
      );
    }

    const checksumAddress = getAddress(rawAddress);

    // Query database
    let record = await prisma.agentScore.findUnique({
      where: { walletAddress: checksumAddress },
    });

    if (!record) {
      // Try lowercase
      record = await prisma.agentScore.findFirst({
        where: {
          walletAddress: {
            equals: rawAddress.toLowerCase(),
            mode: "insensitive",
          },
        },
      });

      if (!record) {
        // On-demand lookup from Virtuals API
        const onDemand = await fetchAndIndexAgent(checksumAddress);
        if (onDemand) {
          return await buildResponse(checksumAddress, onDemand);
        }

        // Truly unknown
        const erc8004Data = await fetchERC8004DataSafe(checksumAddress);
        return NextResponse.json(
          {
            address: checksumAddress,
            trustScore: null,
            dataSource: "ACP_BEHAVIORAL",
            breakdown: null,
            verdict: "unknown",
            message:
              "This address has no ACP history on Virtuals. " +
              "They may not be registered as an ACP agent yet.",
            lastUpdated: null,
            erc8004: erc8004Data,
          },
          { status: 404, headers: X402_CORS_HEADERS }
        );
      }
    }

    return await buildResponse(checksumAddress, record);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[x402/reputation] Error:", msg);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: X402_CORS_HEADERS }
    );
  }
}

import { withPaymentGate } from "@/lib/x402-gate";

// Wrap with manual x402 payment gate
// Payment gate handled by middleware.ts — export handler directly
export const GET = withPaymentGate(reputationHandler, "$0.03", "Full agent reputation and behavioral trust score", "agent_trust", {
  input: { queryParams: { address: { type: "string", description: "Agent address" } } },
  output: {
    example: { trustScore: 85, sentiment: "positive", endorsements: 12, upvoteRatio: 0.92 },
    schema: { properties: { trustScore: { type: "number" }, sentiment: { type: "string" }, endorsements: { type: "number" } }, required: ["trustScore", "sentiment"] },
  },
});
