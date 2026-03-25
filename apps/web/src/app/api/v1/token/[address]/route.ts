/**
 * GET /api/v1/token/[address]
 *
 * Token CONTRACT SAFETY endpoint. Resolution order:
 *   1. KNOWN_SAFE_LIST  → return proceed immediately (no external calls)
 *   2. Honeypot.is + GoPlus + DexScreener → contract safety analysis
 *
 * For agent BEHAVIORAL trust, use GET /api/v1/agent/[address] instead.
 * The two scores are independent — a trusted agent can have an unsafe token contract.
 *
 * Response includes:
 *   - tokenType: "known_safe" | "memecoin"
 *   - trustScore (0-100) — contract safety score only
 *   - verdict: "trusted" | "proceed" | "caution" | "avoid"
 *   - riskFlags: array of risk indicators
 */

import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import { logQuery } from "@/lib/query-logger";
import { predictToken, type WadjetTokenResult } from "@/lib/wadjet-client";

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
  // MAIAT (Base) — Maiat Protocol native token (Virtuals ecosystem)
  "0xf083E21C5e0993429778302C703cD8D052C72E8C": { symbol: "MAIAT", name: "Maiat" },
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
  quoteTokenAddress: string | null;
  isVirtualsPair: boolean;
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

// ── Virtuals Protocol Detection ────────────────────────────────────────────────
// Virtuals bonding curve tokens use a custom router — honeypot.is tax data is
// unreliable (shows 100% buy / 99% sell). Detect via DexScreener pair data:
// if quote token is VIRTUAL, it's a Virtuals ecosystem token.

const VIRTUAL_TOKEN_ADDRESSES = new Set([
  "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b", // VIRTUAL (Base)
  "0x44ff8620b8ca30902395a7bd3f2407e1a091bf73", // VIRTUAL (Ethereum)
]);

// ── DexScreener API ────────────────────────────────────────────────────────────

