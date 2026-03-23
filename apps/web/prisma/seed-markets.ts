/**
 * Seed initial Opinion Markets
 *
 * Run with: npx ts-node prisma/seed-markets.ts
 * Or: npx tsx prisma/seed-markets.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding initial Opinion Markets...\n");

  const now = new Date();
  const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const markets = [
    {
      title: "Top AI Agent This Fortnight",
      description:
        "Stake Scarab on which AI agent will have the highest trust score in 2 weeks. Top 20 Virtuals agents are eligible.",
      category: "ai-agents",
      status: "open",
      opensAt: now,
      closesAt: twoWeeksFromNow,
      totalPool: 0,
      winnerIds: [],
    },
    {
      title: "Most Trusted DeFi Protocol",
      description:
        "Stake Scarab on which DeFi protocol will be most trusted in 2 weeks. Top 20 TVL protocols are eligible.",
      category: "defi",
      status: "open",
      opensAt: now,
      closesAt: twoWeeksFromNow,
      totalPool: 0,
      winnerIds: [],
    },
    {
      title: "Rising Star",
      description:
        "Stake Scarab on which rising star (current trust score < 70) will climb the highest. Potential breakouts only!",
      category: "mixed",
      status: "open",
      opensAt: now,
      closesAt: twoWeeksFromNow,
      totalPool: 0,
      winnerIds: [],
    },
  ];

  for (const market of markets) {
    // Check if market with same title already exists
    const existing = await prisma.market.findFirst({
      where: {
        title: market.title,
        status: "open",
      },
    });

    if (existing) {
      console.log(`⏭️  Skipping "${market.title}" - already exists (id: ${existing.id})`);
      continue;
    }

    const created = await prisma.market.create({
      data: market,
    });

    console.log(`✅ Created: "${created.title}"`);
    console.log(`   ID: ${created.id}`);
    console.log(`   Category: ${created.category}`);
    console.log(`   Closes: ${created.closesAt.toISOString()}`);
    console.log("");
  }

  console.log("🎉 Done seeding markets!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
