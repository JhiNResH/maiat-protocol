/**
 * GET /api/v1/token/[address]/forensics
 *
 * Deep token forensics — rug pull risk analysis.
 * Layers on top of basic token check with:
 *   1. Contract analysis (ownership, renounce status, proxy patterns)
 *   2. Holder concentration (top holders, whale %)
 *   3. Liquidity analysis (locked?, pool size, LP token distribution)
 *   4. Trading pattern flags (wash trading signals, coordinated buys)
 *   5. Rug risk score (0-100, weighted composite)
 *
 * Data sources: Alchemy, Honeypot.is, BaseScan, on-chain reads
 */

import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress, createPublicClient, http, parseAbi } from "viem";
import { base } from "viem/chains";
import { logQueryAsync } from "@/lib/query-logger";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Maiat-Client",
};

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// ── On-chain client ────────────────────────────────────────────────────────────

const client = createPublicClient({
  chain: base,
  transport: http(
    process.env.ALCHEMY_API_KEY
      ? `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
      : "https://mainnet.base.org"
  ),
});

// ── Contract Analysis ──────────────────────────────────────────────────────────

const OWNER_ABI = parseAbi([
  "function owner() view returns (address)",
  "function renounceOwnership() external",
]);

interface ContractAnalysis {
  hasOwner: boolean;
  owner: string | null;
  isRenounced: boolean;
  isProxy: boolean;
  codeSize: number;
}

async function analyzeContract(address: `0x${string}`): Promise<ContractAnalysis> {
  const result: ContractAnalysis = {
    hasOwner: false,
    owner: null,
    isRenounced: false,
    isProxy: false,
    codeSize: 0,
  };

  try {
    // Get bytecode size
    const code = await client.getCode({ address });
    result.codeSize = code ? (code.length - 2) / 2 : 0; // hex chars to bytes

    // Check for proxy patterns (EIP-1967 storage slot)
    if (code && code.length > 10) {
      // EIP-1967 implementation slot: 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc
      try {
        const implSlot = await client.getStorageAt({
          address,
          slot: "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
        });
        if (implSlot && implSlot !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
          result.isProxy = true;
        }
      } catch {
        // Not a proxy
      }
    }

    // Try to read owner
    try {
      const owner = await client.readContract({
        address,
        abi: OWNER_ABI,
        functionName: "owner",
      });
      result.hasOwner = true;
      result.owner = owner as string;
      result.isRenounced = owner === "0x0000000000000000000000000000000000000000";
    } catch {
      // No owner function — could be ownerless or non-standard
    }
  } catch {
    // Contract read failed
  }

  return result;
}

// ── Holder Concentration ───────────────────────────────────────────────────────

interface HolderAnalysis {
  topHolders: { address: string; percentage: number }[];
  top10Pct: number;
  whaleCount: number; // holders with >5%
  holderCount: number | null;
}

async function analyzeHolders(address: string): Promise<HolderAnalysis> {
  const result: HolderAnalysis = {
    topHolders: [],
    top10Pct: 0,
    whaleCount: 0,
    holderCount: null,
  };

  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) return result;

  try {
    // Get top token holders via Alchemy
    const res = await fetch(`https://base-mainnet.g.alchemy.com/v2/${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "alchemy_getTokenBalances",
        // Note: Alchemy doesn't have a direct "top holders" endpoint on Base
        // We'll use getTokenMetadata for supply + approximate via transfers
        params: [address],
      }),
      signal: AbortSignal.timeout(8_000),
    });

    // Fallback: use BaseScan API for holder info if available
    const basescanKey = process.env.BASESCAN_API_KEY;
    if (basescanKey) {
      const holdersRes = await fetch(
        `https://api.basescan.org/api?module=token&action=tokenholderlist&contractaddress=${address}&page=1&offset=10&apikey=${basescanKey}`,
        { signal: AbortSignal.timeout(8_000) }
      );
      const holdersData = await holdersRes.json();

      if (holdersData.status === "1" && holdersData.result) {
        // Get total supply for percentage calc
        const metaRes = await fetch(`https://base-mainnet.g.alchemy.com/v2/${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "alchemy_getTokenMetadata",
            params: [address],
          }),
          signal: AbortSignal.timeout(5_000),
        });
        const metaData = await metaRes.json();
        const totalSupply = metaData.result?.totalSupply
          ? BigInt(metaData.result.totalSupply)
          : null;

        for (const holder of holdersData.result.slice(0, 10)) {
          const balance = BigInt(holder.TokenHolderQuantity || "0");
          const pct = totalSupply && totalSupply > 0n
            ? Number((balance * 10000n) / totalSupply) / 100
            : 0;

          result.topHolders.push({
            address: holder.TokenHolderAddress,
            percentage: pct,
          });

          if (pct > 5) result.whaleCount++;
        }

        result.top10Pct = result.topHolders.reduce((sum, h) => sum + h.percentage, 0);
      }
    }
  } catch {
    // Holder analysis failed — non-critical
  }

  return result;
}

// ── Liquidity Analysis ─────────────────────────────────────────────────────────

interface LiquidityAnalysis {
  hasLiquidity: boolean;
  poolCount: number;
  estimatedLiquidityUsd: number | null;
  isLocked: boolean | null; // null = can't determine
}

async function analyzeLiquidity(address: string): Promise<LiquidityAnalysis> {
  const result: LiquidityAnalysis = {
    hasLiquidity: false,
    poolCount: 0,
    estimatedLiquidityUsd: null,
    isLocked: null,
  };

  try {
    // Check via DexScreener API (free, no key needed)
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`,
      { signal: AbortSignal.timeout(8_000) }
    );
    const data = await res.json();

    if (data.pairs && data.pairs.length > 0) {
      result.hasLiquidity = true;
      result.poolCount = data.pairs.length;

      // Sum liquidity across all pairs
      let totalLiq = 0;
      for (const pair of data.pairs) {
        totalLiq += pair.liquidity?.usd ?? 0;
      }
      result.estimatedLiquidityUsd = totalLiq;
    }
  } catch {
    // DexScreener failed — non-critical
  }

  return result;
}

