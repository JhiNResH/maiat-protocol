import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import { prisma } from "@/lib/prisma";
import { rewardScarab } from "@/lib/scarab";
import { createRateLimiter, checkIpRateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const rateLimiter = createRateLimiter("kya:verify", 10, 60);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const KYA_SCARAB_REWARD = 5;
const KYA_TRUST_BOOST = 5;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/** Verify tweet contains the KYA code via Twitter oembed API */
async function verifyTweetContainsCode(
  tweetUrl: string,
  code: string,
): Promise<{ valid: boolean; error?: string }> {
  // Validate URL format
  const tweetPattern =
    /^https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/i;
  if (!tweetPattern.test(tweetUrl)) {
    return { valid: false, error: "Invalid tweet URL format" };
  }

  try {
    // Use Twitter oembed to fetch tweet content
    const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}&omit_script=true`;
    const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(10000) });

    if (!res.ok) {
      return { valid: false, error: "Tweet not found or is private" };
    }

    const data = (await res.json()) as { html?: string };
    const html = data.html ?? "";

    // Check if the tweet HTML contains the code
    if (!html.toUpperCase().includes(code.toUpperCase())) {
      return { valid: false, error: "Tweet does not contain the KYA code" };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "Failed to fetch tweet, it may be private or deleted" };
  }
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
    const { tweetUrl, code, verifierAddress: rawVerifier } = body as {
      tweetUrl?: string;
      code?: string;
      verifierAddress?: string;
    };

    // Validate inputs
    if (!tweetUrl || !code || !rawVerifier) {
      return NextResponse.json(
        { error: "tweetUrl, code, and verifierAddress are required" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    if (!isAddress(rawVerifier)) {
      return NextResponse.json(
        { error: "Invalid verifier address" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const verifierAddress = getAddress(rawVerifier);

    // Look up the KYA code
    const kyaCode = await prisma.kyaCode.findUnique({ where: { code: code.toUpperCase() } });
    if (!kyaCode) {
      return NextResponse.json(
        { error: "KYA code not found" },
        { status: 404, headers: CORS_HEADERS },
      );
    }

    // Prevent self-verification
    if (getAddress(kyaCode.agentAddress) === verifierAddress) {
      return NextResponse.json(
        { error: "Cannot verify your own agent code" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    // Check if already verified by this user
    const existing = await prisma.kyaVerification.findUnique({
      where: { codeId_verifierAddress: { codeId: kyaCode.id, verifierAddress } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "You have already verified this agent" },
        { status: 409, headers: CORS_HEADERS },
      );
    }

    // Verify the tweet
    const tweetCheck = await verifyTweetContainsCode(tweetUrl, code);
    if (!tweetCheck.valid) {
      return NextResponse.json(
        { error: tweetCheck.error },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    // All good — create verification + update agent score + reward verifier
    const [verification] = await prisma.$transaction([
      prisma.kyaVerification.create({
        data: {
          codeId: kyaCode.id,
          verifierAddress,
          tweetUrl,
          scarabAwarded: KYA_SCARAB_REWARD,
        },
      }),
      prisma.kyaCode.update({
        where: { id: kyaCode.id },
        data: { usageCount: { increment: 1 } },
      }),
    ]);

    // Boost agent trust score (+5) — update AgentScore if exists
    await prisma.agentScore
      .update({
        where: { walletAddress: kyaCode.agentAddress },
        data: { trustScore: { increment: KYA_TRUST_BOOST } },
      })
      .catch(() => {
        // Agent may not have an AgentScore record yet — not critical
      });

    // Reward verifier with Scarab
    await rewardScarab(
      verifierAddress,
      KYA_SCARAB_REWARD,
      `KYA verification reward for ${code} 🛡️`,
      verification.id,
    ).catch((err) => {
      console.error("[KYA:verify] Scarab reward failed:", err);
    });

    return NextResponse.json(
      {
        success: true,
        agentAddress: kyaCode.agentAddress,
        scarabAwarded: KYA_SCARAB_REWARD,
        trustBoost: KYA_TRUST_BOOST,
        message: `Verification complete! Agent trust +${KYA_TRUST_BOOST}, you earned ${KYA_SCARAB_REWARD} Scarab.`,
      },
      { headers: CORS_HEADERS },
    );
  } catch (err) {
    console.error("[KYA:verify] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
