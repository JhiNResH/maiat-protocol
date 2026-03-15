import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createRateLimiter, checkIpRateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const rateLimiter = createRateLimiter("kya:code", 60, 60);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { success: rlOk } = await checkIpRateLimit(request, rateLimiter);
  if (!rlOk) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: CORS_HEADERS },
    );
  }

  try {
    const { code: rawCode } = await params;
    const code = rawCode.toUpperCase();

    if (!/^MAIAT-[A-Z0-9]{4}$/.test(code)) {
      return NextResponse.json(
        { error: "Invalid KYA code format. Expected MAIAT-XXXX" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const kyaCode = await prisma.kyaCode.findUnique({
      where: { code },
      include: {
        verifications: {
          orderBy: { verifiedAt: "desc" },
          take: 20,
          select: {
            verifierAddress: true,
            verifiedAt: true,
            scarabAwarded: true,
          },
        },
      },
    });

    if (!kyaCode) {
      return NextResponse.json(
        { error: "KYA code not found" },
        { status: 404, headers: CORS_HEADERS },
      );
    }

    // Try to enrich with agent info from AgentScore
    let agentInfo: { trustScore?: number; totalJobs?: number; tokenSymbol?: string | null } = {};
    const agentScore = await prisma.agentScore
      .findUnique({ where: { walletAddress: kyaCode.agentAddress } })
      .catch(() => null);

    if (agentScore) {
      agentInfo = {
        trustScore: agentScore.trustScore,
        totalJobs: agentScore.totalJobs,
        tokenSymbol: agentScore.tokenSymbol,
      };
    }

    return NextResponse.json(
      {
        code: kyaCode.code,
        agentAddress: kyaCode.agentAddress,
        usageCount: kyaCode.usageCount,
        createdAt: kyaCode.createdAt,
        agent: agentInfo,
        recentVerifications: kyaCode.verifications,
      },
      {
        headers: {
          ...CORS_HEADERS,
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      },
    );
  } catch (err) {
    console.error("[KYA:code] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
