/**
 * scripts/seed-memecoins.ts
 * Seed notable Base + ETH memecoins into DB.
 * Run: npx tsx scripts/seed-memecoins.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { getAddress } from "viem";
import { computeTrustScore } from "../src/lib/scoring";

const db = new PrismaClient();
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const MEMECOINS = [
  // ── Base memecoins ─────────────────────────────────────────────────────────
  {
    address: "0x532f27101965dd16442E59d40670FaF5eBB142E4",
    name: "Brett",
    symbol: "BRETT",
    chain: "Base",
    description: "Largest Base memecoin by mcap. Inspired by Matt Furie's 'Boy's Club' comic. Renounced contract, listed on Coinbase.",
  },
  {
    address: "0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4",
    name: "Toshi",
    symbol: "TOSHI",
    chain: "Base",
    description: "Named after Coinbase CEO's cat + Satoshi Nakamoto. Combines meme appeal with NFT trading and DeFi utility.",
  },
  {
    address: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
    name: "Degen",
    symbol: "DEGEN",
    chain: "Base",
    description: "Farcaster-native token airdropped to Degen channel participants. Real utility in social tipping and Degen Chain.",
  },
  {
    address: "0xaaeE1A9723aaDB7afA2810263653A34bA2C21C7a",
    name: "Mog Coin",
    symbol: "MOG",
    chain: "Base",
    description: "Multi-chain meme token with strong Base presence. Cat-themed culture coin.",
  },
  // ── Ethereum memecoins ─────────────────────────────────────────────────────
  {
    address: "0x6982508145454Ce325dDbE47a25d4ec3d2311933",
    name: "Pepe",
    symbol: "PEPE",
    chain: "Ethereum",
    description: "The original Pepe meme coin on Ethereum. Top 10 memecoin by market cap globally.",
  },
  {
    address: "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE",
    name: "Shiba Inu",
    symbol: "SHIB",
    chain: "Ethereum",
    description: "The 'Dogecoin killer'. Second-largest meme coin by market cap. Has ecosystem: ShibaSwap, Shibarium L2.",
  },
  {
    address: "0xcf0C122c6b73ff809C693DB761e7BaeBe62b6a2E",
    name: "Floki",
    symbol: "FLOKI",
    chain: "Ethereum",
    description: "Elon Musk's dog-inspired token. Ecosystem includes Valhalla game and Floki University.",
  },
  {
    address: "0xa35923162C49cF95e6BF26623385eb431ad920D3",
    name: "Turbo",
    symbol: "TURBO",
    chain: "Ethereum",
    description: "AI-generated memecoin created with $69 budget and GPT-4. Became top ETH memecoin.",
  },
];

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Math.random().toString(36).slice(2, 7);
}

function chainKey(chain: string) {
  const c = chain.toLowerCase();
  if (c === "ethereum" || c === "eth") return "eth" as const;
  if (c === "bnb" || c === "bsc") return "bnb" as const;
  return "base" as const;
}

async function main() {
  let added = 0, skipped = 0, failed = 0;

  console.log("\n🐸 Seeding memecoins…\n");

  for (const m of MEMECOINS) {
    const existing = await db.project.findFirst({
      where: { address: { equals: m.address, mode: "insensitive" } },
    });
    if (existing) {
      console.log(`  SKIP  ${m.name} (already exists)`);
      skipped++;
      continue;
    }

    try {
      const addr = getAddress(m.address);
      let trustScore = 40; // conservative default for memecoins

      try {
        const result = await computeTrustScore(addr, chainKey(m.chain));
        trustScore = Math.round(result.score * 10);
        console.log(`  ✅ ${m.name.padEnd(20)} ${m.chain.padEnd(9)} score: ${result.score.toFixed(1)} → DB:${trustScore} [${result.risk}]`);
      } catch (e: any) {
        console.log(`  ⚠️  ${m.name.padEnd(20)} ${m.chain.padEnd(9)} fallback: ${trustScore} (${e.message?.slice(0,40)})`);
      }

      await db.project.create({
        data: {
          address: addr,
          name: m.name,
          slug: slugify(m.name),
          symbol: m.symbol,
          category: "m/memecoin",
          chain: m.chain,
          description: m.description,
          trustScore,
          status: "active",
        },
      });
      added++;
    } catch (e: any) {
      console.log(`  ❌ ${m.name} FAILED: ${e.message?.slice(0, 60)}`);
      failed++;
    }

    await sleep(250);
  }

  const total = await db.project.count();
  const memeCount = await db.project.count({ where: { category: "m/memecoin" } });
  console.log(`\n✅ Done — ${added} added, ${skipped} skipped, ${failed} failed`);
  console.log(`📊 DB: ${total} total | ${memeCount} memecoins`);
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
