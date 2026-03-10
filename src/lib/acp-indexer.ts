/**
 * src/lib/acp-indexer.ts
 *
 * ACP Behavioral Trust Score Indexer (Virtuals REST API version)
 * ==============================================================
 * Fetches ALL agents from Virtuals ACP via REST API,
 * computes behavioral trust scores, and upserts into Supabase.
 *
 * Data source: http://acpx.virtuals.io/api/agents/v5/search
 * Fields used: successfulJobCount, successRate, uniqueBuyerCount, isOnline
 *
 * Exported for use by:
 *   - scripts/acp-indexer.ts (CLI)
 *   - /api/v1/cron/index-agents (Vercel Cron)
 */

import { PrismaClient } from "@prisma/client";

// ─── Config ───────────────────────────────────────────────────────────────────

const LIST_URL = "https://acpx.virtuals.io/api/agents";
const PAGE_SIZE = 25;   // API max per page
const MAX_PAGES = 800;  // safety cap — covers ~20,000 agents

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AcpAgent {
  id: number;
  name: string;
  walletAddress: string;
  category?: string | null;
  description?: string | null;
  successfulJobCount?: number | null;
  successRate?: number | null;
  uniqueBuyerCount?: number | null;
  createdAt?: string | null;
  profilePic?: string | null;
  twitterHandle?: string | null;
  cluster?: string | null;
  offerings?: Array<{ name: string; price: number }> | null;
  grossAgenticAmount?: number | null;
  revenue?: number | null;
  transactionCount?: number | null;
  rating?: number | null;
  tokenAddress?: string | null;
}

export interface AgentScore {
  walletAddress: string;
  name: string;
  trustScore: number;
  completionRate: number;
  paymentRate: number;
  expireRate: number;
  totalJobs: number;
  rawMetrics: object;
}

export interface IndexerResult {
  indexed: number;
  updated: number;
  failed: number;
  stats: {
    totalAgents: number;
    agentsWithJobs: number;
    averageScore: number;
    highScoreCount: number;
    mediumScoreCount: number;
    lowScoreCount: number;
  };
}

export interface IndexerOptions {
  dryRun: boolean;
  prisma?: PrismaClient;
  verbose?: boolean;
}

// ─── Trust Score Formula ──────────────────────────────────────────────────────

