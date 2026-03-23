/**
 * Real-Time Trust Scoring Engine
 *
 * No seed data. Every score computed from live sources:
 *   - DeFiLlama: TVL, audit status
 *   - DEXScreener: volume, liquidity, price trend
 *   - Basescan/Etherscan: verified source code, contract age
 *   - Alchemy: token holders, supply
 *   - Maiat DB: community reviews, verified reviews
 *
 * Score breakdown (0–100):
 *   TVL / liquidity signal   25%
 *   Audit / code quality     20%
 *   Contract safety          20%
 *   Market activity          15%
 *   Community reviews        20%
 */

const BASESCAN_KEY  = process.env.BASESCAN_API_KEY  ?? "";
const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY ?? "";
const ALCHEMY_RPC   = process.env.ALCHEMY_BASE_RPC  ?? "https://mainnet.base.org";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RealtimeTrustResult {
  score: number;           // 0–100
  riskLevel: "Low" | "Medium" | "High" | "Critical" | "Unknown";
  grade: "S" | "A" | "B" | "C" | "D" | "F";
  breakdown: {
    tvlLiquidity:     number;   // 0–100
    auditCodeQuality: number;   // 0–100
    contractSafety:   number;   // 0–100
    marketActivity:   number;   // 0–100
    communityReviews: number;   // 0–100
  };
  signals: {
    tvl:               number | null;
    audited:           boolean | null;
    auditFirms:        string[];
    sourceVerified:    boolean | null;
    ownershipRenounced: boolean | null;
    isProxy:           boolean | null;
    volume24h:         number | null;
    liquidity:         number | null;
    marketCap:         number | null;
    contractAgeYears:  number | null;
    reviewCount:       number;
    avgRating:         number | null;
    verifiedReviews:   number;
    /** Opinion Market: Scarab staked on this project (skin-in-the-game signal) */
    totalStaked:       number;
    stakeCount:        number;
  };
  flags: string[];
  dataSource: "realtime";
  fetchedAt: string;
}

// ─── Data Fetchers ────────────────────────────────────────────────────────────

