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

    // Search by name in rawMetrics OR by wallet address prefix
    const agents = await prisma.agentScore.findMany({
      where: {
        OR: [
          { walletAddress: { startsWith: q, mode: "insensitive" } },
          { rawMetrics: { path: ["name"], string_contains: q } },
        ],
      },
      select: {
        walletAddress: true,
        trustScore: true,
        rawMetrics: true,
      },
      orderBy: { trustScore: "desc" },
      take: limit,
    });

    const results = agents.map((a) => {
      const raw = a.rawMetrics as Record<string, unknown> | null;
      return {
        walletAddress: a.walletAddress,
        name: (raw?.name as string) ?? a.walletAddress.slice(0, 10) + "...",
        trustScore: a.trustScore,
        profilePic: (raw?.profilePic as string) ?? null,
      };
    });

    return NextResponse.json({ results }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error("[agent/search] Error:", err);
    return NextResponse.json({ error: "Search failed", results: [] }, { status: 500, headers: CORS_HEADERS });
  }
}
