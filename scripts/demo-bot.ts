#!/usr/bin/env npx tsx
/**
 * Maiat Demo Bot — Automated token_check usage generator
 *
 * Runs every hour, checks a rotating list of popular tokens.
 * Generates real API usage metrics for the protocol.
 *
 * Usage:
 *   npx tsx scripts/demo-bot.ts           # run once
 *   npx tsx scripts/demo-bot.ts --loop    # run every hour
 */

const MAIAT_API = process.env.MAIAT_API_URL || "https://app.maiat.io";

// Popular Base tokens to rotate through
const TOKENS = [
  { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", name: "USDC" },
  { address: "0x4200000000000000000000000000000000000006", name: "WETH" },
  { address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", name: "DAI" },
  { address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22", name: "cbETH" },
  { address: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", name: "USDbC" },
  { address: "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b", name: "VIRTUAL" },
  { address: "0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4", name: "TOSHI" },
  { address: "0x532f27101965dd16442E59d40670FaF5eBB142E4", name: "BRETT" },
  { address: "0xBC45647eA894030a4E9801Ec03479739FA2485F0", name: "DEGEN" },
  { address: "0x0578d8A44db98B23BF096A382e016e29a5Ce0ffe", name: "HIGHER" },
];

async function checkToken(token: typeof TOKENS[number]) {
  try {
    const res = await fetch(`${MAIAT_API}/api/v1/token/${token.address}`, {
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json();
    const score = (data as Record<string, unknown>).trustScore ?? "?";
    const verdict = (data as Record<string, unknown>).verdict ?? "?";
    console.log(`  ✅ ${token.name.padEnd(8)} → score: ${String(score).padStart(3)}, verdict: ${verdict}`);
    return true;
  } catch (err) {
    console.log(`  ❌ ${token.name.padEnd(8)} → ${(err as Error).message}`);
    return false;
  }
}

async function checkAgents() {
  try {
    const res = await fetch(`${MAIAT_API}/api/v1/agents?limit=5`, {
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json()) as Record<string, unknown>;
    const agents = (data.agents as Array<Record<string, unknown>>) ?? [];
    console.log(`  📋 Agents indexed: ${data.total ?? "?"}, sample: ${agents.length}`);
    return true;
  } catch (err) {
    console.log(`  ❌ Agents API → ${(err as Error).message}`);
    return false;
  }
}

async function runCycle() {
  console.log(`\n🤖 Maiat Demo Bot — ${new Date().toISOString()}`);
  console.log(`   API: ${MAIAT_API}\n`);

  // Pick 3 random tokens each cycle
  const shuffled = [...TOKENS].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 3);

  console.log("📊 Token checks:");
  for (const token of selected) {
    await checkToken(token);
    await new Promise(r => setTimeout(r, 1000)); // rate limit courtesy
  }

  console.log("\n📊 Agent check:");
  await checkAgents();

  console.log("\n✅ Cycle complete.\n");
}

async function main() {
  const loop = process.argv.includes("--loop");

  await runCycle();

  if (loop) {
    console.log("🔄 Loop mode — running every 60 minutes. Ctrl+C to stop.\n");
    setInterval(runCycle, 60 * 60 * 1000);
  }
}

main().catch(console.error);