async function fetchDeFiLlama(name: string): Promise<{
  tvl: number | null;
  audited: boolean;
  auditFirms: string[];
}> {
  try {
    const res = await fetch("https://api.llama.fi/protocols", {
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return { tvl: null, audited: false, auditFirms: [] };
    const protocols: any[] = await res.json();
    const nameLC = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const match = protocols.find((p) => {
      const pn = (p.name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
      return pn === nameLC || pn.includes(nameLC) || nameLC.includes(pn.slice(0, 5));
    });
    if (!match) return { tvl: null, audited: false, auditFirms: [] };
    const firms: string[] = match.audit_links?.length
      ? match.audit_links.map((_: any, i: number) => `Audit ${i + 1}`)
      : [];
    return {
      tvl: match.tvl ?? null,
      audited: match.audits === "2" || firms.length > 0,
      auditFirms: firms,
    };
  } catch {
    return { tvl: null, audited: false, auditFirms: [] };
  }
}

async function fetchDEXScreener(address: string): Promise<{
  volume24h: number | null;
  liquidity: number | null;
  marketCap: number | null;
  priceChange24h: number | null;
}> {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`,
      { signal: AbortSignal.timeout(5_000) }
    );
    if (!res.ok) return { volume24h: null, liquidity: null, marketCap: null, priceChange24h: null };
    const data: any = await res.json();
    const pairs: any[] = data.pairs ?? [];
    if (!pairs.length) return { volume24h: null, liquidity: null, marketCap: null, priceChange24h: null };

    // Aggregate across all pairs (Base + Ethereum + others)
    const totalVolume   = pairs.reduce((s, p) => s + (p.volume?.h24 ?? 0), 0);
    const totalLiquidity = pairs.reduce((s, p) => s + (p.liquidity?.usd ?? 0), 0);
    const bestPair = pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];

    return {
      volume24h:     totalVolume     > 0 ? totalVolume     : null,
      liquidity:     totalLiquidity  > 0 ? totalLiquidity  : null,
      marketCap:     bestPair.marketCap ?? bestPair.fdv ?? null,
      priceChange24h: bestPair.priceChange?.h24 ?? null,
    };
  } catch {
    return { volume24h: null, liquidity: null, marketCap: null, priceChange24h: null };
  }
}

async function fetchContractInfo(address: string, chain: "base" | "eth" = "base"): Promise<{
  sourceVerified: boolean | null;
  ownershipRenounced: boolean | null;
  isProxy: boolean | null;
  contractAgeYears: number | null;
}> {
  const apiKey   = chain === "eth" ? ETHERSCAN_KEY : BASESCAN_KEY;
  const baseUrl  = chain === "eth"
    ? "https://api.etherscan.io/api"
    : "https://api.basescan.org/api";

  if (!apiKey) return { sourceVerified: null, ownershipRenounced: null, isProxy: null, contractAgeYears: null };

  try {
    const [sourceRes, creationRes] = await Promise.allSettled([
      // getsourcecode is more reliable than getabi:
      // - Works correctly for proxy contracts (getabi returns status=0 for proxy addresses)
      // - Returns Proxy="1" + Implementation address when it's a proxy
      // - SourceCode non-empty means verified
      fetch(`${baseUrl}?module=contract&action=getsourcecode&address=${address}&apikey=${apiKey}`, {
        signal: AbortSignal.timeout(5_000),
      }),
      fetch(`${baseUrl}?module=contract&action=getcontractcreation&contractaddresses=${address}&apikey=${apiKey}`, {
        signal: AbortSignal.timeout(5_000),
      }),
    ]);

    let sourceVerified: boolean | null = null;
    let isProxy: boolean | null = null;

    if (sourceRes.status === "fulfilled" && sourceRes.value.ok) {
      const d: any = await sourceRes.value.json();
      const result = d.result?.[0];
      if (result) {
        // SourceCode is non-empty string when verified
        sourceVerified = typeof result.SourceCode === "string" && result.SourceCode.length > 0;
        // Proxy field is "1" when the contract is a proxy
        isProxy = result.Proxy === "1";
        // If it's a proxy and the proxy itself isn't verified, check implementation
        if (isProxy && !sourceVerified && result.Implementation) {
          try {
            const implRes = await fetch(
              `${baseUrl}?module=contract&action=getsourcecode&address=${result.Implementation}&apikey=${apiKey}`,
              { signal: AbortSignal.timeout(5_000) }
            );
            if (implRes.ok) {
              const implData: any = await implRes.json();
              const implResult = implData.result?.[0];
              if (implResult && typeof implResult.SourceCode === "string") {
                sourceVerified = implResult.SourceCode.length > 0;
              }
            }
          } catch {
            // Silently fail — implementation check is best-effort
          }
        }
      }
    }

    let contractAgeYears: number | null = null;
    if (creationRes.status === "fulfilled" && creationRes.value.ok) {
      const d: any = await creationRes.value.json();
      const creator = d.result?.[0];
      if (creator?.timestamp) {
        const ageSec = Date.now() / 1000 - Number(creator.timestamp);
        contractAgeYears = Math.round((ageSec / (365 * 24 * 3600)) * 10) / 10;
      }
    }

    return {
      sourceVerified,
      ownershipRenounced: null, // would need owner() call
      isProxy,
      contractAgeYears,
    };
  } catch {
    return { sourceVerified: null, ownershipRenounced: null, isProxy: null, contractAgeYears: null };
  }
}

// ─── Scoring sub-functions ────────────────────────────────────────────────────

function scoreTVL(tvl: number | null, liquidity: number | null): number {
  const value = tvl ?? liquidity ?? 0;
  if (value <= 0)       return 10;
  if (value >= 1e9)     return 100;
  if (value >= 100e6)   return 90;
  if (value >= 10e6)    return 75;
  if (value >= 1e6)     return 60;
  if (value >= 100_000) return 45;
  if (value >= 10_000)  return 30;
  return 15;
}

function scoreAudit(audited: boolean, auditFirms: string[], sourceVerified: boolean | null): number {
  let s = 20;
  if (audited)         s += 50;
  if (auditFirms.length >= 2) s += 20;
  if (sourceVerified)  s += 10;
  return Math.min(s, 100);
}

function scoreContractSafety(
  sourceVerified: boolean | null,
  ownershipRenounced: boolean | null,
  isProxy: boolean | null,
  contractAgeYears: number | null
): number {
  let s = 30; // baseline
  if (sourceVerified === true)  s += 30;
  if (sourceVerified === false) s -= 20;
  if (ownershipRenounced === true) s += 20;
  if (isProxy === false) s += 10;
  if (contractAgeYears !== null) {
    if (contractAgeYears >= 2)  s += 20;
    else if (contractAgeYears >= 1) s += 10;
    else if (contractAgeYears >= 0.5) s += 5;
    else s -= 10; // very new contract
  }
  return Math.max(0, Math.min(s, 100));
}

function scoreMarket(
  volume24h: number | null,
  marketCap: number | null,
  priceChange24h: number | null
): number {
  let s = 20;
  const vol = volume24h ?? 0;
  const mc  = marketCap  ?? 0;
  if (vol >= 1e6)    s += 30;
  else if (vol >= 100_000) s += 20;
  else if (vol >= 10_000)  s += 10;
  if (mc >= 100e6)   s += 30;
  else if (mc >= 10e6) s += 20;
  else if (mc >= 1e6)  s += 10;
  // heavy price crash = risk flag
  if (priceChange24h !== null && priceChange24h < -30) s -= 20;
  return Math.max(0, Math.min(s, 100));
}

function scoreCommunity(
  reviewCount: number,
  avgRating: number | null,
  verifiedReviews: number,
  marketStake: { totalStaked: number; stakeCount: number } = { totalStaked: 0, stakeCount: 0 }
): number {
  if (reviewCount === 0 && marketStake.stakeCount === 0) return 20; // neutral, no data
  let s = 20;

  // Review signals
  if (reviewCount >= 50)      s += 30;
  else if (reviewCount >= 10) s += 20;
  else if (reviewCount >= 3)  s += 10;

  if (verifiedReviews >= 5)   s += 20;
  else if (verifiedReviews >= 1) s += 10;

  if (avgRating !== null) {
    if (avgRating >= 4.5)      s += 20;
    else if (avgRating >= 4.0) s += 10;
    else if (avgRating < 2.5)  s -= 15;
  }

  // Opinion Market signals: Scarab stakers have skin-in-the-game (stronger than star reviews)
  // stakeCount = unique wallets that put Scarab on this project
  if (marketStake.stakeCount >= 20) s += 20;
  else if (marketStake.stakeCount >= 5) s += 10;
  else if (marketStake.stakeCount >= 1) s += 5;

  return Math.max(0, Math.min(s, 100));
}

function toGrade(score: number): "S" | "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "S";
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 50) return "C";
  if (score >= 35) return "D";
  return "F";
}

function toRisk(score: number): "Low" | "Medium" | "High" | "Critical" {
  if (score >= 65) return "Low";
  if (score >= 45) return "Medium";
  if (score >= 25) return "High";
  return "Critical";
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function computeRealtimeTrust(opts: {
  name: string;
  address: string;
  chain?: "base" | "eth";
  reviewCount?: number;
  avgRating?: number | null;
  verifiedReviews?: number;
  /** Opinion Market: total Scarab staked on this project + number of unique stakers */
  marketStake?: { totalStaked: number; stakeCount: number };
}): Promise<RealtimeTrustResult> {
  const { name, address, chain = "base" } = opts;
  const reviewCount     = opts.reviewCount     ?? 0;
  const avgRating       = opts.avgRating       ?? null;
  const verifiedReviews = opts.verifiedReviews ?? 0;
  const marketStake     = opts.marketStake     ?? { totalStaked: 0, stakeCount: 0 };

  // Fetch all sources in parallel
  const [llama, dex, contract] = await Promise.all([
    fetchDeFiLlama(name),
    fetchDEXScreener(address),
    fetchContractInfo(address, chain),
  ]);

  // Compute sub-scores
  const tvlLiquidity     = scoreTVL(llama.tvl, dex.liquidity);
  const auditCodeQuality = scoreAudit(llama.audited, llama.auditFirms, contract.sourceVerified);
  const contractSafety   = scoreContractSafety(
    contract.sourceVerified,
    contract.ownershipRenounced,
    contract.isProxy,
    contract.contractAgeYears
  );
  const marketActivity   = scoreMarket(dex.volume24h, dex.marketCap, dex.priceChange24h);
  const communityScore   = scoreCommunity(reviewCount, avgRating, verifiedReviews, marketStake);

  // Weighted final score
  let score = Math.round(
    tvlLiquidity     * 0.25 +
    auditCodeQuality * 0.20 +
    contractSafety   * 0.20 +
    marketActivity   * 0.15 +
    communityScore   * 0.20
  );

  // Floor: $1B+ TVL + audited = established protocol, minimum Medium (60)
  if ((llama.tvl ?? 0) >= 1_000_000_000 && llama.audited) {
    score = Math.max(score, 60);
  }
  // Floor: $100M+ TVL + audited = at least 50
  if ((llama.tvl ?? 0) >= 100_000_000 && llama.audited) {
    score = Math.max(score, 50);
  }

  // Flags
  const flags: string[] = [];
  if (llama.audited)                     flags.push("AUDITED");
  if (contract.sourceVerified)           flags.push("SOURCE_VERIFIED");
  if (contract.contractAgeYears !== null && contract.contractAgeYears >= 1) flags.push("ESTABLISHED_CONTRACT");
  if (contract.contractAgeYears !== null && contract.contractAgeYears < 0.25) flags.push("NEW_CONTRACT");
  if (llama.tvl && llama.tvl >= 100e6)   flags.push("HIGH_TVL");
  if (dex.marketCap && dex.marketCap >= 100e6) flags.push("LARGE_CAP");
  if (reviewCount === 0 && marketStake.stakeCount === 0) flags.push("NO_COMMUNITY_DATA");
  if (marketStake.stakeCount >= 5)       flags.push("OPINION_MARKET_ACTIVE");
  if (dex.priceChange24h !== null && dex.priceChange24h < -30) flags.push("PRICE_CRASH_24H");

  return {
    score,
    riskLevel: toRisk(score),
    grade: toGrade(score),
    breakdown: {
      tvlLiquidity,
      auditCodeQuality,
      contractSafety,
      marketActivity,
      communityReviews: communityScore,
    },
    signals: {
      tvl:               llama.tvl,
      audited:           llama.audited,
      auditFirms:        llama.auditFirms,
      sourceVerified:    contract.sourceVerified,
      ownershipRenounced: contract.ownershipRenounced,
      isProxy:           contract.isProxy,
      volume24h:         dex.volume24h,
      liquidity:         dex.liquidity,
      marketCap:         dex.marketCap,
      contractAgeYears:  contract.contractAgeYears,
      reviewCount,
      avgRating,
      verifiedReviews,
      totalStaked:       marketStake.totalStaked,
      stakeCount:        marketStake.stakeCount,
    },
    flags,
    dataSource: "realtime",
    fetchedAt: new Date().toISOString(),
  };
}