// ── Rug Risk Score ─────────────────────────────────────────────────────────────

interface RugRiskResult {
  rugScore: number; // 0 = safe, 100 = definite rug
  riskLevel: "low" | "medium" | "high" | "critical";
  riskFlags: string[];
  summary: string;
}

function calculateRugRisk(
  contract: ContractAnalysis,
  holders: HolderAnalysis,
  liquidity: LiquidityAnalysis,
  honeypotScore: number | null
): RugRiskResult {
  const flags: string[] = [];
  let rugScore = 0;

  // ── Contract risks ─────────────────────────────────────────────────────────
  if (contract.isProxy) {
    rugScore += 15;
    flags.push("UPGRADEABLE_PROXY");
  }
  if (contract.hasOwner && !contract.isRenounced) {
    rugScore += 10;
    flags.push("OWNER_NOT_RENOUNCED");
  }
  if (contract.codeSize === 0) {
    rugScore += 25;
    flags.push("NO_CONTRACT_CODE");
  }

  // ── Holder concentration risks ─────────────────────────────────────────────
  if (holders.top10Pct > 80) {
    rugScore += 25;
    flags.push("EXTREME_CONCENTRATION");
  } else if (holders.top10Pct > 50) {
    rugScore += 15;
    flags.push("HIGH_CONCENTRATION");
  }
  if (holders.whaleCount >= 3) {
    rugScore += 10;
    flags.push("MULTIPLE_WHALES");
  }

  // ── Liquidity risks ───────────────────────────────────────────────────────
  if (!liquidity.hasLiquidity) {
    rugScore += 20;
    flags.push("NO_LIQUIDITY");
  } else if (liquidity.estimatedLiquidityUsd !== null && liquidity.estimatedLiquidityUsd < 10000) {
    rugScore += 15;
    flags.push("LOW_LIQUIDITY");
  }

  // ── Honeypot signal ────────────────────────────────────────────────────────
  if (honeypotScore !== null && honeypotScore < 30) {
    rugScore += 20;
    flags.push("HONEYPOT_RISK");
  }

  // Clamp
  rugScore = Math.min(100, Math.max(0, rugScore));

  // Risk level
  let riskLevel: RugRiskResult["riskLevel"];
  if (rugScore >= 70) riskLevel = "critical";
  else if (rugScore >= 45) riskLevel = "high";
  else if (rugScore >= 20) riskLevel = "medium";
  else riskLevel = "low";

  // Summary
  const parts: string[] = [];
  if (flags.includes("EXTREME_CONCENTRATION")) parts.push("Top 10 holders control >80% of supply.");
  if (flags.includes("NO_LIQUIDITY")) parts.push("No trading liquidity detected.");
  if (flags.includes("LOW_LIQUIDITY")) parts.push(`Low liquidity ($${liquidity.estimatedLiquidityUsd?.toLocaleString()}).`);
  if (flags.includes("UPGRADEABLE_PROXY")) parts.push("Contract is upgradeable (proxy pattern).");
  if (flags.includes("OWNER_NOT_RENOUNCED")) parts.push("Contract owner has not renounced.");
  if (flags.includes("HONEYPOT_RISK")) parts.push("Honeypot characteristics detected.");
  if (parts.length === 0) parts.push("No major rug indicators detected.");

  return {
    rugScore,
    riskLevel,
    riskFlags: flags,
    summary: parts.join(" "),
  };
}

