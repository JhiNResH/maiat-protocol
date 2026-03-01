/**
 * scripts/populate-agent-tokens.ts
 *
 * One-time script to backfill tokenAddress for all agents in DB.
 *
 * Run:
 *   npx tsx scripts/populate-agent-tokens.ts --dry-run  # preview changes
 *   npx tsx scripts/populate-agent-tokens.ts            # apply changes
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { fetchAgentTokenFromVirtuals } from "../src/lib/agent-token-mapper";

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_SIZE = 10; // Process 10 agents at a time
const RATE_LIMIT_MS = 500; // Wait between API calls

async function main() {
  console.log("🔗 Maiat Agent-Token Mapper — Backfill Script");
  if (DRY_RUN) console.log("   ⚠️  DRY RUN — no DB writes\n");

  const prisma = new PrismaClient();

  try {
    // 1. Fetch all agents that don't have tokenAddress set
    const agents = await prisma.agentScore.findMany({
      where: {
        OR: [{ tokenAddress: null }, { tokenAddress: "" }],
      },
      select: {
        id: true,
        walletAddress: true,
        rawMetrics: true,
      },
      orderBy: { trustScore: "desc" },
    });

    console.log(`📦 Found ${agents.length} agents without token addresses\n`);

    if (agents.length === 0) {
      console.log("✅ All agents already have token addresses populated.");
      return;
    }

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    // 2. Process in batches
    for (let i = 0; i < agents.length; i += BATCH_SIZE) {
      const batch = agents.slice(i, i + BATCH_SIZE);
      console.log(
        `\n📍 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(agents.length / BATCH_SIZE)}`
      );

      for (const agent of batch) {
        const rawMetrics = agent.rawMetrics as { name?: string } | null;
        const agentName = rawMetrics?.name ?? "Unknown";

        process.stdout.write(`   ${agentName.padEnd(35).slice(0, 35)}... `);

        try {
          const result = await fetchAgentTokenFromVirtuals(agent.walletAddress);

          if (result.tokenAddress) {
            if (!DRY_RUN) {
              await prisma.agentScore.update({
                where: { id: agent.id },
                data: {
                  tokenAddress: result.tokenAddress.toLowerCase(),
                  tokenSymbol: result.tokenSymbol,
                },
              });
            }
            console.log(`✅ ${result.tokenSymbol ?? result.tokenAddress.slice(0, 10)}...`);
            updated++;
          } else {
            console.log(`⏭️  No token found`);
            skipped++;
          }
        } catch (e) {
          console.log(`❌ Error: ${(e as Error).message}`);
          errors++;
        }

        // Rate limit
        await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped (no token): ${skipped}`);
    console.log(`   Errors: ${errors}`);
    console.log(`   Total processed: ${agents.length}`);

    if (DRY_RUN) {
      console.log("\n✅ Dry run complete. Run without --dry-run to write to DB.");
    } else {
      console.log("\n✅ Backfill complete!");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
