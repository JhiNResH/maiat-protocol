/**
 * GET /api/v1/agent/[address]/deep
 *
 * Enriched trust analysis for a given agent wallet address.
 * Builds on the base /api/v1/agent/[address] data and adds:
 *   - percentile  : % of agents in DB with LOWER trust score
 *   - riskFlags   : rule-based warning flags
 *   - tier        : "veteran" | "active" | "new"
 *   - recommendation : one-line human summary
 *   - category    : rawMetrics.category if available
 *
 * Response shape:
 * {
 *   "address": "0x...",
 *   "trustScore": 85,
 *   "dataSource": "ACP_BEHAVIORAL",
 *   "breakdown": { ... },
 *   "verdict": "proceed",
 *   "lastUpdated": "...",
 *   "deep": {
 *     "percentile": 92,
 *     "tier": "veteran",
 *     "riskFlags": [],
 *     "recommendation": "Reliable agent — safe for high-value tasks",
 *     "category": "ON_CHAIN"
 *   }
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { logQueryAsync } from "@/lib/query-logger";
import { isAddress, getAddress } from "viem";
import { prisma } from "@/lib/prisma";
import { computeTrustScore, type AcpAgent } from "@/lib/acp-indexer";

const ACP_AGENTS_URL = "https://acpx.virtuals.io/api/agents";

// ─── Types ────────────────────────────────────────────────────────────────────

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

type RiskFlag =
  | "low_job_count"
  | "high_expire_rate"
  | "low_completion"
  | "low_payment"
  | "new_agent";

type Tier = "veteran" | "active" | "new";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map trust score to a human-readable verdict */
function scoreToVerdict(score: number): "proceed" | "caution" | "avoid" {
  if (score >= 80) return "proceed";
  if (score >= 60) return "caution";
  return "avoid";
}

/** Extract ageWeeks from rawMetrics.firstJobTimestamp */
function extractAgeWeeks(rawMetrics: unknown): number | null {
  try {
    const raw = rawMetrics as { firstJobTimestamp?: number | null } | null;
    if (raw?.firstJobTimestamp) {
      const nowSec = Math.floor(Date.now() / 1000);
      return Math.floor((nowSec - raw.firstJobTimestamp) / (7 * 86_400));
    }
  } catch {
    // ignore
  }
  return null;
}

/** Compute percentile: % of agents with LOWER trust score than this agent */
async function computePercentile(trustScore: number): Promise<number> {
  const [below, total] = await Promise.all([
    prisma.agentScore.count({ where: { trustScore: { lt: trustScore } } }),
    prisma.agentScore.count(),
  ]);
  if (total === 0) return 100;
  return Math.round((below / total) * 100);
}

/** Rule-based risk flags */
function computeRiskFlags(params: {
  totalJobs:      number;
  expireRate:     number;
  completionRate: number;
  paymentRate:    number;
  ageWeeks:       number | null;
}): RiskFlag[] {
  const flags: RiskFlag[] = [];
  if (params.totalJobs < 10)               flags.push("low_job_count");
  if (params.expireRate > 0.2)             flags.push("high_expire_rate");
  if (params.completionRate < 0.7)         flags.push("low_completion");
  if (params.paymentRate < 0.7)            flags.push("low_payment");
  if (params.ageWeeks !== null && params.ageWeeks < 4) flags.push("new_agent");
  return flags;
}

/** Tier classification */
function computeTier(trustScore: number, totalJobs: number): Tier {
  if (trustScore >= 80 && totalJobs >= 50) return "veteran";
  if (trustScore >= 60 && totalJobs >= 10) return "active";
  return "new";
}

/** One-line recommendation */
function computeRecommendation(
  trustScore: number,
  riskFlags: RiskFlag[]
): string {
  const hasHighRisk =
    riskFlags.includes("low_completion") || riskFlags.includes("low_payment");

  if (trustScore >= 80 && riskFlags.length === 0) {
    return "Reliable agent — safe for high-value tasks";
  }
  if (trustScore >= 60 && !hasHighRisk) {
    return "Active agent — suitable for routine tasks, monitor closely";
  }
  if (trustScore >= 40 || (!hasHighRisk && riskFlags.length <= 2)) {
    return "New or low-activity agent — use only for low-risk tasks";
  }
  return "High-risk agent — avoid unless necessary";
}

