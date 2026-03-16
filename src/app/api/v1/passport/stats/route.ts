import { NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";

// Match engagement API logic — take max of DB + Virtuals live count
let virtualsCache: { count: number; expiresAt: number } | null = null;

async function getVirtualsCount(): Promise<number> {
  if (virtualsCache && virtualsCache.expiresAt > Date.now()) return virtualsCache.count;
  try {
    const res = await fetch("https://acpx.virtuals.io/api/agents?pagination[page]=1&pagination[pageSize]=1", {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return 0;
    const json = await res.json() as { meta?: { pagination?: { total?: number } } };
    const total = json.meta?.pagination?.total ?? 0;
    virtualsCache = { count: total, expiresAt: Date.now() + 10 * 60 * 1000 };
    return total;
  } catch { return 0; }
}

export async function GET() {
  try {
    const [passports, queries, agentsDb, agentsLive] = await Promise.all([
      prisma.scarabBalance.count(),
      prisma.queryLog.count(),
      prisma.agentScore.count(),
      getVirtualsCount(),
    ]);

    return NextResponse.json({
      passports,
      queries,
      agents: Math.max(agentsDb, agentsLive),
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch {
    return NextResponse.json({ passports: 0, queries: 0, agents: 0 });
  }
}
