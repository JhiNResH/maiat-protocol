/**
 * Maiat Cold-Start Seed v2
 *
 * Sources:
 *   1. DefiLlama — all protocols with TVL > $1B on Base or Ethereum
 *   2. Virtuals Protocol API — top 50 agents by market cap
 *
 * Run: npx ts-node --project tsconfig.seed.json prisma/cold-start-seed.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

// ── Trust score helpers ────────────────────────────────────────────────────────

function defiTrustScore(tvlB: number, audits: number, category: string): number {
  let base = 55;
  // TVL signal (capped at +25)
  if (tvlB > 20) base += 25;
  else if (tvlB > 10) base += 20;
  else if (tvlB > 5) base += 15;
  else if (tvlB > 2) base += 10;
  else if (tvlB > 1) base += 5;

  // Audit signal
  if (audits > 2) base += 10;
  else if (audits > 0) base += 5;

  // Category signal
  if (['Lending', 'DEX', 'Dexs', 'CDP'].includes(category)) base += 5;
  if (['Bridge', 'Canonical Bridge'].includes(category)) base -= 5;

  return Math.min(Math.max(base, 40), 98);
}

function agentTrustScore(mcapM: number, holderCount: number): number {
  let base = 40;
  if (mcapM > 200) base += 30;
  else if (mcapM > 50) base += 20;
  else if (mcapM > 10) base += 15;
  else if (mcapM > 1) base += 8;

  if (holderCount > 100_000) base += 10;
  else if (holderCount > 10_000) base += 5;

  return Math.min(Math.max(base, 30), 90);
}

function gradeFromScore(score: number): string {
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function mapDefiCategory(llamaCategory: string): string {
  const map: Record<string, string> = {
    'Lending': 'm/defi',
    'Dexs': 'm/defi',
    'DEX': 'm/defi',
    'Liquid Staking': 'm/defi',
    'Liquid Restaking': 'm/defi',
    'Restaking': 'm/defi',
    'Staking Pool': 'm/defi',
    'Yield': 'm/defi',
    'CDP': 'm/defi',
    'RWA': 'm/defi',
    'Bridge': 'm/defi',
    'Canonical Bridge': 'm/defi',
    'Basis Trading': 'm/defi',
    'Onchain Capital Allocator': 'm/defi',
    'Risk Curators': 'm/defi',
  };
  return map[llamaCategory] ?? 'm/defi';
}

function primaryChain(chains: string[]): string {
  if (chains.includes('Base')) return 'Base';
  if (chains.includes('Ethereum')) return 'Ethereum';
  return chains[0] ?? 'Ethereum';
}

// ── DefiLlama fetch ────────────────────────────────────────────────────────────

interface LlamaProtocol {
  name: string;
  slug: string;
  address: string | null;
  symbol: string;
  url: string;
  description: string;
  chain: string;
  chains: string[];
  category: string;
  audits: string;
  twitter: string | null;
  github?: string | string[] | null;
  tvl: number;
  logo: string | null;
}

async function fetchDefiLlama(): Promise<LlamaProtocol[]> {
  console.log('📡 Fetching DefiLlama protocols...');
  const res = await fetch('https://api.llama.fi/protocols');
  const all: LlamaProtocol[] = await res.json();

  const filtered = all.filter(p =>
    p.tvl > 1_000_000_000 &&
    (p.chains ?? []).some(c => ['Base', 'Ethereum'].includes(c)) &&
    !['CEX', 'Chain', 'RWA Lending'].includes(p.category)
  ).sort((a, b) => b.tvl - a.tvl).slice(0, 60);

  console.log(`  → ${filtered.length} protocols with TVL > $1B on Base/ETH`);
  return filtered;
}

// ── Virtuals fetch ─────────────────────────────────────────────────────────────

interface VirtualAgent {
  name: string;
  symbol: string;
  tokenAddress: string;
  category: string;
  role: string;
  description: string;
  mcapInVirtual: number;
  holderCount: number;
  volume24h: number;
  priceChangePercent24h: number;
  socials: { TWITTER?: string };
  totalValueLocked: string;
}

async function fetchVirtuals(): Promise<VirtualAgent[]> {
  console.log('📡 Fetching Virtuals top 50 agents...');
  const res = await fetch(
    'https://api.virtuals.io/api/virtuals?filters[status]=AVAILABLE&sort[0]=mcapInVirtual:desc&pagination[pageSize]=50&pagination[page]=1'
  );
  const data = await res.json();
  const agents: VirtualAgent[] = data.data ?? [];
  console.log(`  → ${agents.length} Virtuals agents`);
  return agents;
}

// ── Main seed ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌱 Maiat Cold-Start Seed v2\n');

  let created = 0;
  let updated = 0;

  // ── 1. DefiLlama protocols ─────────────────────────────────────────────────
  const protocols = await fetchDefiLlama();
  console.log('\n📊 Seeding DeFi protocols...');

  for (const p of protocols) {
    const tvlB = p.tvl / 1e9;
    const audits = parseInt(p.audits ?? '0') || 0;
    const score = defiTrustScore(tvlB, audits, p.category);
    const grade = gradeFromScore(score);
    const chain = primaryChain(p.chains ?? []);
    const category = mapDefiCategory(p.category);

    // Use slug as address if no on-chain address (DefiLlama slugs are unique)
    const addr = (p.address ?? p.slug).toLowerCase();
    const slug = p.slug;

    const data = {
      name: p.name,
      description: p.description || `${p.name} — ${p.category} protocol. TVL: $${tvlB.toFixed(1)}B`,
      website: p.url || null,
      twitter: p.twitter ? `https://x.com/${p.twitter}` : null,
      github: Array.isArray(p.github) ? (p.github[0] ? `https://github.com/${p.github[0]}` : null) : (p.github ?? null),
      image: p.logo ?? null,
      symbol: p.symbol ?? null,
      category,
      chain,
      status: 'active',
      trustScore: score,
      trustGrade: grade,
      onChainScore: score,
      offChainScore: Math.round(score * 0.9),
      humanScore: 50,
      trustUpdatedAt: new Date(),
      // Market data
      marketCap: null,
      price: null,
      volume24h: null,
    };

    const existing = await prisma.project.findFirst({
      where: { OR: [{ address: addr }, { slug }] },
    });

    if (existing) {
      await prisma.project.update({ where: { id: existing.id }, data });
      updated++;
      process.stdout.write('·');
    } else {
      await prisma.project.create({ data: { address: addr, slug, ...data } });
      created++;
      process.stdout.write('+');
    }
  }

  // ── 2. Virtuals agents ─────────────────────────────────────────────────────
  const agents = await fetchVirtuals();
  console.log('\n\n🤖 Seeding Virtuals agents...');

  // Map VIRTUAL price to USD (approx — use $2 as baseline)
  const VIRTUAL_USD = 2.0;

  for (const a of agents) {
    const mcapM = a.mcapInVirtual * VIRTUAL_USD / 1e6;
    const score = agentTrustScore(mcapM, a.holderCount ?? 0);
    const grade = gradeFromScore(score);
    const addr = a.tokenAddress.toLowerCase();
    const slug = `${a.symbol.toLowerCase()}-base`;

    const twitterUrl = a.socials?.TWITTER ?? null;

    const data = {
      name: a.name,
      description: a.description?.slice(0, 500) || `${a.name} — AI agent on Virtuals Protocol (Base).`,
      symbol: a.symbol,
      website: `https://app.virtuals.io/virtuals/${a.tokenAddress}`,
      twitter: twitterUrl,
      github: null,
      image: null,
      category: 'm/ai-agents',
      chain: 'Base',
      status: 'active',
      trustScore: score,
      trustGrade: grade,
      onChainScore: Math.round(score * 0.8),
      offChainScore: Math.round(score * 1.1),
      humanScore: 50,
      trustUpdatedAt: new Date(),
      marketCap: Math.round(mcapM * 1e6),
      price: null,
      volume24h: a.volume24h ?? null,
    };

    const existing = await prisma.project.findFirst({
      where: { OR: [{ address: addr }, { slug }] },
    });

    if (existing) {
      await prisma.project.update({ where: { id: existing.id }, data });
      updated++;
      process.stdout.write('·');
    } else {
      await prisma.project.create({ data: { address: addr, slug, ...data } });
      created++;
      process.stdout.write('+');
    }
  }

  const total = await prisma.project.count();
  console.log(`\n\n✅ Done: +${created} created, ~${updated} updated`);
  console.log(`📦 Total in DB: ${total}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
