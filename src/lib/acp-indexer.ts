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
const SEARCH_URL = "https://acpx.virtuals.io/api/agents/v5/search";
const PAGE_SIZE = 100;   // API supports up to 100
const MAX_PAGES = 1500;  // safety cap — covers ~150,000 agents
const INDEXER_TIMEOUT_MS = 4.5 * 60 * 1000; // 4.5 min graceful stop before Vercel 5min kill

// ─── Known Titan Agents (seed list) ───────────────────────────────────────────
// These are Virtuals Protocol "Titan" type agents that may not appear in standard listing
// Format: { name, walletAddress, tokenAddress }
const TITAN_SEED_LIST: Array<{ name: string; walletAddress: string; tokenAddress: string | null }> = [
  // ROBO / Fabric Protocol (Titan launch on Virtuals, 2026-02-27)
  { name: "Fabric Protocol (ROBO)", walletAddress: "0x65dB04a529925A80e19b2389cc9554Bee048563a", tokenAddress: "0x407A5fb66CB1b3d50004f7091c08A27B42ba6d6F" },
  // GAME by Virtuals (core platform token)
  { name: "GAME by Virtuals", walletAddress: "0xca226bd9c754F1283123d32B2a7cF62a722f8ADa", tokenAddress: "0x1C4CcA7C5DB003824208aDDA61Bd749e55F463a3" },
  // Add more known Titan agents here as discovered
];

// ─── Search keywords for v5 endpoint ──────────────────────────────────────────
// Used to discover agents that might be missed by pagination
const SEARCH_KEYWORDS = [
  "ROBO", "Titan", "Fabric", "Protocol", "AI", "Agent", "Bot", "Trading",
  "DeFi", "NFT", "Crypto", "Hedge", "Fund", "Swap", "Bridge", "Oracle",
];

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

// ─── V5 Search Response Types ────────────────────────────────────────────────

interface V5SearchAgent {
  id: number;
  name: string;
  walletAddress: string;
  contractAddress?: string;
  description?: string | null;
  twitterHandle?: string | null;
  profilePic?: string | null;
  tokenAddress?: string | null;
  cluster?: string | null;
  category?: string | null;
  symbol?: string | null;
  virtualAgentId?: string | null;
  isVirtualAgent?: boolean;
  metrics?: {
    successfulJobCount?: number;
    successRate?: number;
    uniqueBuyerCount?: number;
    minsFromLastOnlineTime?: number;
    isOnline?: boolean;
  };
  jobs?: Array<{ name: string; price: number }>;
  resources?: unknown[];
}

/**
 * Convert V5 search agent format to standard AcpAgent format
 */
function v5AgentToAcpAgent(v5: V5SearchAgent): AcpAgent {
  return {
    id: v5.id,
    name: v5.name,
    walletAddress: v5.walletAddress,
    category: v5.category,
    description: v5.description,
    successfulJobCount: v5.metrics?.successfulJobCount ?? null,
    successRate: v5.metrics?.successRate ?? null,
    uniqueBuyerCount: v5.metrics?.uniqueBuyerCount ?? null,
    profilePic: v5.profilePic,
    twitterHandle: v5.twitterHandle,
    cluster: v5.cluster,
    offerings: v5.jobs?.map(j => ({ name: j.name, price: j.price })) ?? null,
    tokenAddress: v5.tokenAddress,
  };
}

/**
 * Fetch agents via v5 search endpoint for a given query
 */
export async function fetchV5SearchAgents(query: string): Promise<AcpAgent[]> {
  const url = `${SEARCH_URL}?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    // v5 search returns 400 for empty queries, treat as empty
    if (res.status === 400) return [];
    throw new Error(`V5 Search API ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { data: V5SearchAgent[] | null };
  const agents = json.data ?? [];
  return agents.map(v5AgentToAcpAgent);
}

/**
 * Fetch agents from v5 search using multiple keywords
 */