export function computeTrustScore(agent: AcpAgent, existingRawMetrics?: Record<string, unknown>): AgentScore {
  // Raw signals (0-1 scale) — fields are flat on agent object (new API format)
  const totalJobs = agent.successfulJobCount ?? 0;
  const successRate = agent.successRate != null ? agent.successRate / 100 : 0; // API gives 0-100
  const buyerCount = agent.uniqueBuyerCount ?? 0;

  // Derived metrics
  const completionRate = successRate; // successRate ≈ completion rate
  const paymentRate = successRate > 0 ? Math.min(successRate * 1.05, 1) : 0; // proxy
  const expireRate = successRate > 0 ? Math.max(1 - successRate - 0.05, 0) : 0.5;

  // Volume factor: log scale, max 1.0 at 50+ jobs
  const volumeFactor = totalJobs > 0 ? Math.min(Math.log10(totalJobs + 1) / Math.log10(51), 1) : 0;

  // Diversity factor: multiple unique buyers = more trustworthy
  const diversityFactor = Math.min(buyerCount / 5, 1);

  // ─── Wadjet Health Signals ───────────────────────────────────────────────
  // Reads priceData + healthSignals from existing DB rawMetrics (indexed by Wadjet)
  
  // 1. Price modifier: -15 to +10 points
  let priceModifier = 0;
  const priceData = existingRawMetrics?.priceData as Record<string, number> | undefined;
  if (priceData && typeof priceData.priceChange24h === 'number') {
    const change24h = priceData.priceChange24h;
    const liquidity = priceData.liquidity ?? 0;

    if (change24h <= -50) priceModifier = -15;
    else if (change24h <= -30) priceModifier = -10;
    else if (change24h <= -15) priceModifier = -5;
    else if (change24h >= 0 && liquidity >= 50000) priceModifier = 10;
    else if (change24h >= -5 && liquidity >= 10000) priceModifier = 5;

    if (liquidity > 0 && liquidity < 1000) priceModifier = Math.min(priceModifier, -5);
  }

  // 2. Health signals modifier: completion trend + LP drain + volatility
  let healthModifier = 0;
  const healthSignals = existingRawMetrics?.healthSignals as Record<string, unknown> | undefined;
  if (healthSignals && typeof healthSignals.totalModifier === 'number') {
    healthModifier = healthSignals.totalModifier;
  }

  // ACP Score (0-100) + Wadjet modifiers (price + health)
  const rawScore =
    completionRate * 40 + // did they finish jobs?
    volumeFactor * 25 +   // how many jobs?
    diversityFactor * 20 + // diverse buyers?
    paymentRate * 15;      // payment proxy

  // Cap total Wadjet modifier to ±20 to prevent overwhelming ACP behavioral data
  const wadjetModifier = Math.max(-20, Math.min(20, priceModifier + healthModifier));
  const score = Math.round(Math.min(Math.max(rawScore + wadjetModifier, 0), 100));

  return {
    walletAddress: agent.walletAddress,
    name: agent.name,
    trustScore: Math.min(Math.max(score, 0), 100),
    completionRate: Math.round(completionRate * 10000) / 10000,
    paymentRate: Math.round(paymentRate * 10000) / 10000,
    expireRate: Math.round(expireRate * 10000) / 10000,
    totalJobs,
    rawMetrics: {
      successfulJobCount: agent.successfulJobCount,
      successRate: agent.successRate,
      uniqueBuyerCount: agent.uniqueBuyerCount,
      category: agent.category,
      description: agent.description,
      agentId: agent.id,
      name: agent.name,
      profilePic: agent.profilePic,
      twitterHandle: agent.twitterHandle,
      cluster: agent.cluster,
      offerings: agent.offerings,
      grossAgenticAmount: agent.grossAgenticAmount,
      revenue: agent.revenue,
      transactionCount: agent.transactionCount,
      rating: agent.rating,
      tokenAddress: agent.tokenAddress,
      indexedAt: new Date().toISOString(),
    },
  };
}

/**
 * Phase 1C: Blend on-chain trust score with outcome history (Maiat v2)
 * - If < 5 outcomes: weight 90% on-chain, 10% outcomes (insufficient data)
 * - If >= 5 outcomes: weight 40% on-chain, 60% outcomes (sufficient data)
 * - If evidence chain is broken: apply -30 penalty
 * 
 * Used by: /api/v1/agent/[address], agent_trust ACP offering
 */
export async function getBlendedTrustScore(
  agentAddress: string,
  onchainScore: number,
  prisma: PrismaClient
): Promise<{
  blendedScore: number;
  onchainScore: number;
  outcomeScore: number | null;
  outcomeCount: number;
  chainIntegrity: boolean;
}> {
  // Fetch outcome history for this agent — case-insensitive to handle
  // checksummed vs lowercase address mismatch in stored records
  const outcomes = await prisma.queryLog.findMany({
    where: {
      target: {
        equals: agentAddress,
        mode: "insensitive",
      },
      outcome: { not: null },
    },
    orderBy: { createdAt: "asc" },
  });

  if (outcomes.length === 0) {
    // No outcome data yet; return on-chain score as-is
    return {
      blendedScore: onchainScore,
      onchainScore,
      outcomeScore: null,
      outcomeCount: 0,
      chainIntegrity: true, // empty chain is valid
    };
  }

  // Count successful vs total outcomes
  const successCount = outcomes.filter(
    (q): q is typeof q & { outcome: string } => q.outcome === "success"
  ).length;
  const outcomeScore = Math.round((successCount / outcomes.length) * 100);

  // Check chain integrity: verify actual prev→current recordHash linkage
  let chainIntegrity = true;
  try {
    for (let i = 1; i < outcomes.length; i++) {
      const prevMeta = outcomes[i - 1].metadata as Record<string, unknown> | null;
      const currMeta = outcomes[i].metadata as Record<string, unknown> | null;
      const prevRecordHash = prevMeta?.recordHash;
      const currPrevHash = currMeta?.prevHash;
      // Only fail if both fields are present and don't match
      if (
        prevRecordHash !== undefined &&
        currPrevHash !== undefined &&
        prevRecordHash !== currPrevHash
      ) {
        chainIntegrity = false;
        break;
      }
    }
  } catch {
    chainIntegrity = false;
  }

  // Blend scores
  const weight = outcomes.length >= 5 ? 0.4 : 0.9; // if <5: 90% on-chain, else 40% on-chain
  let blendedScore = Math.round(onchainScore * weight + outcomeScore * (1 - weight));

  // Apply chain integrity penalty if broken
  if (!chainIntegrity) {
    blendedScore = Math.max(0, blendedScore - 30);
  }

  // Clamp to 0-100
  blendedScore = Math.max(0, Math.min(100, blendedScore));

  return {
    blendedScore,
    onchainScore,
    outcomeScore,
    outcomeCount: outcomes.length,
    chainIntegrity,
  };
}

