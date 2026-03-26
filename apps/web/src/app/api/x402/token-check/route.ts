/**
 * GET /api/x402/token-check?address=0x...
 *
 * x402 Payment-Protected Token Check Endpoint
 * Price: $0.01 per request
 *
 * Token trust check with honeypot detection, tax analysis, and DexScreener data.
 * No rate limiting (x402 payment IS the rate limit).
 */

import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
// CORS headers — payment gate is handled by middleware.ts
const X402_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Payment, X-Payment-Response, Payment-Signature, Payment-Required",
  "x-powered-by": "maiat-x402",
  "x-payment-protocol": "x402",
} as const;

// Known-safe whitelist
const KNOWN_SAFE: Record<string, { symbol: string; name: string }> = {
  "0x0000000000000000000000000000000000000000": { symbol: "ETH", name: "Ether" },
  "0x4200000000000000000000000000000000000006": { symbol: "WETH", name: "Wrapped Ether" },
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913": { symbol: "USDC", name: "USD Coin" },
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": { symbol: "USDC", name: "USD Coin" },
  "0x0555E30da8f98308EdB960aa94C0Db47230d2B9c": { symbol: "WBTC", name: "Wrapped Bitcoin" },
  "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb": { symbol: "DAI", name: "Dai Stablecoin" },
  "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b": { symbol: "VIRTUAL", name: "Virtual Protocol" },
  "0x44ff8620b8cA30902395A7bD3F2407e1A091BF73": { symbol: "VIRTUAL", name: "Virtual Protocol" },
  "0xf083E21C5e0993429778302C703cD8D052C72E8C": { symbol: "MAIAT", name: "Maiat" },
};

type Verdict = "trusted" | "proceed" | "caution" | "avoid";

interface HoneypotResult {
  isHoneypot: boolean | null;
  simulationSuccess: boolean | null;
  buyTax: number | null;
  sellTax: number | null;
  error?: string;
}

interface DexScreenerData {
  sells24h: number;
  buys24h: number;
  volume24h: number;
  liquidity: number;
  priceChange24h: number | null;
  dex: string | null;
  pairLabel: string | null;
  quoteTokenAddress: string | null;
  isVirtualsPair: boolean;
  error?: string;
}

const VIRTUAL_TOKEN_ADDRESSES = new Set([
  "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b",
  "0x44ff8620b8ca30902395a7bd3f2407e1a091bf73",
]);

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
      buyTax:
        data.simulationResult?.buyTax != null
          ? parseFloat((data.simulationResult.buyTax * 100).toFixed(2))
          : null,
      sellTax:
        data.simulationResult?.sellTax != null
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

