/**
 * POST /api/v1/verify
 *
 * Verifies a Base Verify token for anti-sybil review protection.
 * Returns verification result + review weight multiplier.
 */

import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { verifyBaseToken, calculateReviewWeight } from "@/lib/base-verify";
import { createRateLimiter, checkIpRateLimit } from "@/lib/ratelimit";

const rateLimiter = createRateLimiter("verify", 10, 60);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  const { success: rlOk } = await checkIpRateLimit(request, rateLimiter);
  if (!rlOk) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: CORS_HEADERS }
    );
  }

  try {
    const body = await request.json();
    const { token, walletAddress } = body as {
      token?: string;
      walletAddress?: string;
    };

    if (!token || !walletAddress || !isAddress(walletAddress)) {
      return NextResponse.json(
        { error: "token and valid walletAddress required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const result = await verifyBaseToken(token, walletAddress);

    const weight = calculateReviewWeight({
      hasBaseVerify: result.verified,
    });

    return NextResponse.json(
      {
        verified: result.verified,
        provider: result.provider,
        accountVerified: result.accountVerified,
        followers: result.followers,
        reviewWeight: weight,
        message: result.verified
          ? `Verified via ${result.provider}. Your reviews will have ${weight}x weight.`
          : "Verification failed. You can still review with 1x weight.",
      },
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("[verify]", err);
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