// ─── Fetch All Agents via Pagination ─────────────────────────────────────────

export async function fetchAgentsPage(page: number): Promise<AcpAgent[]> {
  // page is 1-indexed for this API
  const params = new URLSearchParams({
    "pagination[page]": String(page + 1),
    "pagination[pageSize]": String(PAGE_SIZE),
  });
  const url = `${LIST_URL}?${params.toString()}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data: AcpAgent[]; meta?: { pagination?: { pageCount?: number } } };
  return json.data ?? [];
}

export async function fetchAllAgents(verbose = false): Promise<AcpAgent[]> {
  const seen = new Map<string, AcpAgent>();

  for (let page = 0; page < MAX_PAGES; page++) {
    if (verbose) process.stdout?.write?.(`   Fetching page ${page}... `);
    try {
      const agents = await fetchAgentsPage(page);
      if (agents.length === 0) {
        if (verbose) console.log("done (empty page)");
        break;
      }
      let newCount = 0;
      for (const a of agents) {
        if (a.walletAddress && !seen.has(a.walletAddress.toLowerCase())) {
          seen.set(a.walletAddress.toLowerCase(), a);
          newCount++;
        }
      }
      if (verbose) console.log(`${agents.length} results (${newCount} new)`);
      if (agents.length < PAGE_SIZE) break; // last page
    } catch (e) {
      if (verbose) console.log(`⚠️  page ${page} failed: ${(e as Error).message}`);
      break;
    }
    await new Promise((r) => setTimeout(r, 200)); // rate limit
  }

  return [...seen.values()];
}

// ─── Main Indexer Function ───────────────────────────────────────────────────

export async function runAcpIndexer(options: IndexerOptions): Promise<IndexerResult> {
  const { dryRun, prisma: externalPrisma, verbose = false } = options;

  const log = verbose ? console.log.bind(console) : () => {};

  log("🔍 Maiat ACP Indexer — Virtuals REST API");
  log(`   Source: ${LIST_URL}`);
  if (dryRun) log("   ⚠️  DRY RUN — no DB writes\n");

  // 1. Collect ALL agents via full pagination (no keyword filtering)
  log("   Strategy: full pagination scan (no keyword filter)");
  const allAgents = await fetchAllAgents(verbose);
  log(`\n📦 Total unique agents: ${allAgents.length}`);

  // 2. Fetch existing rawMetrics (contains Wadjet priceData) for scoring
  const prisma = externalPrisma ?? new PrismaClient();
  const shouldDisconnect = !externalPrisma;
  const existingAgents = await prisma.agentScore.findMany({
    where: { walletAddress: { in: allAgents.map(a => a.walletAddress) } },
    select: { walletAddress: true, rawMetrics: true },
  });
  const existingMap = new Map(existingAgents.map(a => [a.walletAddress.toLowerCase(), a.rawMetrics as Record<string, unknown> | null]));

  // 3. Compute trust scores (with Wadjet price signals)
  const scores: AgentScore[] = allAgents.map(agent => {
    const existing = existingMap.get(agent.walletAddress.toLowerCase());
    return computeTrustScore(agent, existing ?? undefined);
  });

  // Stats
  const withJobs = scores.filter((s) => s.totalJobs > 0);
  const avg = withJobs.length
    ? Math.round(withJobs.reduce((s, a) => s + a.trustScore, 0) / withJobs.length)
    : 0;

  const highScoreCount = scores.filter((s) => s.trustScore >= 80).length;
  const mediumScoreCount = scores.filter((s) => s.trustScore >= 60 && s.trustScore < 80).length;
  const lowScoreCount = scores.filter((s) => s.trustScore < 60).length;

  log(`\n📊 Score distribution:`);
  log(`   Agents with job history: ${withJobs.length}/${scores.length}`);
  log(`   Average score (active): ${avg}/100`);
  log(`   High (≥80): ${highScoreCount}`);
  log(`   Medium (60-79): ${mediumScoreCount}`);
  log(`   Low (<60): ${lowScoreCount}`);

  if (dryRun) {
    log("\n✅ Dry run complete. Run without --dry-run to write to DB.");
    return {
      indexed: scores.length,
      updated: 0,
      failed: 0,
      stats: {
        totalAgents: scores.length,
        agentsWithJobs: withJobs.length,
        averageScore: avg,
        highScoreCount,
        mediumScoreCount,
        lowScoreCount,
      },
    };
  }

  // 4. Upsert to Supabase via Prisma (reuse prisma from step 2)

  log(`\n💾 Writing ${scores.length} agent scores to Supabase...`);

  let written = 0;
  let failed = 0;

  for (const s of scores) {
    try {
      // Merge rawMetrics: preserve Wadjet data (priceData, goplusFlags) from existing record
      const existing = existingMap.get(s.walletAddress.toLowerCase()) ?? {};
      const mergedRaw = {
        ...existing,           // keep Wadjet priceData, has8004, etc.
        ...(s.rawMetrics as object), // overwrite with fresh ACP data
        // Re-apply Wadjet fields that ACP indexer doesn't produce
        priceData: (existing as any)?.priceData ?? undefined,
      };

      // Extract tokenAddress from rawMetrics (comes from ACP API)
      const tokenAddr = (s.rawMetrics as any)?.tokenAddress as string | null | undefined;

      await prisma.agentScore.upsert({
        where: { walletAddress: s.walletAddress },
        update: {
          trustScore: s.trustScore,
          completionRate: s.completionRate,
          paymentRate: s.paymentRate,
          expireRate: s.expireRate,
          totalJobs: s.totalJobs,
          dataSource: "ACP_BEHAVIORAL",
          rawMetrics: mergedRaw,
          ...(tokenAddr ? { tokenAddress: tokenAddr } : {}),
        },
        create: {
          walletAddress: s.walletAddress,
          trustScore: s.trustScore,
          completionRate: s.completionRate,
          paymentRate: s.paymentRate,
          expireRate: s.expireRate,
          totalJobs: s.totalJobs,
          dataSource: "ACP_BEHAVIORAL",
          rawMetrics: mergedRaw,
          ...(tokenAddr ? { tokenAddress: tokenAddr } : {}),
        },
      });
      written++;
    } catch (e) {
      failed++;
      log(`   ⚠️  Failed ${s.walletAddress}: ${(e as Error).message}`);
    }
  }

  log(`\n✅ Done. Written: ${written}, Failed: ${failed}`);

  if (shouldDisconnect) {
    await prisma.$disconnect();
  }

  return {
    indexed: scores.length,
    updated: written,
    failed,
    stats: {
      totalAgents: scores.length,
      agentsWithJobs: withJobs.length,
      averageScore: avg,
      highScoreCount,
      mediumScoreCount,
      lowScoreCount,
    },
  };
}
