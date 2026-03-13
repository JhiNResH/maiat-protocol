/**
 * GET /api/v1/agent/[address]
 *
 * Returns ACP behavioral trust score for a given agent wallet address.
 * Data is sourced from Virtuals ACP on-chain job history (indexed via acp-indexer.ts).
 *
 * Response format:
 * {
 *   "address": "0x...",
 *   "trustScore": 72,
 *   "dataSource": "ACP_BEHAVIORAL",
 *   "breakdown": {
 *     "completionRate": 0.95,
 *     "paymentRate": 0.98,
 *     "expireRate": 0.02,
 *     "totalJobs": 47,
 *     "ageWeeks": 12
 *   },
 *   "verdict": "proceed",
 *   "lastUpdated": "2026-02-28T..."
 * }
 *
 * verdict:
 *   >= 80 → "proceed"
 *   60–79 → "caution"
 *   < 60  → "avoid"
 *   null  → "unknown" (not indexed yet)
 */

import { NextRequest, NextResponse } from "next/server";
import { logQueryAsync } from "@/lib/query-logger";
import { createRateLimiter, checkIpRateLimit } from "@/lib/ratelimit";
import { isAddress, getAddress } from "viem";
import { prisma } from "@/lib/prisma";
import { computeTrustScore, getBlendedTrustScore, type AcpAgent } from "@/lib/acp-indexer";
import { getERC8004Data, type ERC8004Data } from "@/lib/erc8004";

const ACP_AGENTS_URL = "https://acpx.virtuals.io/api/agents";

/**
 * On-demand lookup: fetch a single agent from Virtuals API by wallet address.
 * Uses the noAuth /api/agents?filters[walletAddress]=<addr> endpoint.
 * If found, computes trust score and upserts into DB.
 */
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
      where:  { walletAddress: checksumAddress },
      update: {
        trustScore:     score.trustScore,
        completionRate: score.completionRate,
        paymentRate:    score.paymentRate,
        expireRate:     score.expireRate,
        totalJobs:      score.totalJobs,
        dataSource:     "ACP_BEHAVIORAL",
        rawMetrics:     JSON.parse(JSON.stringify(agent ?? {})),
      },
      create: {
        walletAddress:  checksumAddress,
        trustScore:     score.trustScore,
        completionRate: score.completionRate,
        paymentRate:    score.paymentRate,
        expireRate:     score.expireRate,
        totalJobs:      score.totalJobs,
        dataSource:     "ACP_BEHAVIORAL",
        rawMetrics:     JSON.parse(JSON.stringify(agent ?? {})),
      },
    });

    return upserted;
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";

const agentRateLimiter = createRateLimiter("agent:trust", 600, 60); // 10 req/sec per IP — only blocks actual DDoS

/** Map trust score to a human-readable verdict */
function scoreToVerdict(score: number): "proceed" | "caution" | "avoid" {
  if (score >= 80) return "proceed";
  if (score >= 60) return "caution";
  return "avoid";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    // ── Rate limit ────────────────────────────────────────────────────────────
    const { success: rlOk } = await checkIpRateLimit(request, agentRateLimiter);
    if (!rlOk) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Max 30 requests/min per IP.", retryAfter: 60 },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    // ── Validate address ─────────────────────────────────────────────────────
    const { address: rawAddress } = await params;

    if (!rawAddress || !isAddress(rawAddress)) {
      return NextResponse.json(
        {
          error:   "Invalid address",
          message: "Please provide a valid EVM wallet address (0x...)",
        },
        { status: 400 }
      );
    }

    // Normalize to checksum address
    const checksumAddress = getAddress(rawAddress);

    // ── Query Supabase ────────────────────────────────────────────────────────
    const record = await prisma.agentScore.findUnique({
      where: { walletAddress: checksumAddress },
    });

    // ── Not indexed yet ───────────────────────────────────────────────────────
    if (!record) {
      // Also try lowercase (in case indexer stored it lowercase)
      const recordLower = await prisma.agentScore.findFirst({
        where: {
          walletAddress: {
            equals: rawAddress.toLowerCase(),
            mode:   "insensitive",
          },
        },
      });

      if (!recordLower) {
        // ── On-demand lookup from Virtuals API ──────────────────────────────
        const onDemand = await fetchAndIndexAgent(checksumAddress);
        if (onDemand) {
          // Fetch ERC-8004 data in parallel (non-blocking)
          const erc8004Data = await fetchERC8004DataSafe(checksumAddress);
          return await buildResponse(checksumAddress, onDemand, request, erc8004Data);
        }

        // Truly unknown — not in DB, not in Virtuals API
        // Still try to get ERC-8004 data
        const erc8004Data = await fetchERC8004DataSafe(checksumAddress);
        return NextResponse.json(
          {
            address:     checksumAddress,
            trustScore:  null,
            dataSource:  "ACP_BEHAVIORAL",
            breakdown:   null,
            verdict:     "unknown",
            message:
              "This address has no ACP history on Virtuals. " +
              "They may not be registered as an ACP agent yet.",
            lastUpdated: null,
            erc8004: erc8004Data,
          },
          {
            status:  404,
            headers: { "Cache-Control": "public, s-maxage=60" },
          }
        );
      }

      // Use the case-insensitive match
      const erc8004DataLower = await fetchERC8004DataSafe(checksumAddress);
      return await buildResponse(checksumAddress, recordLower, request, erc8004DataLower);
    }

    // Fetch ERC-8004 data (non-blocking)
    const erc8004Data = await fetchERC8004DataSafe(checksumAddress);
    return await buildResponse(checksumAddress, record, request, erc8004Data);

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Agent Trust API] Error:", msg);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── Analysis Generator ───────────────────────────────────────────────────────

