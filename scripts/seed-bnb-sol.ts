/**
 * scripts/seed-bnb-sol.ts
 * Adds notable BNB + Solana DeFi & AI Agent projects to the DB.
 * 
 * BNB:   real EVM addresses → scored via Alchemy BNB RPC
 * Solana: base58 addresses  → hardcoded scores (EVM scoring not applicable)
 * 
 * Run: npx tsx scripts/seed-bnb-sol.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { getAddress } from "viem";
import { computeTrustScore } from "../src/lib/scoring";

const db = new PrismaClient();
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ── BNB projects (EVM → will be scored on-chain) ─────────────────────────────
const BNB_PROJECTS = [
  // DeFi
  {
    address: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
    name: "PancakeSwap V2",
    symbol: "CAKE",
    category: "m/defi",
    chain: "BNB",
    description: "Leading DEX on BNB Chain. Largest AMM by volume on BSC.",
    website: "https://pancakeswap.finance",
  },
  {
    address: "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4",
    name: "PancakeSwap V3",
    symbol: "CAKE",
    category: "m/defi",
    chain: "BNB",
    description: "PancakeSwap V3 SmartRouter with concentrated liquidity.",
    website: "https://pancakeswap.finance",
  },
  {
    address: "0xfD36E2c2a6789Db23113685031d7F16329158384",
    name: "Venus Protocol",
    symbol: "XVS",
    category: "m/defi",
    chain: "BNB",
    description: "Largest BNB Chain lending/borrowing protocol. $1.7B TVL.",
    website: "https://venus.io",
  },
  {
    address: "0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63",
    name: "Venus (XVS)",
    symbol: "XVS",
    category: "m/defi",
    chain: "BNB",
    description: "Venus Protocol governance token (XVS).",
    website: "https://venus.io",
  },
  {
    address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    name: "Wrapped BNB",
    symbol: "WBNB",
    category: "m/defi",
    chain: "BNB",
    description: "Wrapped BNB — native token of BNB Smart Chain.",
    website: "https://www.bnbchain.org",
  },
  {
    address: "0x55d398326f99059fF775485246999027B3197955",
    name: "BSC-USD (USDT)",
    symbol: "USDT",
    category: "m/defi",
    chain: "BNB",
    description: "Tether USDT on BNB Smart Chain. Most-used stablecoin on BSC.",
  },
  {
    address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    name: "USDC (BNB Chain)",
    symbol: "USDC",
    category: "m/defi",
    chain: "BNB",
    description: "Circle USDC on BNB Smart Chain.",
  },
  // AI Agents on BNB
  {
    address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
    name: "PancakeSwap (CAKE)",
    symbol: "CAKE",
    category: "m/defi",
    chain: "BNB",
    description: "CAKE token — PancakeSwap governance and reward token.",
    website: "https://pancakeswap.finance",
  },
];

// ── Solana projects (base58 → hardcoded scores, EVM scoring N/A) ──────────────
const SOLANA_PROJECTS = [
  // DeFi
  {
    address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    name: "Jupiter (JUP)",
    symbol: "JUP",
    category: "m/defi",
    chain: "Solana",
    trustScore: 82, // Established DEX aggregator, audited, high TVL
    description: "Largest DEX aggregator on Solana. Routes swaps across all major Solana DEXes.",
    website: "https://jup.ag",
  },
  {
    address: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
    name: "Raydium (RAY)",
    symbol: "RAY",
    category: "m/defi",
    chain: "Solana",
    trustScore: 76,
    description: "Leading AMM and liquidity provider on Solana. Powers Pump.fun launches.",
    website: "https://raydium.io",
  },
  {
    address: "MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey",
    name: "Marinade Finance (MNDE)",
    symbol: "MNDE",
    category: "m/defi",
    chain: "Solana",
    trustScore: 74,
    description: "Largest liquid staking protocol on Solana. Non-custodial SOL staking.",
    website: "https://marinade.finance",
  },
  {
    address: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",
    name: "Orca (ORCA)",
    symbol: "ORCA",
    category: "m/defi",
    chain: "Solana",
    trustScore: 72,
    description: "User-friendly DEX on Solana with concentrated liquidity (Whirlpools).",
    website: "https://www.orca.so",
  },
  {
    address: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
    name: "Ethereum (Wormhole)",
    symbol: "WETH",
    category: "m/defi",
    chain: "Solana",
    trustScore: 78,
    description: "Wormhole-bridged ETH on Solana.",
  },
  // AI Agents on Solana
  {
    address: "HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC",
    name: "ai16z",
    symbol: "ai16z",
    category: "m/ai-agents",
    chain: "Solana",
    trustScore: 58,
    description: "ElizaOS framework DAO token. First major AI agent framework on Solana. Created by @shawmakesmagic.",
    website: "https://elizaos.ai",
  },
  {
    address: "8x5VqbHA8D7NkD52uNuS5nnt3PwA8pLD34ymskeSo2Wn",
    name: "Zerebro",
    symbol: "ZEREBRO",
    category: "m/ai-agents",
    chain: "Solana",
    trustScore: 50,
    description: "Autonomous AI agent that generates music, art, and memes. Lives across social platforms.",
    website: "https://zerebro.org",
  },
  {
    address: "CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump",
    name: "GOAT",
    symbol: "GOAT",
    category: "m/ai-agents",
    chain: "Solana",
    trustScore: 48,
    description: "AI agent token from Truth Terminal. First viral AI agent to reach $1B market cap.",
  },
  {
    address: "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump",
    name: "Fartcoin",
    symbol: "FARTCOIN",
    category: "m/ai-agents",
    chain: "Solana",
    trustScore: 35,
    description: "Meme coin launched by an AI agent. One of the largest Solana meme coins by mcap.",
  },
  {
    address: "AiXwtUBnuZ1LFXkBJoAWkBpNqxPLn6Mma9BmjzgDJxp3",
    name: "AIXBT (Solana)",
    symbol: "AIXBT",
    category: "m/ai-agents",
    chain: "Solana",
    trustScore: 52,
    description: "AIXBT AI agent Solana token — sister to Base AIXBT.",
  },
];

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Math.random().toString(36).slice(2, 7);
}

async function main() {
  let added = 0;
  let skipped = 0;
  let failed = 0;

  console.log("\n🔷 Seeding BNB projects…\n");

  for (const p of BNB_PROJECTS) {
    const existing = await db.project.findFirst({ where: { address: { equals: p.address, mode: "insensitive" } } });
    if (existing) {
      console.log(`  SKIP  ${p.name} (already exists)`);
      skipped++;
      continue;
    }

    try {
      const normalizedAddr = getAddress(p.address);
      let trustScore: number | undefined;

      try {
        const result = await computeTrustScore(normalizedAddr, "bnb");
        trustScore = Math.round(result.score * 10);
        console.log(`  ✅ ${p.name.padEnd(30)} BNB  score: ${result.score.toFixed(1)} → DB:${trustScore}`);
      } catch (e: any) {
        // Fallback to a conservative default for BNB if Alchemy fails
        trustScore = 55;
        console.log(`  ⚠️  ${p.name.padEnd(30)} BNB  fallback score: ${trustScore} (${e.message?.slice(0, 40)})`);
      }

      await db.project.create({
        data: {
          address: normalizedAddr,
          name: p.name,
          slug: slugify(p.name),
          symbol: p.symbol,
          category: p.category,
          chain: p.chain,
          description: p.description,
          website: (p as any).website,
          trustScore,
          status: "active",
        },
      });
      added++;
    } catch (e: any) {
      console.log(`  ❌ ${p.name} FAILED: ${e.message?.slice(0, 60)}`);
      failed++;
    }

    await sleep(300);
  }

  console.log("\n🟣 Seeding Solana projects…\n");

  for (const p of SOLANA_PROJECTS) {
    const existing = await db.project.findFirst({ where: { address: p.address } });
    if (existing) {
      console.log(`  SKIP  ${p.name} (already exists)`);
      skipped++;
      continue;
    }

    try {
      await db.project.create({
        data: {
          address: p.address,
          name: p.name,
          slug: slugify(p.name),
          symbol: p.symbol,
          category: p.category,
          chain: p.chain,
          description: p.description,
          website: (p as any).website,
          trustScore: p.trustScore,
          status: "active",
        },
      });
      console.log(`  ✅ ${p.name.padEnd(30)} SOL  hardcoded: ${p.trustScore}`);
      added++;
    } catch (e: any) {
      console.log(`  ❌ ${p.name} FAILED: ${e.message?.slice(0, 60)}`);
      failed++;
    }
  }

  console.log(`\n✅ Done — ${added} added, ${skipped} skipped, ${failed} failed`);
  const total = await db.project.count();
  console.log(`📊 DB total: ${total} projects`);
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