async function getDexScreenerData(address: string): Promise<DexScreenerData> {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`,
      { signal: AbortSignal.timeout(8_000) }
    );

    if (!res.ok) {
      return { sells24h: 0, buys24h: 0, volume24h: 0, liquidity: 0, priceChange24h: null, dex: null, pairLabel: null, quoteTokenAddress: null, isVirtualsPair: false, error: `DexScreener returned ${res.status}` };
    }

    const data = await res.json();
    const pairs = data.pairs;

    if (!pairs || pairs.length === 0) {
      return { sells24h: 0, buys24h: 0, volume24h: 0, liquidity: 0, priceChange24h: null, dex: null, pairLabel: null, quoteTokenAddress: null, isVirtualsPair: false, error: "No pairs found" };
    }

    // Use the pair with the highest liquidity
    const best = pairs.reduce((a: Record<string, unknown>, b: Record<string, unknown>) => {
      const liqA = (a.liquidity as Record<string, number>)?.usd ?? 0;
      const liqB = (b.liquidity as Record<string, number>)?.usd ?? 0;
      return liqB > liqA ? b : a;
    });

    const txns = best.txns as Record<string, Record<string, number>> | undefined;
    const h24 = txns?.h24 ?? { buys: 0, sells: 0 };
    const quoteAddr = ((best.quoteToken as Record<string, string>)?.address ?? "").toLowerCase();

    return {
      sells24h: h24.sells ?? 0,
      buys24h: h24.buys ?? 0,
      volume24h: (best.volume as Record<string, number>)?.h24 ?? 0,
      liquidity: (best.liquidity as Record<string, number>)?.usd ?? 0,
      priceChange24h: (best.priceChange as Record<string, number>)?.h24 ?? null,
      dex: (best.dexId as string) ?? null,
      pairLabel: (best.labels as string[])?.[0] ?? null,
      quoteTokenAddress: quoteAddr || null,
      isVirtualsPair: VIRTUAL_TOKEN_ADDRESSES.has(quoteAddr),
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { sells24h: 0, buys24h: 0, volume24h: 0, liquidity: 0, priceChange24h: null, dex: null, pairLabel: null, quoteTokenAddress: null, isVirtualsPair: false, error: msg };
  }
}

// ── GoPlus Security API ────────────────────────────────────────────────────────
// Cross-verification source for token security data. More accurate than
// honeypot.is for Virtuals bonding curve tokens.

interface GoPlusResult {
  buyTax: number | null;
  sellTax: number | null;
  isHoneypot: boolean | null;
  isMintable: boolean | null;
  hiddenOwner: boolean | null;
  canTakeBackOwnership: boolean | null;
  slippageModifiable: boolean | null;
  isOpenSource: boolean | null;
  holderCount: number | null;
  top10HolderPct: number | null;
  lpLockedPct: number | null;
  creatorAddress: string | null;
  creatorPercent: number | null;
  ownerPercent: number | null;
  error?: string;
}

async function checkGoPlus(address: string, chainId: string = "8453"): Promise<GoPlusResult> {
  try {
    // GoPlus: use api.gopluslabs.io (api.gopluslabs.com has broken TLS SNI)
    const res = await fetch(
      `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${address}`,
      { signal: AbortSignal.timeout(8_000) }
    );

    if (!res.ok) {
      return { buyTax: null, sellTax: null, isHoneypot: null, isMintable: null, hiddenOwner: null, canTakeBackOwnership: null, slippageModifiable: null, isOpenSource: null, holderCount: null, top10HolderPct: null, lpLockedPct: null, creatorAddress: null, creatorPercent: null, ownerPercent: null, error: `GoPlus returned ${res.status}` };
    }

    const data = await res.json() as Record<string, unknown>;

    const token = (data?.result as Record<string, unknown>)?.[address.toLowerCase()] as Record<string, string> | undefined;

    if (!token) {
      return { buyTax: null, sellTax: null, isHoneypot: null, isMintable: null, hiddenOwner: null, canTakeBackOwnership: null, slippageModifiable: null, isOpenSource: null, holderCount: null, top10HolderPct: null, lpLockedPct: null, creatorAddress: null, creatorPercent: null, ownerPercent: null, error: "Token not found in GoPlus" };
    }

    return {
      buyTax: token.buy_tax != null ? parseFloat((parseFloat(token.buy_tax) * 100).toFixed(2)) : null,
      sellTax: token.sell_tax != null ? parseFloat((parseFloat(token.sell_tax) * 100).toFixed(2)) : null,
      isHoneypot: token.is_honeypot === "1",
      isMintable: token.is_mintable === "1",
      hiddenOwner: token.hidden_owner === "1",
      canTakeBackOwnership: token.can_take_back_ownership === "1",
      slippageModifiable: token.slippage_modifiable === "1",
      isOpenSource: token.is_open_source === "1",
      holderCount: token.holder_count ? parseInt(token.holder_count) : null,
      top10HolderPct: null, // GoPlus doesn't directly give this in the same call
      lpLockedPct: null, // Would need LP holder analysis
      creatorAddress: token.creator_address || null,
      creatorPercent: token.creator_percent ? parseFloat(token.creator_percent) : null,
      ownerPercent: token.owner_percent ? parseFloat(token.owner_percent) : null,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { buyTax: null, sellTax: null, isHoneypot: null, isMintable: null, hiddenOwner: null, canTakeBackOwnership: null, slippageModifiable: null, isOpenSource: null, holderCount: null, top10HolderPct: null, lpLockedPct: null, creatorAddress: null, creatorPercent: null, ownerPercent: null, error: msg };
  }
}

/**
 * Cross-verify tax data: when honeypot.is and GoPlus disagree significantly,
 * prefer GoPlus (reads contract code directly) over honeypot.is (simulation-based).
 */
function crossVerifyTax(
  honeypot: HoneypotResult,
  goplus: GoPlusResult,
  isVirtuals: boolean
): { buyTax: number | null; sellTax: number | null; source: string } {
  // If Virtuals bonding curve and GoPlus has data, always prefer GoPlus
  if (isVirtuals && goplus.buyTax !== null) {
    return { buyTax: goplus.buyTax, sellTax: goplus.sellTax, source: "goplus" };
  }

  // If both have data and disagree by >20%, prefer GoPlus
  if (honeypot.buyTax !== null && goplus.buyTax !== null) {
    const buyDiff = Math.abs(honeypot.buyTax - goplus.buyTax);
    const sellDiff = Math.abs((honeypot.sellTax ?? 0) - (goplus.sellTax ?? 0));
    if (buyDiff > 20 || sellDiff > 20) {
      return { buyTax: goplus.buyTax, sellTax: goplus.sellTax, source: "goplus (cross-verified)" };
    }
  }

  // Default: use honeypot.is
  if (honeypot.buyTax !== null) {
    return { buyTax: honeypot.buyTax, sellTax: honeypot.sellTax, source: "honeypot.is" };
  }

  // Fallback to GoPlus
  if (goplus.buyTax !== null) {
    return { buyTax: goplus.buyTax, sellTax: goplus.sellTax, source: "goplus (fallback)" };
  }

  return { buyTax: null, sellTax: null, source: "none" };
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
  dex?: DexScreenerData,
  goplus?: GoPlusResult
): ScoreResult {
  const riskFlags: string[] = [];
  let score = 50; // Start at 50

  // ── GoPlus contract security bonuses ─────────────────────────────────────────
  if (goplus && !goplus.error) {
    // Clean contract signals — each verified-safe property adds trust
    if (goplus.isOpenSource === true) score += 5;
    if (goplus.isMintable === false) score += 3;
    if (goplus.hiddenOwner === false) score += 3;
    if (goplus.canTakeBackOwnership === false) score += 2;
    if (goplus.slippageModifiable === false) score += 2;

    // Red flags from GoPlus
    if (goplus.isMintable === true) { score -= 15; riskFlags.push("MINTABLE"); }
    if (goplus.hiddenOwner === true) { score -= 10; riskFlags.push("HIDDEN_OWNER"); }
    if (goplus.canTakeBackOwnership === true) { score -= 10; riskFlags.push("CAN_RECLAIM_OWNERSHIP"); }
    if (goplus.slippageModifiable === true) { score -= 10; riskFlags.push("SLIPPAGE_MODIFIABLE"); }

    // Holder count bonus
    if (goplus.holderCount !== null) {
      if (goplus.holderCount >= 10_000) score += 10;
      else if (goplus.holderCount >= 5_000) score += 5;
      else if (goplus.holderCount >= 1_000) score += 3;
      else if (goplus.holderCount < 100) { score -= 5; riskFlags.push("FEW_HOLDERS"); }
    }

    // Creator/owner still holds large % = centralization risk
    if (goplus.creatorPercent !== null && goplus.creatorPercent > 0.2) {
      score -= 5;
      riskFlags.push("HIGH_CREATOR_HOLDINGS");
    }
    if (goplus.ownerPercent !== null && goplus.ownerPercent > 0.2) {
      score -= 5;
      riskFlags.push("HIGH_OWNER_HOLDINGS");
    }
  }

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

  // Buy/Sell tax penalties — skip for Virtuals bonding curve tokens
  // (honeypot.is reports 100%/99% tax because it can't simulate Virtuals router)
  const isVirtuals = dex?.isVirtualsPair === true;

  if (isVirtuals) {
    riskFlags.push("VIRTUALS_BONDING_CURVE");
    // Virtuals bonding curve = slightly elevated risk (custom router, limited simulation)
    score -= 5;
    // honeypot.is tax data unreliable for Virtuals — use DexScreener signals instead
    // Still penalize based on on-chain behavior:
    if (dex && !dex.error) {
      // Very few sells vs buys = potential rug
      if (dex.sells24h < 10 && dex.buys24h > 50) {
        score -= 25;
        riskFlags.push("SELLS_BLOCKED");
      }
      // Extreme price dump
      if (dex.priceChange24h !== null && dex.priceChange24h < -50) {
        score -= 15;
        riskFlags.push("PRICE_CRASH");
      }
      // Near-zero liquidity
      if (dex.liquidity < 5_000 && dex.liquidity > 0) {
        score -= 20;
        riskFlags.push("NEAR_ZERO_LIQUIDITY");
      }
      // Low volume = dead/dying token
      if (dex.volume24h < 50_000) {
        score -= 5;
        riskFlags.push("LOW_VOLUME");
      }
      // Very low volume relative to liquidity = ghost town
      if (dex.liquidity > 0 && dex.volume24h / dex.liquidity < 0.1) {
        score -= 5;
        riskFlags.push("LOW_VOLUME_TO_LIQUIDITY");
      }
    } else {
      // Can't verify Virtuals token without DexScreener → penalize
      score -= 20;
      riskFlags.push("UNVERIFIABLE_VIRTUALS_TOKEN");
    }
  } else {
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

    // Volume bonus/penalty
    if (dex.volume24h >= 100_000) {
      score += 5;
    } else if (dex.volume24h < 50_000 && dex.volume24h > 0) {
      score -= 5;
      if (!riskFlags.includes("LOW_VOLUME")) riskFlags.push("LOW_VOLUME");
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

  // ── Step 2: Contract safety check (honeypot, GoPlus, DexScreener) ──────────
  // NOTE: Agent behavioral trust is served by GET /api/v1/agent/[address].
  // This endpoint focuses ONLY on token contract safety — the two scores are
  // independent and should be displayed side-by-side in the UI.
  try {
    // ── Run 5 parallel checks (including Wadjet ML) ────────────────────────────
    const [honeypot, tokenMetadata, scarabReviews, dexData, goplus, wadjet] = await Promise.all([
      checkHoneypot(checksumAddress),
      getTokenMetadata(checksumAddress),
      getScarabReviews(checksumAddress),
      getDexScreenerData(checksumAddress),
      checkGoPlus(checksumAddress),
      predictToken(checksumAddress).catch(() => null as WadjetTokenResult | null),
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

    // ── Calculate heuristic score ─────────────────────────────────────────────
    const { trustScore, verdict, riskFlags, riskSummary } = calculateScore(
      honeypot,
      scarabReviews,
      dexData,
      goplus
    );

    // ── Wadjet ML: informational only (v1 returns default 0.4, v2 has bias) ──
    // TODO: re-enable blending once Wadjet model is retrained with proper
    // token-type separation (agent tokens vs generic ERC-20s)
    const scoringMethod = "heuristic_only";

    // ── Cross-verify tax data ──────────────────────────────────────────────────
    const isVirtuals = dexData?.isVirtualsPair === true;
    const verifiedTax = crossVerifyTax(honeypot, goplus, isVirtuals);

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
          isHoneypot: goplus.isHoneypot !== null ? goplus.isHoneypot : honeypot.isHoneypot,
          buyTax: verifiedTax.buyTax,
          sellTax: verifiedTax.sellTax,
          simulationSuccess: honeypot.simulationSuccess,
        },
        scarabReviews: {
          averageRating: scarabReviews.averageRating,
          reviewCount: scarabReviews.reviewCount,
        },
        tokenName: tokenMetadata.name,
        tokenSymbol: tokenMetadata.symbol,
        buyTax: verifiedTax.buyTax,
        sellTax: verifiedTax.sellTax,
        goplus: goplus.error ? { error: goplus.error } : {
          isMintable: goplus.isMintable,
          hiddenOwner: goplus.hiddenOwner,
          canTakeBackOwnership: goplus.canTakeBackOwnership,
          slippageModifiable: goplus.slippageModifiable,
          isOpenSource: goplus.isOpenSource,
          holderCount: goplus.holderCount,
          creatorAddress: goplus.creatorAddress,
          creatorPercent: goplus.creatorPercent,
          ownerPercent: goplus.ownerPercent,
        },
        taxSource: verifiedTax.source,
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
        wadjetML: wadjet && wadjet.confidence > 0 ? {
          rugProbability: wadjet.rug_probability,
          riskLevel: wadjet.risk_level,
          confidence: wadjet.confidence,
          note: "Informational only — not blended into trustScore (model retraining pending)",
        } : null,
        scoring: {
          method: scoringMethod,
          trustScore,
        },
        dataSource: "HONEYPOT_IS + GOPLUS + ALCHEMY + SCARAB + DEXSCREENER",
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
