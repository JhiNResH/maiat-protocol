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

interface DexScreenerData {
  sells24h: number;
  buys24h: number;
  volume24h: number;
  liquidity: number;
  priceChange24h: number | null;
  dex: string | null;
  pairLabel: string | null; // e.g. "v4"
  error?: string;
}

type Verdict = "trusted" | "proceed" | "caution" | "avoid";

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

// ── DexScreener API ────────────────────────────────────────────────────────────

async function getDexScreenerData(address: string): Promise<DexScreenerData> {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`,
      { signal: AbortSignal.timeout(8_000) }
    );

    if (!res.ok) {
      return { sells24h: 0, buys24h: 0, volume24h: 0, liquidity: 0, priceChange24h: null, dex: null, pairLabel: null, error: `DexScreener returned ${res.status}` };
    }

    const data = await res.json();
    const pairs = data.pairs;

    if (!pairs || pairs.length === 0) {
      return { sells24h: 0, buys24h: 0, volume24h: 0, liquidity: 0, priceChange24h: null, dex: null, pairLabel: null, error: "No pairs found" };
    }

    // Use the pair with the highest liquidity
    const best = pairs.reduce((a: Record<string, unknown>, b: Record<string, unknown>) => {
      const liqA = (a.liquidity as Record<string, number>)?.usd ?? 0;
      const liqB = (b.liquidity as Record<string, number>)?.usd ?? 0;
      return liqB > liqA ? b : a;
    });

    const txns = best.txns as Record<string, Record<string, number>> | undefined;
    const h24 = txns?.h24 ?? { buys: 0, sells: 0 };

    return {
      sells24h: h24.sells ?? 0,
      buys24h: h24.buys ?? 0,
      volume24h: (best.volume as Record<string, number>)?.h24 ?? 0,
      liquidity: (best.liquidity as Record<string, number>)?.usd ?? 0,
      priceChange24h: (best.priceChange as Record<string, number>)?.h24 ?? null,
      dex: (best.dexId as string) ?? null,
      pairLabel: (best.labels as string[])?.[0] ?? null,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { sells24h: 0, buys24h: 0, volume24h: 0, liquidity: 0, priceChange24h: null, dex: null, pairLabel: null, error: msg };
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
  reviews: ScarabReviews,
  dex?: DexScreenerData
): ScoreResult {
  const riskFlags: string[] = [];
  let score = 50; // Start at 50

  // ── Honeypot penalties (with DexScreener cross-verification) ─────────────────

  if (honeypot.isHoneypot === true) {
    // Cross-verify with on-chain trading data
    const hasTradingActivity = dex && !dex.error && dex.sells24h >= 50;
    const isV4Pool = dex?.pairLabel === "v4";

    if (hasTradingActivity) {
      // DexScreener shows real sells happening → likely false positive
      riskFlags.push("HONEYPOT_FLAGGED_BUT_TRADEABLE");
      if (isV4Pool) {
        riskFlags.push("UNISWAP_V4_POOL");
      }
      // Don't instant-block; penalize but let other factors weigh in
      score -= 15;
    } else {
      // No trading activity to contradict → trust honeypot.is verdict
      riskFlags.push("HONEYPOT_DETECTED");
      return {
        trustScore: 0,
        verdict: "avoid",
        riskFlags,
        riskSummary: "Token is confirmed as a honeypot. Do not interact.",
      };
    }
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

  // ── DexScreener bonuses / penalties ────────────────────────────────────────

  if (dex && !dex.error) {
    // Liquidity bonus
    if (dex.liquidity >= 500_000) {
      score += 10;
    } else if (dex.liquidity >= 100_000) {
      score += 5;
    } else if (dex.liquidity < 10_000 && dex.liquidity > 0) {
      score -= 10;
      riskFlags.push("LOW_LIQUIDITY");
    }

    // Volume bonus
    if (dex.volume24h >= 100_000) {
      score += 5;
    }

    // Extreme sell pressure warning
    if (dex.buys24h > 0 && dex.sells24h / dex.buys24h > 4) {
      score -= 5;
      riskFlags.push("HIGH_SELL_PRESSURE");
    }
  } else if (dex?.error) {
    riskFlags.push("DEXSCREENER_UNAVAILABLE");
  }

  // ── Clamp score ──────────────────────────────────────────────────────────────
  score = Math.max(0, Math.min(100, score));

  // ── Verdict mapping ──────────────────────────────────────────────────────────
  let verdict: Verdict;
  if (score >= 80) {
    verdict = "trusted";
  } else if (score >= 60) {
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
    logQuery({ type: "token_check", target: checksumAddress, clientId: _clientId, callerIp: _callerIp, userAgent: _userAgent, trustScore: 100, verdict: "trusted", metadata: { tokenType: "known_safe", symbol } });
    return NextResponse.json(
      {
        address: checksumAddress,
        tokenType: "known_safe",
        trustScore: 100,
        verdict: "trusted" as Verdict,
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
          score >= 80 ? "trusted" : score >= 60 ? "proceed" : score >= 40 ? "caution" : "avoid";
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
    // ── Run 4 parallel checks ──────────────────────────────────────────────────
    const [honeypot, tokenMetadata, scarabReviews, dexData] = await Promise.all([
      checkHoneypot(checksumAddress),
      getTokenMetadata(checksumAddress),
      getScarabReviews(checksumAddress),
      getDexScreenerData(checksumAddress),
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
      scarabReviews,
      dexData
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
        tokenName: tokenMetadata.name,
        tokenSymbol: tokenMetadata.symbol,
        buyTax: honeypot.buyTax,
        sellTax: honeypot.sellTax,
        dexScreener: dexData.error
          ? { error: dexData.error }
          : {
              sells24h: dexData.sells24h,
              buys24h: dexData.buys24h,
              volume24h: dexData.volume24h,
              liquidity: dexData.liquidity,
              priceChange24h: dexData.priceChange24h,
              dex: dexData.dex,
              pairLabel: dexData.pairLabel,
            },
        tokenType: "memecoin",
        dataSource: "HONEYPOT_IS + ALCHEMY + SCARAB + DEXSCREENER",
        _outcomeReporting: {
          endpoint: "POST /api/v1/outcome",
          required: { agentAddress: checksumAddress, outcome: "success|failure|partial|expired", txHash: "on-chain tx hash", jobId: "query ID" },
          headers: { "X-Maiat-Client": "your-client-id" },
          reward: "+2 🪲 Scarab per outcome reported",
        },
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
