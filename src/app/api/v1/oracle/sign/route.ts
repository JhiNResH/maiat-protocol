/**
 * GET /api/v1/oracle/sign?token=0x...
 *
 * Returns an EIP-712 signed trust score for a token.
 * The signature can be included in swap hookData for on-chain verification,
 * eliminating the need to push scores to the oracle contract.
 *
 * Flow:
 *   1. Swapper calls GET /api/v1/oracle/sign?token=0x...
 *   2. Gets back { token, score, timestamp, nonce, signature }
 *   3. Encodes into hookData: abi.encode(score, timestamp, nonce, signature)
 *   4. TrustGateHook.beforeSwap verifies signature via ecrecover
 *   5. If valid + score >= threshold → swap proceeds
 *
 * This is the production path — zero gas for score updates.
 */

import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import { signScore } from "@/lib/oracle-updater";
import { prisma } from "@/lib/prisma";
import { predictToken } from "@/lib/wadjet-client";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Maiat-Client",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token || !isAddress(token)) {
    return NextResponse.json(
      { error: "Invalid token address. Use ?token=0x..." },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const checksumToken = getAddress(token);

  try {
    // Get trust score from DB (fastest) or Wadjet (fallback)
    let score: number | null = null;

    // Try DB first — check if token is an agent's tokenAddress
    const agent = await prisma.agentScore.findFirst({
      where: { tokenAddress: checksumToken },
    });

    if (agent) {
      score = agent.trustScore;
    }

    // Fallback to Wadjet ML prediction
    if (score === null) {
      try {
        const wadjet = await predictToken(checksumToken);
        // Invert rug probability to trust score
        score = Math.round((1 - wadjet.rug_probability) * 100);
      } catch {
        // Wadjet unavailable — use neutral score
        score = 50;
      }
    }

    // Sign the score
    const signed = await signScore(checksumToken, score);

    return NextResponse.json(
      {
        ...signed,
        hookDataHex: encodeHookData(signed),
        usage: "Include hookDataHex in your swap transaction's hookData parameter",
      },
      {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          // Short cache — scores should be fresh
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (err) {
    console.error("[oracle/sign]", err);
    return NextResponse.json(
      { error: "Failed to sign score" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

/**
 * Encode signed score into hookData format that TrustGateHook can decode.
 * Format: abi.encode(uint256 score, uint256 timestamp, uint256 nonce, bytes signature)
 */
function encodeHookData(signed: {
  score: number;
  timestamp: number;
  nonce: number;
  signature: string;
}): string {
  // Simple ABI encoding: score (32 bytes) + timestamp (32 bytes) + nonce (32 bytes) + signature offset + signature
  const score = BigInt(signed.score).toString(16).padStart(64, "0");
  const timestamp = BigInt(signed.timestamp).toString(16).padStart(64, "0");
  const nonce = BigInt(signed.nonce).toString(16).padStart(64, "0");

  // Signature: strip 0x prefix
  const sig = signed.signature.startsWith("0x")
    ? signed.signature.slice(2)
    : signed.signature;

  // Dynamic bytes offset (4 * 32 = 128 = 0x80)
  const sigOffset = "0000000000000000000000000000000000000000000000000000000000000080";
  // Signature length (65 bytes)
  const sigLength = (sig.length / 2).toString(16).padStart(64, "0");

  // Pad signature to 32-byte boundary
  const sigPadded = sig.padEnd(Math.ceil(sig.length / 64) * 64, "0");

  return `0x${score}${timestamp}${nonce}${sigOffset}${sigLength}${sigPadded}`;
}
