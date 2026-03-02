/**
 * scripts/acp-indexer.ts
 *
 * ACP Behavioral Trust Score Indexer (Virtuals REST API version)
 * ==============================================================
 * CLI wrapper for the ACP indexer. Core logic lives in src/lib/acp-indexer.ts.
 *
 * Run:
 *   npx tsx scripts/acp-indexer.ts            # full index
 *   npx tsx scripts/acp-indexer.ts --dry-run  # compute only, no DB writes
 */

import "dotenv/config";
import { runAcpIndexer, computeTrustScore, fetchAllAgents, AgentScore } from "../src/lib/acp-indexer";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  // Run the indexer with verbose output for CLI usage
  const result = await runAcpIndexer({
    dryRun: DRY_RUN,
    verbose: true,
  });

  // Print top 5 agents if verbose stats are desired
  if (DRY_RUN) {
    // For dry run, fetch and compute locally to show top 5
    const seen = new Map<string, AgentScore>();
    try {
      const agents = await fetchAllAgents(true);
      for (const a of agents) {
        if (a.walletAddress && !seen.has(a.walletAddress.toLowerCase())) {
          seen.set(a.walletAddress.toLowerCase(), computeTrustScore(a));
        }
      }
    } catch {
      // Ignore errors for top 5 display
    }

    const scores = [...seen.values()];
    const top5 = [...scores].sort((a, b) => b.trustScore - a.trustScore).slice(0, 5);
    console.log(`\n🏆 Top 5 agents:`);
    for (const s of top5) {
      console.log(
        `   ${s.name.padEnd(30)} ${s.trustScore}/100  (${s.totalJobs} jobs, ${Math.round(s.completionRate * 100)}% completion)`
      );
    }
  }

  console.log(`\n📈 Summary:`);
  console.log(`   Total indexed: ${result.indexed}`);
  console.log(`   Updated in DB: ${result.updated}`);
  console.log(`   Failed: ${result.failed}`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
