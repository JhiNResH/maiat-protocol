import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import { discoverInteractions } from "@/lib/interaction-check";
import { getKnownProtocolsMap, resolveSlug } from "@/lib/slug-resolver";
import { apiLog } from "@/lib/logger";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * GET /api/v1/wallet/:address/interactions
 *
 * Discovers contracts a wallet has interacted with on Base.
 * Matches against known protocols and returns reviewable contracts.
 *
 * Response includes:
 * - List of known contracts the wallet has interacted with
 * - Whether the wallet has already reviewed each contract
 * - Current trust score for each contract
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  if (!isAddress(address)) {
    return NextResponse.json(
      { error: "Invalid Ethereum address" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const checksummed = getAddress(address);

  try {
    // Get all known protocols
    const knownProtocols = getKnownProtocolsMap();

    // Discover interactions
    const interactions = await discoverInteractions(checksummed, knownProtocols);

    // Check which contracts have been reviewed by this wallet
    let reviewedAddresses = new Set<string>();
    try {
      const { prisma } = await import("@/lib/prisma");
      const existingReviews = await prisma.trustReview.findMany({
        where: { reviewer: checksummed },
        select: { address: true },
      });
      reviewedAddresses = new Set(
        existingReviews.map((r) => r.address.toLowerCase())
      );
    } catch {
      // DB not available — skip review check
    }

    // Get scores for each interacted contract
    const enrichedInteractions = await Promise.all(
      interactions.map(async (contract) => {
        const resolved = resolveSlug(contract.address);

        // Try to get live score
        let trustScore: number | null = null;
        try {
          const { computeTrustScore } = await import("@/lib/scoring");
          const result = await computeTrustScore(contract.address);
          trustScore = result.score;
        } catch {
          // Score unavailable
        }

        return {
          address: contract.address,
          name: contract.name || resolved?.name || "Unknown",
          category: contract.category || resolved?.category || "Unknown",
          slug: resolved?.slug || null,
          type: resolved?.type || "unknown",
          txCount: contract.txCount,
          firstTxDate: contract.firstTxDate,
          lastTxDate: contract.lastTxDate,
          trustScore,
          canReview: true, // They've interacted, so they can review
          hasReviewed: reviewedAddresses.has(contract.address.toLowerCase()),
          reviewUrl: `/api/v1/review`,
        };
      })
    );

    // Also include known protocols the user HASN'T interacted with
    // (so they know what else is available)
    const interactedAddresses = new Set(
      interactions.map((i) => i.address.toLowerCase())
    );
    const notInteracted = [];
    for (const [addr, info] of knownProtocols) {
      if (!interactedAddresses.has(addr.toLowerCase())) {
        const resolved = resolveSlug(addr);
        notInteracted.push({
          address: addr,
          name: info.name,
          category: info.category,
          slug: resolved?.slug || null,
          type: resolved?.type || "unknown",
          canReview: false,
          hasReviewed: reviewedAddresses.has(addr.toLowerCase()),
          reason: "No on-chain interaction found",
        });
      }
    }

    return NextResponse.json(
      {
        wallet: checksummed,
        interacted: enrichedInteractions,
        interactedCount: enrichedInteractions.length,
        notInteracted,
        notInteractedCount: notInteracted.length,
        totalKnownProtocols: knownProtocols.size,
        hint: "Submit reviews for contracts you've interacted with to earn Scarab rewards",
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    apiLog.error("wallet-interactions", error, { address: checksummed });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
