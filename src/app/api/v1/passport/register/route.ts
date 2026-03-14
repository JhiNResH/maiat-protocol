import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserReputation } from "@/lib/reputation";
import { createRateLimiter, checkIpRateLimit } from "@/lib/ratelimit";

const rateLimiter = createRateLimiter("passport:register", 10, 60);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Maiat-Client",
};

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function isValidEnsName(name: string): boolean {
  return /^[a-z0-9-]{3,}$/.test(name);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  // Rate limit
  const { success: rateLimitOk } = await checkIpRateLimit(request, rateLimiter);
  if (!rateLimitOk) {
    return NextResponse.json(
      { error: "Too many requests. Retry after 1 minute." },
      { status: 429, headers: CORS_HEADERS }
    );
  }

  try {
    const body = await request.json();
    const { ensName, walletAddress, type } = body;

    // Validate
    if (!ensName || !isValidEnsName(ensName.replace(/\.maiat\.eth$/, ""))) {
      return NextResponse.json(
        { error: "Invalid ENS name. Must be 3+ characters, lowercase letters, numbers, or hyphens." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!walletAddress || !isValidAddress(walletAddress)) {
      return NextResponse.json(
        { error: "Invalid wallet address." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const normalizedAddress = walletAddress.toLowerCase();
    const cleanEnsName = ensName.replace(/\.maiat\.eth$/, "");
    const fullEnsName = `${cleanEnsName}.maiat.eth`;

    // Check if address already registered
    const existingUser = await prisma.user.findUnique({
      where: { address: normalizedAddress },
    });

    if (existingUser) {
      // Already registered — return existing passport
      const reputation = await getUserReputation(normalizedAddress);
      const scarab = await prisma.scarabBalance.findUnique({
        where: { address: normalizedAddress },
      });

      return NextResponse.json({
        passport: {
          ensName: cleanEnsName,
          ensFullName: fullEnsName,
          walletAddress: normalizedAddress,
          trustScore: reputation.reputationScore,
          verdict: getVerdict(reputation.reputationScore),
          totalQueries: reputation.totalReviews,
          scarabBalance: scarab?.balance ?? 0,
          isNew: false,
        },
      }, { status: 200, headers: CORS_HEADERS });
    }

    // Check if displayName (ENS) already taken
    const existingName = await prisma.user.findFirst({
      where: { displayName: { equals: cleanEnsName, mode: "insensitive" } },
    });

    if (existingName) {
      return NextResponse.json(
        { error: "This name is already taken." },
        { status: 409, headers: CORS_HEADERS }
      );
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        address: normalizedAddress,
        displayName: cleanEnsName,
      },
    });

    // Create Scarab balance with 10 bonus
    const scarab = await prisma.scarabBalance.upsert({
      where: { address: normalizedAddress },
      update: { balance: { increment: 10 }, totalEarned: { increment: 10 } },
      create: {
        address: normalizedAddress,
        balance: 10,
        totalEarned: 10,
      },
    });

    // Log the registration bonus
    await prisma.scarabTransaction.create({
      data: {
        address: normalizedAddress,
        amount: 10,
        type: "registration_bonus",
        description: `Registration bonus for ${fullEnsName}`,
        balanceAfter: scarab.balance,
      },
    });

    const reputation = await getUserReputation(normalizedAddress);

    return NextResponse.json({
      passport: {
        ensName: cleanEnsName,
        ensFullName: fullEnsName,
        walletAddress: normalizedAddress,
        trustScore: reputation.reputationScore,
        verdict: getVerdict(reputation.reputationScore),
        totalQueries: 0,
        scarabBalance: 10,
        isNew: true,
      },
    }, { status: 201, headers: CORS_HEADERS });

  } catch (err) {
    console.error("Passport register error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Try again." },
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
