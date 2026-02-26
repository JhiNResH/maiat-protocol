import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import { prisma } from "@/lib/prisma";
import { computeTrustScore } from "@/lib/scoring";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    // 1. Try DB lookup by slug or address
    const existing = await prisma.project.findFirst({
      where: { OR: [{ slug }, { address: slug }] },
    });

    if (existing) {
      return NextResponse.json({ project: existing }, { headers: CORS_HEADERS });
    }

    // 2. Auto-create if it's a valid EVM address not in DB
    if (!isAddress(slug)) {
      return NextResponse.json({ error: "Not found" }, { status: 404, headers: CORS_HEADERS });
    }

    const checksummed = getAddress(slug);
    const chainParam = req.nextUrl.searchParams.get("chain") ?? "base";

    // Score it on-chain
    const scoreData = await computeTrustScore(checksummed, chainParam as any);

    // Build a minimal project record
    const autoSlug = checksummed.toLowerCase().slice(2, 10); // e.g. "4f9fd6be"
    const autoProject = await prisma.project.create({
      data: {
        name: scoreData.protocol?.name ?? `0x${checksummed.slice(2, 8)}…`,
        slug: `auto-${autoSlug}`,
        address: checksummed,
        chain: chainParam === "eth" ? "Ethereum" : chainParam === "bnb" ? "BNB" : "Base",
        category: scoreData.type === "TOKEN" ? "m/ai-agents" : "m/defi",
        description: `Auto-indexed by Maiat. ${scoreData.type ?? "Contract"} on ${chainParam}.`,
        status: "active",
        trustScore: Math.round(scoreData.score * 10),
        avgRating: 0,
        reviewCount: 0,
      },
    });

    return NextResponse.json({ project: autoProject, autoCreated: true }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error("[Project API]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500, headers: CORS_HEADERS });
  }
}
