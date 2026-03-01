/**
 * GET /api/v1/token/[address]
 *
 * Memecoin trust endpoint for trust_swap offering's second branch.
 * Checks honeypot status, token metadata, and Scarab reviews.
 *
 * Response includes:
 *   - trustScore (0-100)
 *   - verdict: "safe" | "caution" | "risky" | "blocked"
 *   - riskFlags: array of risk indicators
 *   - honeypot data from honeypot.is
 *   - scarabReviews from community
 */

import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";

// ── Prisma (optional — may not be configured) ──────────────────────────────────
let prisma: import("@prisma/client").PrismaClient | null = null;

async function getDb() {
  if (!process.env.DATABASE_URL) return null;
  if (!prisma) {
    const { prisma: client } = await import("@/lib/prisma");
    prisma = client;
  }
  return prisma;
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface HoneypotResult {
  isHoneypot: boolean | null;
  simulationSuccess: boolean | null;
  buyTax: number | null;
  sellTax: number | null;
  error?: string;
}

interface TokenMetadata {
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  totalSupply: string | null;
  error?: string;
}

interface ScarabReviews {
  averageRating: number | null;
  reviewCount: number;
}

type Verdict = "safe" | "caution" | "risky" | "blocked";

// ── CORS ───────────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// ── Honeypot.is API ────────────────────────────────────────────────────────────

async function checkHoneypot(address: string): Promise<HoneypotResult> {
  try {
    const res = await fetch(
      `https://api.honeypot.is/v2/IsHoneypot?address=${address}&chainID=8453`,
      { signal: AbortSignal.timeout(10_000) }
    );

    if (!res.ok) {
      return {
        isHoneypot: null,
        simulationSuccess: null,
        buyTax: null,
        sellTax: null,
        error: `Honeypot API returned ${res.status}`,
      };
    }

    const data = await res.json();

    return {
      isHoneypot: data.honeypotResult?.isHoneypot ?? null,
      simulationSuccess: data.simulationSuccess ?? null,
      buyTax: data.simulationResult?.buyTax != null
        ? parseFloat((data.simulationResult.buyTax * 100).toFixed(2))
        : null,
      sellTax: data.simulationResult?.sellTax != null
        ? parseFloat((data.simulationResult.sellTax * 100).toFixed(2))
        : null,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      isHoneypot: null,
      simulationSuccess: null,
      buyTax: null,
      sellTax: null,
      error: msg,
    };
  }
}

// ── Alchemy Token Metadata ─────────────────────────────────────────────────────

async function getTokenMetadata(address: string): Promise<TokenMetadata> {
  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) {
    return {
      name: null,
      symbol: null,
      decimals: null,
      totalSupply: null,
      error: "ALCHEMY_API_KEY not configured",
    };
  }

  try {
    const res = await fetch(
      `https://base-mainnet.g.alchemy.com/v2/${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "alchemy_getTokenMetadata",
          params: [address],
        }),
        signal: AbortSignal.timeout(5_000),
      }
    );

    const data = await res.json();

    if (data.error) {
      return {
        name: null,
        symbol: null,
        decimals: null,
        totalSupply: null,
        error: data.error.message ?? "Alchemy error",
      };
    }

    const result = data.result ?? {};
    return {
      name: result.name ?? null,
      symbol: result.symbol ?? null,
      decimals: result.decimals ?? null,
      totalSupply: result.totalSupply ?? null,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      name: null,
      symbol: null,
      decimals: null,
      totalSupply: null,
      error: msg,
    };
  }
}

// ── Scarab Reviews from DB ─────────────────────────────────────────────────────

async function getScarabReviews(address: string): Promise<ScarabReviews> {
  const db = await getDb();
  if (!db) {
    return { averageRating: null, reviewCount: 0 };
  }

  try {
    // Query TrustReview table (used by /api/v1/review)
    const reviews = await db.trustReview.findMany({
      where: {
        address: {
          equals: address,
          mode: "insensitive",
        },
      },
      select: { rating: true, weight: true },
    });

    if (reviews.length === 0) {
      return { averageRating: null, reviewCount: 0 };
    }

    // Weighted average
    let totalWeight = 0;
    let weightedSum = 0;
    for (const r of reviews) {
      totalWeight += r.weight;
      weightedSum += r.rating * r.weight;
    }

    const avgRating = totalWeight > 0
      ? Math.round((weightedSum / totalWeight) * 10) / 10
      : null;

    return {
      averageRating: avgRating,
      reviewCount: reviews.length,
    };
  } catch {
    return { averageRating: null, reviewCount: 0 };
  }
}

// ── Score Calculation ──────────────────────────────────────────────────────────

interface ScoreResult {
  trustScore: number;
  verdict: Verdict;
  riskFlags: string[];
  riskSummary: string;
}

function calculateScore(
  honeypot: HoneypotResult,
  reviews: ScarabReviews
): ScoreResult {
  const riskFlags: string[] = [];
  let score = 50; // Start at 50

  // ── Honeypot penalties ───────────────────────────────────────────────────────

  // Honeypot confirmed → instant block
  if (honeypot.isHoneypot === true) {
    riskFlags.push("HONEYPOT_DETECTED");
    return {
      trustScore: 0,
      verdict: "blocked",
      riskFlags,
      riskSummary: "Token is confirmed as a honeypot. Do not interact.",
    };
  }

  // Simulation failed
  if (honeypot.simulationSuccess === false) {
    score -= 20;
    riskFlags.push("UNVERIFIED");
  }

  // Honeypot check failed entirely
  if (honeypot.error) {
    riskFlags.push("HONEYPOT_CHECK_FAILED");
  }

  // Buy tax penalties
  if (honeypot.buyTax !== null) {
    if (honeypot.buyTax > 25) {
      score -= 30;
    } else if (honeypot.buyTax > 10) {
      score -= 15;
    }
  }

  // Sell tax penalties
  if (honeypot.sellTax !== null) {
    if (honeypot.sellTax > 25) {
      score -= 30;
      riskFlags.push("HIGH_SELL_TAX");
    } else if (honeypot.sellTax > 10) {
      score -= 15;
    }
  }

  // ── Review bonuses ───────────────────────────────────────────────────────────

  if (reviews.reviewCount >= 5 && reviews.averageRating !== null && reviews.averageRating >= 4) {
    score += 10;
  } else if (reviews.reviewCount >= 3 && reviews.averageRating !== null && reviews.averageRating >= 3) {
    score += 5;
  }

  // ── Clamp score ──────────────────────────────────────────────────────────────
  score = Math.max(0, Math.min(100, score));

  // ── Verdict mapping ──────────────────────────────────────────────────────────
  let verdict: Verdict;
  if (score >= 70) {
    verdict = "safe";
  } else if (score >= 50) {
    verdict = "caution";
  } else if (score >= 30) {
    verdict = "risky";
  } else {
    verdict = "blocked";
  }

  // ── Risk summary ─────────────────────────────────────────────────────────────
  const summaryParts: string[] = [];

  if (riskFlags.includes("HIGH_SELL_TAX") && honeypot.sellTax !== null) {
    summaryParts.push(`Token has elevated sell tax (${honeypot.sellTax}%).`);
  }

  if (riskFlags.includes("UNVERIFIED")) {
    summaryParts.push("Swap simulation failed; trade behavior is unverified.");
  }

  if (riskFlags.includes("HONEYPOT_CHECK_FAILED")) {
    summaryParts.push("Honeypot check could not be completed.");
  }

  if (summaryParts.length === 0) {
    if (verdict === "safe") {
      summaryParts.push("No major risks detected.");
    } else if (verdict === "caution") {
      summaryParts.push("Proceed with caution.");
    } else {
      summaryParts.push("Elevated risk detected.");
    }
  }

  return {
    trustScore: score,
    verdict,
    riskFlags,
    riskSummary: summaryParts.join(" "),
  };
}

// ── Main Handler ───────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  const rawAddress = params.address;

  // ── Validate address ─────────────────────────────────────────────────────────
  if (!rawAddress || !isAddress(rawAddress)) {
    return NextResponse.json(
      {
        error: "Invalid address",
        message: "Please provide a valid EVM token address (0x...)",
      },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const checksumAddress = getAddress(rawAddress);

  try {
    // ── Run 3 parallel checks ──────────────────────────────────────────────────
    const [honeypot, tokenMetadata, scarabReviews] = await Promise.all([
      checkHoneypot(checksumAddress),
      getTokenMetadata(checksumAddress),
      getScarabReviews(checksumAddress),
    ]);

    // ── Check for total data failure ───────────────────────────────────────────
    const hasNoData =
      honeypot.error &&
      tokenMetadata.error &&
      scarabReviews.reviewCount === 0;

    if (hasNoData) {
      return NextResponse.json(
        {
          address: checksumAddress,
          trustScore: 40,
          verdict: "caution" as Verdict,
          riskFlags: ["LIMITED_DATA"],
          riskSummary: "Unable to retrieve sufficient data for this token. Proceed with caution.",
          honeypot: {
            isHoneypot: null,
            buyTax: null,
            sellTax: null,
            simulationSuccess: null,
          },
          scarabReviews: {
            averageRating: null,
            reviewCount: 0,
          },
          dataSource: "LIMITED",
        },
        {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
          },
        }
      );
    }

    // ── Calculate score ────────────────────────────────────────────────────────
    const { trustScore, verdict, riskFlags, riskSummary } = calculateScore(
      honeypot,
      scarabReviews
    );

    // ── Build response ─────────────────────────────────────────────────────────
    return NextResponse.json(
      {
        address: checksumAddress,
        trustScore,
        verdict,
        riskFlags,
        riskSummary,
        honeypot: {
          isHoneypot: honeypot.isHoneypot,
          buyTax: honeypot.buyTax,
          sellTax: honeypot.sellTax,
          simulationSuccess: honeypot.simulationSuccess,
        },
        scarabReviews: {
          averageRating: scarabReviews.averageRating,
          reviewCount: scarabReviews.reviewCount,
        },
        dataSource: "HONEYPOT_IS + ALCHEMY + SCARAB",
      },
      {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Token Trust API] Error:", msg);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