// ─── On-demand lookup ─────────────────────────────────────────────────────────

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

    return await prisma.agentScore.upsert({
      where:  { walletAddress: checksumAddress },
      update: {
        trustScore:     score.trustScore,
        completionRate: score.completionRate,
        paymentRate:    score.paymentRate,
        expireRate:     score.expireRate,
        totalJobs:      score.totalJobs,
        dataSource:     "ACP_BEHAVIORAL",
        rawMetrics:     ((agent as unknown as { metrics?: object }).metrics) ?? {},
      },
      create: {
        walletAddress:  checksumAddress,
        trustScore:     score.trustScore,
        completionRate: score.completionRate,
        paymentRate:    score.paymentRate,
        expireRate:     score.expireRate,
        totalJobs:      score.totalJobs,
        dataSource:     "ACP_BEHAVIORAL",
        rawMetrics:     ((agent as unknown as { metrics?: object }).metrics) ?? {},
      },
    });
  } catch {
    return null;
  }
}

// ─── Response Builder ─────────────────────────────────────────────────────────

async function buildDeepResponse(
  checksumAddress: string,
  record: AgentScoreRecord,
  request?: NextRequest
): Promise<NextResponse> {
  const ageWeeks = extractAgeWeeks(record.rawMetrics);
  const verdict  = scoreToVerdict(record.trustScore);

  // Compute deep enrichments (percentile requires a DB query)
  const [percentile] = await Promise.all([
    computePercentile(record.trustScore),
  ]);

  const riskFlags     = computeRiskFlags({
    totalJobs:      record.totalJobs,
    expireRate:     record.expireRate,
    completionRate: record.completionRate,
    paymentRate:    record.paymentRate,
    ageWeeks,
  });
  const tier           = computeTier(record.trustScore, record.totalJobs);
  const recommendation = computeRecommendation(record.trustScore, riskFlags);

  // Extract category from rawMetrics if present
  let category: string | null = null;
  try {
    const raw = record.rawMetrics as { category?: string } | null;
    if (typeof raw?.category === "string") category = raw.category;
  } catch { /* ignore */ }

  // Async query log — returns queryId for feedback loop
  const callerIp = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request?.headers.get("x-real-ip") || undefined;
  const userAgent = request?.headers.get("user-agent") || undefined;
  const clientId = request?.headers.get("x-maiat-client") ?? undefined;
  const queryId = await logQueryAsync({
    type:       "agent_deep_check",
    target:     checksumAddress,
    trustScore: record.trustScore,
    verdict,
    clientId,
    callerIp,
    userAgent,
    metadata:   { totalJobs: record.totalJobs, dataSource: record.dataSource, tier },
  });

  return NextResponse.json(
    {
      address:    checksumAddress,
      trustScore: record.trustScore,
      dataSource: record.dataSource,
      breakdown: {
        completionRate: record.completionRate,
        paymentRate:    record.paymentRate,
        expireRate:     record.expireRate,
        totalJobs:      record.totalJobs,
        ageWeeks,
      },
      verdict,
      lastUpdated: record.lastUpdated.toISOString(),
      deep: {
        percentile,
        tier,
        riskFlags,
        recommendation,
        category,
      },
      ...(queryId && {
        feedback: {
          queryId,
          reportOutcome: `POST /api/v1/outcome { "jobId": "${queryId}", "outcome": "success|failure|partial", "reporter": "<your-wallet>" }`,
          note: "Report outcome to improve oracle accuracy.",
        },
      }),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
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

    const checksumAddress = getAddress(rawAddress);

    // ── DB lookup ─────────────────────────────────────────────────────────────
    let record = await prisma.agentScore.findUnique({
      where: { walletAddress: checksumAddress },
    });

    if (!record) {
      record = await prisma.agentScore.findFirst({
        where: {
          walletAddress: { equals: rawAddress.toLowerCase(), mode: "insensitive" },
        },
      });
    }

    if (!record) {
      // On-demand fetch from Virtuals API
      const onDemand = await fetchAndIndexAgent(checksumAddress);
      if (onDemand) {
        return buildDeepResponse(checksumAddress, onDemand, request);
      }

      // Truly unknown
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
          deep:        null,
        },
        {
          status:  404,
          headers: { "Cache-Control": "public, s-maxage=60" },
        }
      );
    }

    return buildDeepResponse(checksumAddress, record, request);

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Agent Deep API] Error:", msg);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
