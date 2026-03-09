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
    // Use tagged template $queryRaw for safe parameterized queries
    const addrPattern = `${q.toLowerCase()}%`;
    const namePattern = `%${q.toLowerCase()}%`;
    const agents = await prisma.$queryRaw<Array<{
      walletAddress: string;
      trustScore: number;
      rawMetrics: Record<string, unknown> | null;
    }>>`SELECT "walletAddress", "trustScore", "rawMetrics"
       FROM "AgentScore"
       WHERE LOWER("walletAddress") LIKE ${addrPattern}
          OR LOWER(CAST("rawMetrics"->>'name' AS TEXT)) LIKE ${namePattern}
       ORDER BY "trustScore" DESC
       LIMIT ${limit}`;

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
