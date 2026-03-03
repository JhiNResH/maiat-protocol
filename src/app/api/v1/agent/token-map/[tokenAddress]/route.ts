/**
 * GET /api/v1/agent/token-map/[tokenAddress]
 *
 * Reverse lookup: Token contract address → ACP Agent wallet.
 * Returns the agent's wallet address and trust score if found.
 *
 * Response format:
 * {
 *   "tokenAddress": "0x...",
 *   "walletAddress": "0x...",
 *   "agentName": "SomeAgent",
 *   "trustScore": 72,
 *   "verdict": "proceed",
 *   "source": "DB"
 * }
 *
 * If not found:
 * {
 *   "tokenAddress": "0x...",
 *   "walletAddress": null,
 *   "agentName": null,
 *   "trustScore": null,
 *   "verdict": "unknown",
 *   "source": "NOT_FOUND"
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Map trust score to a human-readable verdict */
function scoreToVerdict(score: number | null): "proceed" | "caution" | "avoid" | "unknown" {
  if (score === null) return "unknown";
  if (score >= 80) return "proceed";
  if (score >= 60) return "caution";
  return "avoid";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tokenAddress: string }> }
) {
  try {
    // ── Validate address ─────────────────────────────────────────────────────
    const { tokenAddress } = await params;
    const rawAddress = tokenAddress;

    if (!rawAddress || !isAddress(rawAddress)) {
      return NextResponse.json(
        {
          error: "Invalid token address",
          message: "Please provide a valid EVM contract address (0x...)",
        },
        { status: 400 }
      );
    }

    // Normalize to checksum and lowercase for DB query
    const checksumAddress = getAddress(rawAddress);
    const lowerAddress = rawAddress.toLowerCase();

    // ── Query Supabase ────────────────────────────────────────────────────────
    const record = await prisma.agentScore.findFirst({
      where: {
        tokenAddress: {
          equals: lowerAddress,
          mode: "insensitive",
        },
      },
      select: {
        walletAddress: true,
        trustScore: true,
        rawMetrics: true,
      },
    });

    // ── Not found ────────────────────────────────────────────────────────────
    if (!record) {
      return NextResponse.json(
        {
          tokenAddress: checksumAddress,
          walletAddress: null,
          agentName: null,
          trustScore: null,
          verdict: "unknown",
          source: "NOT_FOUND",
          message:
            "No ACP agent found with this token address. " +
            "This may not be an agent token, or the mapping hasn't been indexed yet.",
        },
        {
          status: 404,
          headers: { "Cache-Control": "public, s-maxage=60" },
        }
      );
    }

    // ── Build response ───────────────────────────────────────────────────────
    const rawMetrics = record.rawMetrics as { name?: string } | null;
    const agentName = rawMetrics?.name ?? null;

    return NextResponse.json(
      {
        tokenAddress: checksumAddress,
        walletAddress: record.walletAddress,
        agentName,
        trustScore: record.trustScore,
        verdict: scoreToVerdict(record.trustScore),
        source: "DB",
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Token-Map API] Error:", msg);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