async function getDexScreenerData(address: string): Promise<DexScreenerData> {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`,
      { signal: AbortSignal.timeout(8_000) }
    );

    if (!res.ok) {
      return {
        sells24h: 0,
        buys24h: 0,
        volume24h: 0,
        liquidity: 0,
        priceChange24h: null,
        dex: null,
        pairLabel: null,
        quoteTokenAddress: null,
        isVirtualsPair: false,
        error: `DexScreener returned ${res.status}`,
      };
    }

    const data = await res.json();
    const pairs = data.pairs;

    if (!pairs || pairs.length === 0) {
      return {
        sells24h: 0,
        buys24h: 0,
        volume24h: 0,
        liquidity: 0,
        priceChange24h: null,
        dex: null,
        pairLabel: null,
        quoteTokenAddress: null,
        isVirtualsPair: false,
        error: "No pairs found",
      };
    }

    // Use the pair with the highest liquidity
    const best = pairs.reduce(
      (a: Record<string, unknown>, b: Record<string, unknown>) => {
        const liqA = (a.liquidity as Record<string, number>)?.usd ?? 0;
        const liqB = (b.liquidity as Record<string, number>)?.usd ?? 0;
        return liqB > liqA ? b : a;
      }
    );

    const txns = best.txns as Record<string, Record<string, number>> | undefined;
    const h24 = txns?.h24 ?? { buys: 0, sells: 0 };
    const quoteAddr = (
      (best.quoteToken as Record<string, string>)?.address ?? ""
    ).toLowerCase();

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
    return {
      sells24h: 0,
      buys24h: 0,
      volume24h: 0,
      liquidity: 0,
      priceChange24h: null,
      dex: null,
      pairLabel: null,
      quoteTokenAddress: null,
      isVirtualsPair: false,
      error: msg,
    };
  }
}

function calculateScore(
  honeypot: HoneypotResult,
  dex?: DexScreenerData
): { trustScore: number; verdict: Verdict; riskFlags: string[]; riskSummary: string } {
  const riskFlags: string[] = [];
  let score = 50;

  // Honeypot penalties
  if (honeypot.isHoneypot === true) {
    const hasTradingActivity = dex && !dex.error && dex.sells24h >= 50;
    const isV4Pool = dex?.pairLabel === "v4";

    if (hasTradingActivity) {
      riskFlags.push("HONEYPOT_FLAGGED_BUT_TRADEABLE");
      if (isV4Pool) riskFlags.push("UNISWAP_V4_POOL");
      score -= 15;
    } else {
      riskFlags.push("HONEYPOT_DETECTED");
      return {
        trustScore: 0,
        verdict: "avoid",
        riskFlags,
        riskSummary: "Token is confirmed as a honeypot. Do not interact.",
      };
    }
  }

  if (honeypot.simulationSuccess === false) {
    score -= 20;
    riskFlags.push("UNVERIFIED");
  }

  if (honeypot.error) {
    riskFlags.push("HONEYPOT_CHECK_FAILED");
  }

  const isVirtuals = dex?.isVirtualsPair === true;

  if (isVirtuals) {
    riskFlags.push("VIRTUALS_BONDING_CURVE");
    if (dex && !dex.error) {
      if (dex.sells24h < 10 && dex.buys24h > 50) {
        score -= 25;
        riskFlags.push("SELLS_BLOCKED");
      }
      if (dex.priceChange24h !== null && dex.priceChange24h < -50) {
        score -= 15;
        riskFlags.push("PRICE_CRASH");
      }
      if (dex.liquidity < 5_000 && dex.liquidity > 0) {
        score -= 20;
        riskFlags.push("NEAR_ZERO_LIQUIDITY");
      }
    } else {
      score -= 20;
      riskFlags.push("UNVERIFIABLE_VIRTUALS_TOKEN");
    }
  } else {
    if (honeypot.buyTax !== null) {
      if (honeypot.buyTax > 25) {
        score -= 30;
        riskFlags.push("HIGH_BUY_TAX");
      } else if (honeypot.buyTax > 10) {
        score -= 15;
      }
    }

    if (honeypot.sellTax !== null) {
      if (honeypot.sellTax > 25) {
        score -= 30;
        riskFlags.push("HIGH_SELL_TAX");
      } else if (honeypot.sellTax > 10) {
        score -= 15;
      }
    }
  }

  // DexScreener bonuses/penalties
  if (dex && !dex.error) {
    if (dex.liquidity >= 500_000) {
      score += 10;
    } else if (dex.liquidity >= 100_000) {
      score += 5;
    } else if (dex.liquidity < 10_000 && dex.liquidity > 0) {
      score -= 10;
      riskFlags.push("LOW_LIQUIDITY");
    }

    if (dex.volume24h >= 100_000) {
      score += 5;
    }

    if (dex.buys24h > 0 && dex.sells24h / dex.buys24h > 4) {
      score -= 5;
      riskFlags.push("HIGH_SELL_PRESSURE");
    }
  } else if (dex?.error) {
    riskFlags.push("DEXSCREENER_UNAVAILABLE");
  }

  score = Math.max(0, Math.min(100, score));

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
    if (verdict === "proceed") summaryParts.push("No major risks detected.");
    else if (verdict === "caution") summaryParts.push("Proceed with caution.");
    else summaryParts.push("Elevated risk detected.");
  }

  return {
    trustScore: score,
    verdict,
    riskFlags,
    riskSummary: summaryParts.join(" "),
  };
}

export const dynamic = "force-dynamic";

// OPTIONS handler for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: X402_CORS_HEADERS });
}

// Core handler logic
async function tokenCheckHandler(request: NextRequest): Promise<NextResponse<unknown>> {
  const rawAddress = request.nextUrl.searchParams.get("address");

  if (!rawAddress || !isAddress(rawAddress)) {
    return NextResponse.json(
      {
        error: "Invalid address",
        message: "Please provide a valid EVM token address (0x...)",
      },
      { status: 400, headers: X402_CORS_HEADERS }
    );
  }

  const checksumAddress = getAddress(rawAddress);

  // Step 1: KNOWN_SAFE whitelist
  if (KNOWN_SAFE[checksumAddress]) {
    const { symbol, name } = KNOWN_SAFE[checksumAddress];
    return NextResponse.json(
      {
        address: checksumAddress,
        tokenType: "known_safe",
        trustScore: 100,
        verdict: "trusted" as Verdict,
        riskFlags: [],
        riskSummary: `${name} (${symbol}) is a verified safe token.`,
        dataSource: "KNOWN_SAFE_LIST",
      },
      { headers: X402_CORS_HEADERS }
    );
  }

  // Step 2: Honeypot + DexScreener checks
  try {
    const [honeypot, dexData] = await Promise.all([
      checkHoneypot(checksumAddress),
      getDexScreenerData(checksumAddress),
    ]);

    // Check for total data failure
    const hasNoData = honeypot.error && dexData.error;

    if (hasNoData) {
      return NextResponse.json(
        {
          address: checksumAddress,
          trustScore: 40,
          verdict: "caution" as Verdict,
          riskFlags: ["LIMITED_DATA"],
          riskSummary:
            "Unable to retrieve sufficient data for this token. Proceed with caution.",
          honeypot: {
            isHoneypot: null,
            buyTax: null,
            sellTax: null,
            simulationSuccess: null,
          },
          tokenType: "memecoin",
          dataSource: "LIMITED",
        },
        { headers: X402_CORS_HEADERS }
      );
    }

    const { trustScore, verdict, riskFlags, riskSummary } = calculateScore(
      honeypot,
      dexData
    );

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
        dataSource: "HONEYPOT_IS + DEXSCREENER",
      },
      { headers: X402_CORS_HEADERS }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[x402/token-check] Error:", msg);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: X402_CORS_HEADERS }
    );
  }
}

// Payment gate handled by middleware.ts — export handler directly
export const GET = tokenCheckHandler;
export const POST = tokenCheckHandler;