async function fetchV5SearchAllKeywords(verbose = false): Promise<AcpAgent[]> {
  const seen = new Map<string, AcpAgent>();

  for (const keyword of SEARCH_KEYWORDS) {
    if (verbose) process.stdout?.write?.(`   V5 search: "${keyword}"... `);
    try {
      const agents = await fetchV5SearchAgents(keyword);
      let newCount = 0;
      for (const a of agents) {
        if (a.walletAddress && !seen.has(a.walletAddress.toLowerCase())) {
          seen.set(a.walletAddress.toLowerCase(), a);
          newCount++;
        }
      }
      if (verbose) console.log(`${agents.length} results (${newCount} new)`);
    } catch (e) {
      if (verbose) console.log(`⚠️  failed: ${(e as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, 150)); // rate limit
  }

  return [...seen.values()];
}

/**
 * Create AcpAgent entries from the Titan seed list
 */
function getTitanSeedAgents(): AcpAgent[] {
  return TITAN_SEED_LIST.map((titan, idx) => ({
    id: -1000 - idx, // Negative IDs to distinguish from API-sourced
    name: titan.name,
    walletAddress: titan.walletAddress,
    category: "TITAN",
    description: "Titan agent (seed list)",
    successfulJobCount: null,
    successRate: null,
    uniqueBuyerCount: null,
    tokenAddress: titan.tokenAddress,
  }));
}

export async function fetchAllAgents(verbose = false, startedAt?: number): Promise<AcpAgent[]> {
  const seen = new Map<string, AcpAgent>();
  const deadline = startedAt ?? Date.now(); // use caller's start time if provided

  // ─── Phase 1: Standard pagination ─────────────────────────────────────────
  if (verbose) console.log("\n📋 Phase 1: Standard pagination scan");
  let timedOut = false;
  for (let page = 0; page < MAX_PAGES; page++) {
    // Graceful stop: if we're within 30s of the timeout budget, stop pagination early
    if (Date.now() - deadline > INDEXER_TIMEOUT_MS - 30_000) {
      if (verbose) console.log(`   ⏱️  Approaching timeout — stopping pagination at page ${page} (${seen.size} agents so far)`);
      timedOut = true;
      break;
    }

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
      // Retry once, then skip page (don't stop entire indexing)
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const retry = await fetchAgentsPage(page);
        for (const a of retry) {
          if (a.walletAddress && !seen.has(a.walletAddress.toLowerCase())) {
            seen.set(a.walletAddress.toLowerCase(), a);
          }
        }
      } catch { /* skip this page */ }
    }
    await new Promise((r) => setTimeout(r, 100)); // rate limit
  }

  const paginationCount = seen.size;
  if (verbose) {
    if (timedOut) console.log(`   Pagination stopped early (timeout): ${paginationCount}`);
    else console.log(`   Pagination total: ${paginationCount}`);
  }

  // ─── Phase 2: V5 Search for additional agents (Titans, etc) ───────────────
  if (verbose) console.log("\n🔍 Phase 2: V5 search for Titan/Virtual agents");
  const v5Agents = await fetchV5SearchAllKeywords(verbose);
  let v5NewCount = 0;
  for (const a of v5Agents) {
    if (a.walletAddress && !seen.has(a.walletAddress.toLowerCase())) {
      seen.set(a.walletAddress.toLowerCase(), a);
      v5NewCount++;
    }
  }
  if (verbose) console.log(`   V5 search added: ${v5NewCount} new agents`);

  // ─── Phase 3: Titan seed list (known agents that might be missed) ─────────
  if (verbose) console.log("\n🏛️  Phase 3: Adding Titan seed list");
  const titanAgents = getTitanSeedAgents();
  let titanNewCount = 0;
  for (const a of titanAgents) {
    if (a.walletAddress && !seen.has(a.walletAddress.toLowerCase())) {
      seen.set(a.walletAddress.toLowerCase(), a);
      titanNewCount++;
    }
  }
  if (verbose) console.log(`   Titan seed added: ${titanNewCount} new agents`);

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
  const indexerStart = Date.now();
  log("   Strategy: full pagination scan (no keyword filter)");
  const allAgents = await fetchAllAgents(verbose, indexerStart);
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