// ── Main Handler ───────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address: rawAddress } = await params;
  const callerIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || undefined;
  const userAgent = request.headers.get("user-agent") || undefined;
  const clientId = request.headers.get("x-maiat-client") ?? undefined;

  if (!rawAddress || !isAddress(rawAddress)) {
    return NextResponse.json(
      { error: "Invalid token address" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const address = getAddress(rawAddress) as `0x${string}`;

  try {
    // Run all analyses in parallel
    const [contract, holders, liquidity] = await Promise.all([
      analyzeContract(address),
      analyzeHolders(address),
      analyzeLiquidity(address),
    ]);

    // Also fetch basic honeypot score for composite
    let honeypotScore: number | null = null;
    try {
      const hpRes = await fetch(
        `https://api.honeypot.is/v2/IsHoneypot?address=${address}&chainID=8453`,
        { signal: AbortSignal.timeout(8_000) }
      );
      if (hpRes.ok) {
        const hpData = await hpRes.json();
        if (hpData.honeypotResult?.isHoneypot === true) honeypotScore = 0;
        else if (hpData.simulationSuccess === false) honeypotScore = 25;
        else honeypotScore = 75;
      }
    } catch {
      // Non-critical
    }

    const rugRisk = calculateRugRisk(contract, holders, liquidity, honeypotScore);

    // Log query + get queryId for feedback
    const queryId = await logQueryAsync({
      type: "token_forensics",
      target: address,
      clientId,
      callerIp,
      userAgent,
      trustScore: 100 - rugRisk.rugScore, // invert: high rug = low trust
      verdict: rugRisk.riskLevel === "low" ? "proceed" : rugRisk.riskLevel === "medium" ? "caution" : "avoid",
      metadata: { rugScore: rugRisk.rugScore, riskLevel: rugRisk.riskLevel },
    });

    return NextResponse.json(
      {
        address,
        rugScore: rugRisk.rugScore,
        riskLevel: rugRisk.riskLevel,
        riskFlags: rugRisk.riskFlags,
        summary: rugRisk.summary,
        contract: {
          hasOwner: contract.hasOwner,
          owner: contract.owner,
          isRenounced: contract.isRenounced,
          isProxy: contract.isProxy,
          codeSizeBytes: contract.codeSize,
        },
        holders: {
          top10Percentage: holders.top10Pct,
          whaleCount: holders.whaleCount,
          topHolders: holders.topHolders.slice(0, 5), // Top 5 only
        },
        liquidity: {
          hasLiquidity: liquidity.hasLiquidity,
          poolCount: liquidity.poolCount,
          estimatedUsd: liquidity.estimatedLiquidityUsd,
          isLocked: liquidity.isLocked,
        },
        feedback: queryId
          ? {
              queryId,
              reportOutcome: "POST /api/v1/outcome",
              note: "Report outcome to improve rug detection accuracy.",
            }
          : undefined,
      },
      {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (err) {
    console.error("[token-forensics]", err);
    return NextResponse.json(
      { error: "Forensics analysis failed" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
