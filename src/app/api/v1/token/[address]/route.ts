/**
 * GET /api/v1/token/[address]
 *
 * Token trust endpoint. Resolution order:
 *   1. KNOWN_SAFE_LIST  → return proceed immediately (no external calls)
 *   2. AgentScore DB    → if agent token, return behavioral trust
 *   3. Honeypot.is      → memecoin / unknown token safety check
 *
 * Response includes:
 *   - tokenType: "known_safe" | "agent_token" | "memecoin"
 *   - trustScore (0-100)
 *   - verdict: "proceed" | "caution" | "avoid"
 *   - riskFlags: array of risk indicators
 */

import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import { logQuery } from "@/lib/query-logger";

// ── Known-safe whitelist ──────────────────────────────────────────────────────
// Tokens that are universally trusted — skip all external checks.

const KNOWN_SAFE: Record<string, { symbol: string; name: string }> = {
  // ETH (zero address convention)
  "0x0000000000000000000000000000000000000000": { symbol: "ETH",  name: "Ether" },
  // Base WETH
  "0x4200000000000000000000000000000000000006": { symbol: "WETH", name: "Wrapped Ether" },
  // Base USDC
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913": { symbol: "USDC", name: "USD Coin" },
  // Ethereum USDC
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": { symbol: "USDC", name: "USD Coin" },
  // WBTC (Base)
  "0x0555E30da8f98308EdB960aa94C0Db47230d2B9c": { symbol: "WBTC", name: "Wrapped Bitcoin" },
  // DAI (Base)
  "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb": { symbol: "DAI",  name: "Dai Stablecoin" },
  // VIRTUAL (Base) — Virtuals Protocol native token
  "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b": { symbol: "VIRTUAL", name: "Virtual Protocol" },
  // VIRTUAL (Ethereum)
  "0x44ff8620b8cA30902395A7bD3F2407e1A091BF73": { symbol: "VIRTUAL", name: "Virtual Protocol" },
};

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

type Verdict = "proceed" | "caution" | "avoid";

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
      verdict: "avoid",
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
      riskFlags.push("HIGH_BUY_TAX");
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
    verdict = "proceed";
  } else if (score >= 40) {
    verdict = "caution";
  } else {
    verdict = "avoid";
  }

  // ── Risk summary ─────────────────────────────────────────────────────────────
  const summaryParts: string[] = [];

  if (riskFlags.includes("HIGH_BUY_TAX") && honeypot.buyTax !== null) {
    summaryParts.push(`Token has elevated buy tax (${honeypot.buyTax}%).`);
  }

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
    if (verdict === "proceed") {
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
  { params }: { params: Promise<{ address: string }> }
) {
  const { address: rawAddress } = await params;
  const _callerIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || undefined;
  const _userAgent = request.headers.get("user-agent") || undefined;
  const _clientId = request.headers.get("x-maiat-client") ?? undefined;

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

  // ── Step 1: KNOWN_SAFE whitelist ─────────────────────────────────────────────
  if (KNOWN_SAFE[checksumAddress]) {
    const { symbol, name } = KNOWN_SAFE[checksumAddress];
    logQuery({ type: "token_check", target: checksumAddress, clientId: _clientId, callerIp: _callerIp, userAgent: _userAgent, trustScore: 100, verdict: "proceed", metadata: { tokenType: "known_safe", symbol } });
    return NextResponse.json(
      {
        address: checksumAddress,
        tokenType: "known_safe",
        trustScore: 100,
        verdict: "proceed" as Verdict,
        riskFlags: [],
        riskSummary: `${name} (${symbol}) is a verified safe token.`,
        scarabReviews: { averageRating: null, reviewCount: 0 },
        dataSource: "KNOWN_SAFE_LIST",
      },
      {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
        },
      }
    );
  }

  // ── Step 2: AgentScore DB (agent tokens) ────────────────────────────────────
  const db = await getDb();
  if (db) {
    try {
      const agentScore = await db.agentScore.findFirst({
        where: { walletAddress: { equals: checksumAddress.toLowerCase() } },
        select: {
          walletAddress: true,
          rawMetrics: true,
          trustScore: true,
          completionRate: true,
          paymentRate: true,
          totalJobs: true,
        },
      });

      if (agentScore) {
        const raw = (agentScore.rawMetrics ?? {}) as Record<string, unknown>;
        const agentName = typeof raw.name === 'string' ? raw.name : checksumAddress;
        const hasScore = agentScore.trustScore !== null;
        const score = agentScore.trustScore ?? 50;
        const verdict: Verdict =
          score >= 70 ? "proceed" : score >= 40 ? "caution" : "avoid";
        const agentRiskFlags: string[] = [];
        if (score < 40) agentRiskFlags.push("LOW_AGENT_TRUST");
        if (!hasScore) agentRiskFlags.push("INSUFFICIENT_DATA");
        const scarabReviews = await getScarabReviews(checksumAddress);
        logQuery({ type: "token_check", target: checksumAddress, clientId: _clientId, callerIp: _callerIp, userAgent: _userAgent, trustScore: score, verdict, metadata: { tokenType: "agent_token", totalJobs: agentScore.totalJobs } });
        return NextResponse.json(
          {
            address: checksumAddress,
            tokenType: "agent_token",
            trustScore: score,
            verdict,
            riskFlags: agentRiskFlags,
            riskSummary: !hasScore
              ? `ACP agent ${agentName} has no recorded jobs yet.`
              : `ACP agent ${agentName}. Completion rate: ${agentScore.completionRate ?? "?"}%.`,
            agentData: {
              name: agentName,
              completionRate: agentScore.completionRate,
              paymentRate: agentScore.paymentRate,
              totalJobs: agentScore.totalJobs,
            },
            scarabReviews: {
              averageRating: scarabReviews.averageRating,
              reviewCount: scarabReviews.reviewCount,
            },
            dataSource: "AGENT_SCORE_DB",
          },
          {
            status: 200,
            headers: {
              ...CORS_HEADERS,
              "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
            },
          }
        );
      }
    } catch {
      // AgentScore lookup failed — fall through to honeypot check
    }
  }

  // ── Step 3: Honeypot.is (memecoin / unknown) ─────────────────────────────────
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
          tokenType: "memecoin",
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
    logQuery({ type: "token_check", target: checksumAddress, clientId: _clientId, callerIp: _callerIp, userAgent: _userAgent, trustScore, verdict, metadata: { tokenType: "memecoin", isHoneypot: honeypot.isHoneypot, riskFlags } });
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
        tokenType: "memecoin",
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
