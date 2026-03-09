import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Maiat-Client, X-Maiat-Key",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/v1/agent/search?q=...&limit=5
export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim();
    const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 10), 20);

    if (!q || q.length < 2) {
      return NextResponse.json({ results: [] }, { headers: CORS_HEADERS });
    }

    // Search by name (case-insensitive) OR wallet address prefix
    // Use Prisma findMany instead of raw SQL to avoid parameterization issues
    const qLower = q.toLowerCase();
    const isAddress = qLower.startsWith('0x');

    // Search AgentScore table
    const agents = await prisma.agentScore.findMany({
      where: isAddress
        ? { walletAddress: { startsWith: q, mode: 'insensitive' } }
        : { walletAddress: { not: '' } }, // will filter by rawMetrics name below
      orderBy: { trustScore: 'desc' },
      take: isAddress ? limit : 200, // fetch more for name filtering
    });

    // Filter by name in rawMetrics (can't do JSONB query via Prisma findMany)
    const filtered = isAddress
      ? agents
      : agents.filter((a) => {
          const raw = a.rawMetrics as Record<string, unknown> | null;
          const name = (raw?.name as string) ?? '';
          return name.toLowerCase().includes(qLower);
        }).slice(0, limit);

    const results = filtered.map((a) => {
      const raw = a.rawMetrics as Record<string, unknown> | null;
      return {
        walletAddress: a.walletAddress,
        name: (raw?.name as string) ?? a.walletAddress.slice(0, 10) + "...",
        trustScore: a.trustScore,
        profilePic: (raw?.profilePic as string) ?? (raw?.logo as string) ?? null,
      };
    });

    // Fallback: also search Project table for agents not in AgentScore
    const existingAddresses = new Set(results.map(r => r.walletAddress.toLowerCase()));
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { address: { startsWith: q, mode: 'insensitive' } },
        ],
      },
      take: limit,
      select: { address: true, name: true, logo: true, trust: true },
    });

    for (const p of projects) {
      if (p.address && !existingAddresses.has(p.address.toLowerCase())) {
        results.push({
          walletAddress: p.address,
          name: p.name ?? p.address.slice(0, 10) + "...",
          trustScore: (p.trust as any)?.score ? Number((p.trust as any).score) / 10 : 0,
          profilePic: p.logo ?? null,
        });
      }
    }

    return NextResponse.json({ results: results.slice(0, limit) }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error("[agent/search] Error:", err);
    return NextResponse.json({ error: "Search failed", results: [] }, { status: 500, headers: CORS_HEADERS });
  }
}
