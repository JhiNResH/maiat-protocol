/**
 * scripts/recompute-scores.ts
 * 
 * Recompute trustScore for all projects in the DB that have null scores.
 * Uses the same computeTrustScore() logic as the live API.
 *
 * Run: npx tsx scripts/recompute-scores.ts
 * Run all: npx tsx scripts/recompute-scores.ts --all
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { getAddress } from "viem";
import { computeTrustScore, blendTrustScore, type SupportedChain } from "../src/lib/scoring";

const db = new PrismaClient();

// DB chain label → SupportedChain key
function toChainKey(chain: string | null): SupportedChain {
  const c = (chain ?? "base").toLowerCase();
  if (c === "ethereum" || c === "eth" || c === "mainnet") return "eth";
  if (c === "bnb" || c === "bsc" || c === "binance") return "bnb";
  return "base";
}

// Delay helper to avoid rate-limiting Alchemy
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const forceAll = process.argv.includes("--all");

  const projects = await db.project.findMany({
    where: forceAll ? {} : { trustScore: null },
    select: {
      id: true, name: true, address: true, chain: true, trustScore: true,
      reviewCount: true, avgRating: true,
    },
    orderBy: { name: "asc" },
  });

  console.log(`\n🔄 Recomputing scores for ${projects.length} projects${forceAll ? " (all)" : " (null only)"}…\n`);

  let updated = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < projects.length; i++) {
    const p = projects[i];
    const chain = toChainKey(p.chain);
    const progress = `[${String(i + 1).padStart(3)}/${projects.length}]`;

    try {
      // Normalize checksum before passing (viem strict mode)
      const normalizedAddr = getAddress(p.address);
      const result = await computeTrustScore(normalizedAddr, chain);

      // Blend on-chain score with community reviews (dynamic weights)
      const reviewCount = p.reviewCount ?? 0;
      const avgRating   = p.avgRating   ?? null;
      const { blended, weights } = blendTrustScore(result.score, avgRating, reviewCount);

      // DB stores 0–100; blendTrustScore returns 0–10
      const scoreDb = Math.round(blended * 10);

      await db.project.update({
        where: { id: p.id },
        data: { trustScore: scoreDb },
      });

      const bar = "█".repeat(Math.floor(blended)) + "░".repeat(10 - Math.floor(blended));
      const phaseTag = `[${weights.phase}]`;
      console.log(`${progress} ✅ ${p.name.padEnd(32)} ${chain.padEnd(5)} ${bar} ${blended.toFixed(1)} → DB:${scoreDb} [${result.risk}] ${phaseTag}`);
      updated++;
    } catch (err: any) {
      console.log(`${progress} ❌ ${p.name.padEnd(32)} ${chain.padEnd(5)} FAILED: ${err.message?.slice(0, 60)}`);
      failed++;
    }

    // Rate limit: 200ms between calls to avoid Alchemy rate limit
    // Batch of 5 → extra 500ms pause
    if ((i + 1) % 5 === 0) {
      await sleep(500);
    } else {
      await sleep(200);
    }
  }

  console.log(`\n✅ Done — ${updated} updated, ${failed} failed, ${skipped} skipped`);
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
