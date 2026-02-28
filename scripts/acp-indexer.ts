/**
 * scripts/acp-indexer.ts
 *
 * ACP Behavioral Trust Score Indexer (Virtuals REST API version)
 * ==============================================================
 * Fetches ALL agents from Virtuals ACP via REST API,
 * computes behavioral trust scores, and upserts into Supabase.
 *
 * Data source: http://acpx.virtuals.io/api/agents/v5/search
 * Fields used: successfulJobCount, successRate, uniqueBuyerCount, isOnline
 *
 * Run:
 *   npx tsx scripts/acp-indexer.ts            # full index
 *   npx tsx scripts/acp-indexer.ts --dry-run  # compute only, no DB writes
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

// ─── Config ───────────────────────────────────────────────────────────────────

const DRY_RUN  = process.argv.includes("--dry-run");
const SEARCH_URL = "http://acpx.virtuals.io/api/agents/v5/search";
const QUERIES  = ["ai", "trust", "defi", "agent", "data", "trade", "content", "code"];
const TOP_K    = 100; // max per query

const prisma = DRY_RUN ? null : new PrismaClient();

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentMetrics {
  successfulJobCount: number | null;
  successRate:        number | null;
  uniqueBuyerCount:   number | null;
  isOnline:           boolean;
}

interface AcpAgent {
  id:              number;
  name:            string;
  walletAddress:   string;
  metrics:         AgentMetrics | null;
  createdAt?:      string | null;
}

interface AgentScore {
  walletAddress:  string;
  name:           string;
  trustScore:     number;
  completionRate: number;
  paymentRate:    number;
  expireRate:     number;
  totalJobs:      number;
  rawMetrics:     object;
}

// ─── Trust Score Formula ──────────────────────────────────────────────────────

function computeTrustScore(agent: AcpAgent): AgentScore {
  const m = agent.metrics;

  // Raw signals (0-1 scale)
  const totalJobs      = m?.successfulJobCount ?? 0;
  const successRate    = m?.successRate != null ? m.successRate / 100 : 0; // API gives 0-100
  const buyerCount     = m?.uniqueBuyerCount  ?? 0;

  // Derived metrics
  const completionRate = successRate;                        // successRate ≈ completion rate
  const paymentRate    = successRate > 0 ? Math.min(successRate * 1.05, 1) : 0; // proxy
  const expireRate     = successRate > 0 ? Math.max(1 - successRate - 0.05, 0) : 0.5;

  // Volume factor: log scale, max 1.0 at 50+ jobs
  const volumeFactor = totalJobs > 0 ? Math.min(Math.log10(totalJobs + 1) / Math.log10(51), 1) : 0;

  // Diversity factor: multiple unique buyers = more trustworthy
  const diversityFactor = Math.min(buyerCount / 5, 1);

  // ACP Score (0-100)
  const score = Math.round(
    completionRate    * 40 +   // did they finish jobs?
    volumeFactor      * 25 +   // how many jobs?
    diversityFactor   * 20 +   // diverse buyers?
    paymentRate       * 15     // payment proxy
  );

  return {
    walletAddress:  agent.walletAddress,
    name:           agent.name,
    trustScore:     Math.min(Math.max(score, 0), 100),
    completionRate: Math.round(completionRate * 10000) / 10000,
    paymentRate:    Math.round(paymentRate    * 10000) / 10000,
    expireRate:     Math.round(expireRate     * 10000) / 10000,
    totalJobs,
    rawMetrics: {
      successfulJobCount: m?.successfulJobCount,
      successRate:        m?.successRate,
      uniqueBuyerCount:   m?.uniqueBuyerCount,
      isOnline:           m?.isOnline,
      agentId:            agent.id,
      name:               agent.name,
      indexedAt:          new Date().toISOString(),
    },
  };
}

// ─── Fetch Agents from Virtuals API ──────────────────────────────────────────

async function fetchAgents(query: string): Promise<AcpAgent[]> {
  const url = `${SEARCH_URL}?query=${encodeURIComponent(query)}&topK=${TOP_K}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const json = await res.json() as { data: AcpAgent[] };
  return json.data ?? [];
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔍 Maiat ACP Indexer — Virtuals REST API");
  console.log(`   Source: ${SEARCH_URL}`);
  if (DRY_RUN) console.log("   ⚠️  DRY RUN — no DB writes\n");

  // 1. Collect agents from multiple queries (deduplicate by walletAddress)
  const seen  = new Map<string, AcpAgent>();

  for (const query of QUERIES) {
    process.stdout.write(`   Fetching query "${query}"... `);
    try {
      const agents = await fetchAgents(query);
      let newCount = 0;
      for (const a of agents) {
        if (a.walletAddress && !seen.has(a.walletAddress.toLowerCase())) {
          seen.set(a.walletAddress.toLowerCase(), a);
          newCount++;
        }
      }
      console.log(`${agents.length} results (${newCount} new)`);
    } catch (e) {
      console.log(`⚠️  failed: ${(e as Error).message}`);
    }
    await new Promise(r => setTimeout(r, 300)); // rate limit
  }

  const allAgents = [...seen.values()];
  console.log(`\n📦 Total unique agents: ${allAgents.length}`);

  // 2. Compute trust scores
  const scores: AgentScore[] = allAgents.map(computeTrustScore);

  // Stats
  const withJobs = scores.filter(s => s.totalJobs > 0);
  const avg = withJobs.length
    ? Math.round(withJobs.reduce((s, a) => s + a.trustScore, 0) / withJobs.length)
    : 0;

  console.log(`\n📊 Score distribution:`);
  console.log(`   Agents with job history: ${withJobs.length}/${scores.length}`);
  console.log(`   Average score (active): ${avg}/100`);
  console.log(`   High (≥80): ${scores.filter(s => s.trustScore >= 80).length}`);
  console.log(`   Medium (60-79): ${scores.filter(s => s.trustScore >= 60 && s.trustScore < 80).length}`);
  console.log(`   Low (<60): ${scores.filter(s => s.trustScore < 60).length}`);

  // 3. Sample output
  const top5 = [...scores].sort((a, b) => b.trustScore - a.trustScore).slice(0, 5);
  console.log(`\n🏆 Top 5 agents:`);
  for (const s of top5) {
    console.log(`   ${s.name.padEnd(30)} ${s.trustScore}/100  (${s.totalJobs} jobs, ${Math.round(s.completionRate * 100)}% completion)`);
  }

  if (DRY_RUN) {
    console.log("\n✅ Dry run complete. Run without --dry-run to write to DB.");
    return;
  }

  // 4. Upsert to Supabase via Prisma
  if (!prisma) return;
  console.log(`\n💾 Writing ${scores.length} agent scores to Supabase...`);

  let written = 0;
  let failed  = 0;

  for (const s of scores) {
    try {
      await (prisma as any).agentScore.upsert({
        where:  { walletAddress: s.walletAddress },
        update: {
          trustScore:    s.trustScore,
          completionRate: s.completionRate,
          paymentRate:   s.paymentRate,
          expireRate:    s.expireRate,
          totalJobs:     s.totalJobs,
          dataSource:    "ACP_BEHAVIORAL",
          rawMetrics:    s.rawMetrics,
        },
        create: {
          walletAddress: s.walletAddress,
          trustScore:    s.trustScore,
          completionRate: s.completionRate,
          paymentRate:   s.paymentRate,
          expireRate:    s.expireRate,
          totalJobs:     s.totalJobs,
          dataSource:    "ACP_BEHAVIORAL",
          rawMetrics:    s.rawMetrics,
        },
      });
      written++;
    } catch (e) {
      failed++;
      console.error(`   ⚠️  Failed ${s.walletAddress}: ${(e as Error).message}`);
    }
  }

  console.log(`\n✅ Done. Written: ${written}, Failed: ${failed}`);
  await prisma.$disconnect();
}

main().catch(e => {
  console.error("Fatal:", e);
  process.exit(1);
});