function generateAnalysis(
  score: number,
  verdict: string,
  totalJobs: number,
  completionRate: number,
  expireRate: number,
  uniqueBuyerCount: number | null,
  name: string | null
): string {
  const agentName = name || "This agent";
  const parts: string[] = [];

  // Overall assessment
  if (score >= 80) {
    parts.push(`${agentName} is a highly reliable ACP agent with a strong track record.`);
  } else if (score >= 60) {
    parts.push(`${agentName} shows mixed reliability — some successful jobs but notable concerns.`);
  } else if (totalJobs > 0) {
    parts.push(`${agentName} has a poor track record and should be engaged with extreme caution.`);
  } else {
    parts.push(`${agentName} has no job history on ACP yet — trust cannot be determined from behavioral data.`);
    return parts[0];
  }

  // Job volume
  if (totalJobs >= 50) parts.push(`With ${totalJobs} completed jobs, there is strong statistical confidence in this score.`);
  else if (totalJobs >= 10) parts.push(`${totalJobs} jobs provide moderate confidence — score may shift with more data.`);
  else if (totalJobs > 0) parts.push(`Only ${totalJobs} jobs recorded — limited data, score is preliminary.`);

  // Key strengths/weaknesses
  if (completionRate >= 0.95) parts.push("Excellent completion rate — rarely abandons jobs.");
  else if (completionRate < 0.5) parts.push("Low completion rate is a red flag — frequently fails to deliver.");

  if (expireRate > 0.2) parts.push(`High expire rate (${(expireRate * 100).toFixed(0)}%) suggests the agent often lets jobs time out.`);

  if (uniqueBuyerCount !== null && uniqueBuyerCount >= 5) {
    parts.push(`Trusted by ${uniqueBuyerCount} unique buyers — indicates broad market acceptance.`);
  }

  return parts.join(" ");
}

// ─── Response Builder ─────────────────────────────────────────────────────────

interface AgentScoreRecord {
  walletAddress:  string;
  trustScore:     number;
  completionRate: number;
  paymentRate:    number;
  expireRate:     number;
  totalJobs:      number;
  dataSource:     string;
  lastUpdated:    Date;
  rawMetrics:     unknown;
}

// ─── ERC-8004 Lookup (Non-blocking) ────────────────────────────────────────────

async function fetchERC8004DataSafe(address: string): Promise<ERC8004Data> {
  try {
    return await getERC8004Data(address);
  } catch (err) {
    console.error("[Agent Trust API] ERC-8004 lookup failed:", err);
    return null;
  }
}

async function buildResponse(
  checksumAddress: string,
  record: AgentScoreRecord,
  request: NextRequest,
  erc8004Data?: ERC8004Data
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

  // Phase 1C: Blend on-chain score with outcome history
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
  const analysis = generateAnalysis(finalTrustScore, verdict, record.totalJobs, record.completionRate, record.expireRate, uniqueBuyerCount, name);

  // Log for training data — async to get queryId for feedback loop
  const clientId = request.headers.get("x-maiat-client") ?? undefined;
  const framework = request.headers.get("x-maiat-framework") ?? undefined;
  const callerIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || undefined;
  const userAgent = request.headers.get("user-agent") || undefined;

  // Auto-assign wallet for caller (async, non-blocking)
  let callerWallet: string | null = null;
  if (clientId) {
    try {
      const { getCallerWallet } = await import("@/lib/caller-wallet");
      callerWallet = await getCallerWallet(clientId);
    } catch {
      // Non-critical — wallet assignment failure doesn't block response
    }
  }
  const queryId = await logQueryAsync({
    type: "agent_trust",
    target: checksumAddress,
    trustScore: finalTrustScore,
    verdict,
    clientId,
    framework,
    callerIp,
    userAgent,
    metadata: {
      totalJobs: record.totalJobs,
      dataSource: record.dataSource,
      outcomeCount: blended.outcomeCount,
      chainIntegrity: blended.chainIntegrity,
      onchainScore: blended.onchainScore,
    },
  });

  return NextResponse.json(
    {
      address:    checksumAddress,
      name,
      profilePic,
      category,
      description,
      trustScore: finalTrustScore,
      dataSource: record.dataSource,
      breakdown: {
        completionRate: record.completionRate,
        paymentRate:    record.paymentRate,
        expireRate:     record.expireRate,
        totalJobs:      record.totalJobs,
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
      ...(queryId && {
        feedback: {
          queryId,
          reportOutcome: `POST /api/v1/outcome { "jobId": "${queryId}", "outcome": "success|failure|partial", "reporter": "${callerWallet || '<your-wallet>'}" }`,
          ...(callerWallet && { yourWallet: callerWallet }),
          note: "Report outcome to improve oracle accuracy. Outcomes refine trust scores over time.",
        },
      }),
      _outcomeReporting: {
        endpoint: "POST /api/v1/outcome",
        required: { jobId: `from this response's queryId${queryId ? ` (${queryId})` : ""}`, agentAddress: checksumAddress, outcome: "success|failure|partial|expired", txHash: "on-chain tx hash" },
        headers: { "X-Maiat-Client": "your-client-id" },
        reward: "+2 🪲 Scarab per outcome reported",
      },
      // ERC-8004 on-chain identity & reputation
      erc8004: erc8004Data ?? null,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}
