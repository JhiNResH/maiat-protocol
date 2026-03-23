import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserReputation } from "@/lib/reputation";
import { createRateLimiter, checkIpRateLimit } from "@/lib/ratelimit";

const rateLimiter = createRateLimiter("passport:lookup", 30, 60);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function isValidEnsName(name: string): boolean {
  return /^[a-z0-9-]{3,}$/.test(name);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const { success: rateLimitOk } = await checkIpRateLimit(request, rateLimiter);
  if (!rateLimitOk) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: CORS_HEADERS }
    );
  }

  const q = request.nextUrl.searchParams.get("q");
  if (!q || q.trim().length < 3) {
    return NextResponse.json(
      { error: "Query must be at least 3 characters.", available: false },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const cleanName = q.trim().toLowerCase().replace(/\.maiat\.eth$/, "");

  if (!isValidEnsName(cleanName)) {
    return NextResponse.json(
      { error: "Invalid name format.", available: false },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  try {
    // Check if name is taken (by displayName)
    const user = await prisma.user.findFirst({
      where: { displayName: { equals: cleanName, mode: "insensitive" } },
    });

    if (!user) {
      return NextResponse.json(
        { available: true, ensName: cleanName, ensFullName: `${cleanName}.maiat.eth` },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Name is taken — return passport info
    const reputation = await getUserReputation(user.address);
    const scarab = await prisma.scarabBalance.findUnique({
      where: { address: user.address },
    });

    return NextResponse.json(
      {
        available: false,
        passport: {
          ensName: cleanName,
          ensFullName: `${cleanName}.maiat.eth`,
          walletAddress: user.address,
          type: user.type ?? 'human',
          trustScore: reputation.reputationScore,
          verdict: getVerdict(reputation.reputationScore),
          totalQueries: reputation.totalReviews,
          scarabBalance: scarab?.balance ?? 0,
        },
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("Passport lookup error:", err);
    return NextResponse.json(
      { error: "Something went wrong.", available: false },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

function getVerdict(score: number): string {
  if (score >= 80) return "Trusted";
  if (score >= 60) return "Proceed";
  if (score >= 40) return "Caution";
  return "Avoid";
}
