import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import { prisma } from "@/lib/prisma";
import { createRateLimiter, checkIpRateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const rateLimiter = createRateLimiter("kya:generate", 10, 60);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Wallet-Address",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/** Generate a 4-char alphanumeric code: MAIAT-XXXX */
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 to avoid confusion
  let result = "";
  for (let i = 0; i < 4; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return `MAIAT-${result}`;
}

export async function POST(request: NextRequest) {
  // Rate limit
  const { success: rlOk } = await checkIpRateLimit(request, rateLimiter);
  if (!rlOk) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: CORS_HEADERS },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const rawAddress =
      body.agentAddress || request.headers.get("x-wallet-address");

    if (!rawAddress || !isAddress(rawAddress)) {
      return NextResponse.json(
        { error: "Valid wallet address required (body.agentAddress or X-Wallet-Address header)" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const agentAddress = getAddress(rawAddress);

    // Check if agent already has a code
    const existing = await prisma.kyaCode.findFirst({
      where: { agentAddress },
    });

    if (existing) {
      const shareText = `I trust this agent 🛡️ #MaiatVerified ${existing.code} passport.maiat.io/verify/${existing.code}`;
      return NextResponse.json(
        {
          code: existing.code,
          shareText,
          tweetUrl: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
          alreadyExists: true,
        },
        { headers: CORS_HEADERS },
      );
    }

    // Generate unique code with retry
    let code: string = "";
    let attempts = 0;
    while (attempts < 10) {
      code = generateCode();
      const conflict = await prisma.kyaCode.findUnique({ where: { code } });
      if (!conflict) break;
      attempts++;
    }

    if (attempts >= 10) {
      return NextResponse.json(
        { error: "Failed to generate unique code, try again" },
        { status: 500, headers: CORS_HEADERS },
      );
    }

    const kyaCode = await prisma.kyaCode.create({
      data: { code, agentAddress },
    });

    const shareText = `I trust this agent 🛡️ #MaiatVerified ${kyaCode.code} passport.maiat.io/verify/${kyaCode.code}`;

    return NextResponse.json(
      {
        code: kyaCode.code,
        shareText,
        tweetUrl: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
        alreadyExists: false,
      },
      { status: 201, headers: CORS_HEADERS },
    );
  } catch (err) {
    console.error("[KYA:generate] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
