import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function GET(request: NextRequest) {
  try {
    const projects = await prisma.project.findMany({
      where: { status: "active" },
      orderBy: { trustScore: "desc" },
    });

    const memeSymbols = ['PIPPIN', 'LUNA', 'GOAT', 'ANON', 'CB', 'SPEC'];

    return NextResponse.json(
      {
        projects: projects.map((p) => {
          // Normalize categories (DB stores m/defi, m/ai-agents etc.)
          let category: string;
          if (p.category === 'm/ai-agents') {
            category = 'Agent';
          } else if (p.category === 'm/defi' || p.category === 'DEX' || p.category === 'Lending' || p.category === 'DeFi') {
            category = 'DeFi';
          } else if (p.category === 'm/memecoin' || p.category === 'Memecoins') {
            category = 'Memecoins';
          } else {
            category = p.category || 'Other'; // fallback to actual category or 'Other'
          }

          // Heuristic override for known memecoins
          if (p.symbol && memeSymbols.includes(p.symbol.toUpperCase())) {
            category = 'Memecoins';
          }

          return {
            id: p.id,
            address: p.address,
            name: p.name,
            symbol: p.symbol,
            category,
            chain: p.chain || 'Base',
            trustScore: p.trustScore != null ? p.trustScore / 10 : null,
            description: p.description,
            marketCap: p.marketCap,
            reviewCount: p.reviewCount,
            avgRating: p.avgRating,
            tier: p.tier,
            price: p.price,
            volume24h: p.volume24h,
          };
        }),
        count: projects.length,
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("[Explore API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
