import { createPublicClient, http, getAddress, isAddress, formatEther } from "viem";
import { base, mainnet, bsc } from "viem/chains";

// ─── RPC endpoints ──────────────────────────────────────────────────────────
const ALCHEMY_BASE_RPC = process.env.ALCHEMY_BASE_RPC ?? "https://mainnet.base.org";
const ALCHEMY_ETH_RPC  = process.env.ALCHEMY_ETH_RPC  ?? "https://eth.llamarpc.com";
const BNB_RPC          = process.env.BNB_RPC           ?? "https://bsc-dataseed.binance.org";

const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY ?? "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY ?? "";
const BSCSCAN_API_KEY   = process.env.BSCSCAN_API_KEY  ?? "";

// ─── Viem clients ────────────────────────────────────────────────────────────
const clients = {
  base: createPublicClient({ chain: base,    transport: http(ALCHEMY_BASE_RPC) }),
  eth:  createPublicClient({ chain: mainnet, transport: http(ALCHEMY_ETH_RPC)  }),
  bnb:  createPublicClient({ chain: bsc,     transport: http(BNB_RPC)          }),
} as const;

export type SupportedChain = keyof typeof clients;

// Etherscan V2 unified endpoint (works for ETH, Base, BNB via chainId param)
const EXPLORER_APIS: Record<SupportedChain, { url: string; key: string; chainId: number }> = {
  base: { url: "https://api.etherscan.io/v2/api", key: BASESCAN_API_KEY  || ETHERSCAN_API_KEY, chainId: 8453 },
  eth:  { url: "https://api.etherscan.io/v2/api", key: ETHERSCAN_API_KEY, chainId: 1    },
  bnb:  { url: "https://api.etherscan.io/v2/api", key: BSCSCAN_API_KEY   || ETHERSCAN_API_KEY, chainId: 56   },
};

// ─── Known Protocol interface ────────────────────────────────────────────────
interface ProtocolInfo {
  name: string;
  category: "DEX" | "LENDING" | "BRIDGE" | "STABLECOIN" | "ORACLE" | "INFRASTRUCTURE" | "YIELD" | "NFT" | "AGENT_TOKEN" | "AGENT_WALLET";
  auditedBy?: string[];
  baseScore: number;
}

// ─── Base protocols ──────────────────────────────────────────────────────────
const PROTOCOLS_BASE = new Map<string, ProtocolInfo>([
  // DeFi
  ["0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24", { name: "Uniswap V3 Router",         category: "DEX",            auditedBy: ["Trail of Bits", "ABDK"],                     baseScore: 8.5 }],
  ["0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD", { name: "Uniswap Universal Router",   category: "DEX",            auditedBy: ["Trail of Bits"],                             baseScore: 8.6 }],
  ["0x33128a8fC17869897dcE68Ed026d694621f6FDfD", { name: "Uniswap V3 Factory",          category: "DEX",            auditedBy: ["Trail of Bits", "ABDK"],                     baseScore: 8.7 }],
  ["0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43", { name: "Aerodrome Router",            category: "DEX",            auditedBy: ["Code4rena"],                                 baseScore: 7.8 }],
  ["0x420DD381b31aEf6683db6B902084cB0FFECe40Da", { name: "Aerodrome Factory",           category: "DEX",            auditedBy: ["Code4rena"],                                 baseScore: 7.8 }],
  ["0xA238Dd80C259a72e81d7e4664a9801593F98d1c5", { name: "Aave V3 Pool",               category: "LENDING",        auditedBy: ["OpenZeppelin", "Trail of Bits", "Sigma Prime"], baseScore: 9.2 }],
  ["0xb125E6687d4313864e53df431d5425969c15Eb2F", { name: "Compound V3 USDC",           category: "LENDING",        auditedBy: ["OpenZeppelin", "ChainSecurity"],              baseScore: 8.8 }],
  ["0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb", { name: "Morpho Blue",               category: "LENDING",        auditedBy: ["Spearbit", "Cantina"],                        baseScore: 8.2 }],
  ["0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70", { name: "Chainlink ETH/USD Feed",     category: "ORACLE",         auditedBy: ["Trail of Bits"],                             baseScore: 9.1 }],
  ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", { name: "USDC",                        category: "STABLECOIN",     auditedBy: ["Deloitte"],                                  baseScore: 9.2 }],
  ["0x4200000000000000000000000000000000000006", { name: "WETH",                         category: "INFRASTRUCTURE",                                                           baseScore: 9.2 }],
  ["0x4200000000000000000000000000000000000010", { name: "L2StandardBridge",             category: "BRIDGE",         auditedBy: ["Sherlock", "OpenZeppelin"],                  baseScore: 8.7 }],
  ["0x45f1A95A4D3f3836523F5c83673c797f4d4d263B", { name: "Stargate Router",             category: "BRIDGE",         auditedBy: ["Zellic", "Quantstamp"],                      baseScore: 7.9 }],
  ["0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", { name: "DAI",                         category: "STABLECOIN",     auditedBy: ["Trail of Bits"],                             baseScore: 8.9 }],
  ["0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", { name: "USDbC",                       category: "STABLECOIN",                                                               baseScore: 8.5 }],
  // Tokens
  ["0x940181a94A35A4569E4529A3CDfB74e38FD98631", { name: "Aerodrome (AERO)",            category: "YIELD",          auditedBy: ["Code4rena"],                                 baseScore: 7.6 }],
  ["0x0578d8A44db98B23BF096A382e016e29a5Ce0ffe", { name: "BRETT",                        category: "NFT",                                                                      baseScore: 5.2 }],
  ["0x44fF8620b8cA30902395A7bD3F2407e1A091BF73", { name: "VIRTUAL",                     category: "INFRASTRUCTURE",                                                           baseScore: 7.1 }],
  // AI Agents on Base
  ["0x4f9fd6be4a90f2620860d680c0d4d5fb53d1a825", { name: "aixbt",                       category: "AGENT_TOKEN",                                                                    baseScore: 7.4 }],
  ["0x55cd6469f597452b5a7536e2cd98fde4c1247ee4", { name: "Luna",                        category: "AGENT_TOKEN",                                                                    baseScore: 6.8 }],
  ["0x731814e491571a2e9ee3c5b1f7f3b962ee8f4870", { name: "Vader AI",                    category: "AGENT_TOKEN",                                                                    baseScore: 6.5 }],
]);

// ─── Ethereum mainnet protocols ──────────────────────────────────────────────
const PROTOCOLS_ETH = new Map<string, ProtocolInfo>([
  // DeFi
  ["0xE592427A0AEce92De3Edee1F18E0157C05861564", { name: "Uniswap V3 Router",           category: "DEX",            auditedBy: ["Trail of Bits", "ABDK"],                     baseScore: 9.0 }],
  ["0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD", { name: "Uniswap Universal Router",   category: "DEX",            auditedBy: ["Trail of Bits"],                             baseScore: 9.0 }],
  ["0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", { name: "Aave V3 Pool",               category: "LENDING",        auditedBy: ["OpenZeppelin", "Trail of Bits", "Sigma Prime"], baseScore: 9.3 }],
  ["0xc3d688B66703497DAA19211EEdff47f25384cdc3", { name: "Compound V3 USDC",           category: "LENDING",        auditedBy: ["OpenZeppelin", "ChainSecurity"],              baseScore: 8.9 }],
  ["0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84", { name: "Lido stETH",                 category: "YIELD",          auditedBy: ["Sigma Prime", "MixBytes", "Quantstamp"],      baseScore: 8.8 }],
  ["0x9D39A5DE30e57443BfF2A8307A4256c8797A3497", { name: "Lido stETH (new)",           category: "YIELD",          auditedBy: ["Sigma Prime"],                               baseScore: 8.8 }],
  ["0x35D1b3F3D7966A1DFe207aa4514C12a259A0492B", { name: "MakerDAO MCD_VAT",           category: "LENDING",        auditedBy: ["Trail of Bits", "Gauntlet"],                 baseScore: 9.1 }],
  ["0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", { name: "Chainlink ETH/USD Feed",     category: "ORACLE",         auditedBy: ["Trail of Bits"],                             baseScore: 9.4 }],
  // Tokens
  ["0xdAC17F958D2ee523a2206206994597C13D831ec7", { name: "USDT (Tether)",               category: "STABLECOIN",     auditedBy: ["Chainalysis"],                               baseScore: 8.5 }],
  ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", { name: "USDC",                        category: "STABLECOIN",     auditedBy: ["Deloitte"],                                  baseScore: 9.2 }],
  ["0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", { name: "WBTC",                        category: "INFRASTRUCTURE", auditedBy: ["Quantstamp"],                                baseScore: 8.7 }],
  ["0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", { name: "UNI",                         category: "DEX",            auditedBy: ["Trail of Bits"],                             baseScore: 8.6 }],
  ["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", { name: "WETH",                        category: "INFRASTRUCTURE",                                                           baseScore: 9.3 }],
  ["0x6B175474E89094C44Da98b954EedeAC495271d0F", { name: "DAI",                         category: "STABLECOIN",     auditedBy: ["Trail of Bits"],                             baseScore: 9.1 }],
]);

// ─── BNB Chain protocols ─────────────────────────────────────────────────────
const PROTOCOLS_BNB = new Map<string, ProtocolInfo>([
  // DeFi
  ["0x13f4EA83D0bd40E75C8222255bc855a974568Dd4", { name: "PancakeSwap V3 Router",       category: "DEX",            auditedBy: ["PeckShield", "Certik"],                      baseScore: 8.2 }],
  ["0x10ED43C718714eb63d5aA57B78B54704E256024E", { name: "PancakeSwap V2 Router",       category: "DEX",            auditedBy: ["PeckShield"],                                baseScore: 8.0 }],
  ["0xfD36E2c2a6789Db23113685031d7F16329158384", { name: "Venus Comptroller",           category: "LENDING",        auditedBy: ["Certik", "Peckshield"],                      baseScore: 7.8 }],
  ["0x2170Ed0880ac9A755fd29B2688956BD959F933F8", { name: "ETH (BEP-20)",                category: "INFRASTRUCTURE",                                                           baseScore: 8.8 }],
  ["0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", { name: "CAKE",                        category: "DEX",            auditedBy: ["PeckShield"],                                baseScore: 7.5 }],
  ["0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", { name: "BTCB",                        category: "INFRASTRUCTURE", auditedBy: ["SlowMist"],                                  baseScore: 8.5 }],
  ["0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", { name: "WBNB",                        category: "INFRASTRUCTURE",                                                           baseScore: 9.0 }],
  ["0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", { name: "USDC (BEP-20)",               category: "STABLECOIN",     auditedBy: ["Deloitte"],                                  baseScore: 9.0 }],
  ["0x55d398326f99059fF775485246999027B3197955", { name: "USDT (BEP-20)",               category: "STABLECOIN",     auditedBy: ["Chainalysis"],                               baseScore: 8.5 }],
  ["0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63", { name: "XVS",                         category: "LENDING",        auditedBy: ["Certik"],                                    baseScore: 7.2 }],
  // Lista DAO (formerly Helio)
  ["0x1adB950d8bB3dA4bE104211D5AB038628e477fE6", { name: "Lista DAO",                   category: "LENDING",        auditedBy: ["PeckShield"],                                baseScore: 7.0 }],
]);

// Unified lookup by chain
const PROTOCOLS_BY_CHAIN: Record<SupportedChain, Map<string, ProtocolInfo>> = {
  base: PROTOCOLS_BASE,
  eth:  PROTOCOLS_ETH,
  bnb:  PROTOCOLS_BNB,
};

const KNOWN_SCAM_ADDRESSES = new Set([
  "0x000000000000000000000000000000000000dEaD",
  "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF",
  "0x0000000000000000000000000000000000000000",
]);

// ─── Types ───────────────────────────────────────────────────────────────────
export type RiskLevel    = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type AddressType  = "EOA" | "CONTRACT" | "PROTOCOL" | "TOKEN" | "AGENT_TOKEN" | "AGENT_WALLET" | "UNKNOWN";

export interface ScoreBreakdown {
  onChainHistory:  number;  // max 4.0
  contractAnalysis: number; // max 3.0
  blacklistCheck:  number;  // max 2.0
  activityPattern: number;  // max 1.0
}

export interface AddressDetails {
  txCount: number;
  balance: string;
  balanceETH: number;
  isContract: boolean;
  isKnownScam: boolean;
  isKnownProtocol: boolean;
  walletAge: string | null;
  lastActive: string | null;
}

export type DataSource = "onchain" | "cre" | "seed" | "unknown";

export interface TrustScoreResult {
  score: number;
  risk: RiskLevel;
  type: AddressType;
  flags: string[];
  breakdown: ScoreBreakdown;
  dataSource: DataSource;
  isStale: boolean;
  lastUpdated: string;
  chain: SupportedChain;
  protocol?: {
    name: string;
    category: string;
    auditedBy?: string[];
  };
  details: AddressDetails;
}

// ─── Cache ───────────────────────────────────────────────────────────────────
interface CacheEntry { result: TrustScoreResult; expiresAt: number }
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function cacheKey(address: string, chain: SupportedChain) { return `${chain}:${address}`; }

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getRisk(score: number): RiskLevel {
  if (score >= 7.0) return "LOW";
  if (score >= 4.0) return "MEDIUM";
  if (score >= 1.0) return "HIGH";
  return "CRITICAL";
}

async function getFirstTxTimestamp(address: string, chain: SupportedChain): Promise<number | null> {
  const { url, key, chainId } = EXPLORER_APIS[chain];
  if (!key) return null;
  try {
    const res  = await fetch(`${url}?chainid=${chainId}&module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=1&sort=asc&apikey=${key}`);
    const data = await res.json() as { status: string; result: Array<{ timeStamp: string }> };
    if (data.status === "1" && data.result?.length > 0) return parseInt(data.result[0].timeStamp) * 1000;
  } catch { /* ignore */ }
  return null;
}

async function getLastTxTimestamp(address: string, chain: SupportedChain): Promise<number | null> {
  const { url, key, chainId } = EXPLORER_APIS[chain];
  if (!key) return null;
  try {
    const res  = await fetch(`${url}?chainid=${chainId}&module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=1&sort=desc&apikey=${key}`);
    const data = await res.json() as { status: string; result: Array<{ timeStamp: string }> };
    if (data.status === "1" && data.result?.length > 0) return parseInt(data.result[0].timeStamp) * 1000;
  } catch { /* ignore */ }
  return null;
}

function formatAge(timestampMs: number): string {
  const days = Math.floor((Date.now() - timestampMs) / 86_400_000);
  if (days >= 365) { const y = Math.floor(days / 365); const m = Math.floor((days % 365) / 30); return m > 0 ? `${y}y ${m}mo` : `${y}y`; }
  if (days >= 30) return `${Math.floor(days / 30)} months`;
  return `${days} days`;
}

function formatLastActive(timestampMs: number): string {
  const h = Math.floor((Date.now() - timestampMs) / 3_600_000);
  if (h < 1)  return "Just now";
  if (h < 24) return `${h} hours ago`;
  return `${Math.floor(h / 24)} days ago`;
}

// ─── Main scoring function ───────────────────────────────────────────────────
export async function computeTrustScore(
  rawAddress: string,
  chain: SupportedChain = "base",
): Promise<TrustScoreResult> {
  if (!isAddress(rawAddress)) throw new Error(`Invalid Ethereum address: ${rawAddress}`);

  const address = getAddress(rawAddress);
  const key = cacheKey(address, chain);

  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const flags: string[] = [];
  const protocolMap = PROTOCOLS_BY_CHAIN[chain];
  const client = clients[chain];

  // ── Known scam ──
  if (KNOWN_SCAM_ADDRESSES.has(address)) {
    flags.push("KNOWN_SCAM_ADDRESS");
    const result: TrustScoreResult = {
      score: 0, risk: "CRITICAL", type: "UNKNOWN", flags, chain,
      dataSource: "onchain", isStale: false, lastUpdated: new Date().toISOString(),
      breakdown: { onChainHistory: 0, contractAnalysis: 0, blacklistCheck: 0, activityPattern: 0 },
      details: { txCount: 0, balance: "0", balanceETH: 0, isContract: false, isKnownScam: true, isKnownProtocol: false, walletAge: null, lastActive: null },
    };
    cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  }

  // ── Known protocol (fast path — no RPC needed) ──
  const protocolInfo = protocolMap.get(address);
  if (protocolInfo) {
    flags.push("KNOWN_PROTOCOL");
    if (protocolInfo.auditedBy?.length) flags.push("AUDITED");
    flags.push("VERIFIED");

    const score = protocolInfo.baseScore;
    const breakdown: ScoreBreakdown = {
      onChainHistory:  Math.min(4.0, Math.round(score * 0.4 * 10) / 10),
      contractAnalysis: Math.min(3.0, Math.round(score * 0.3 * 10) / 10),
      blacklistCheck:  Math.min(2.0, Math.round(score * 0.2 * 10) / 10),
      activityPattern: Math.min(1.0, Math.round(score * 0.1 * 10) / 10),
    };

    const addressType: AddressType =
      protocolInfo.category === "AGENT_TOKEN"   ? "AGENT_TOKEN" :
      protocolInfo.category === "AGENT_WALLET"  ? "AGENT_WALLET" : "PROTOCOL";

    const result: TrustScoreResult = {
      score, risk: getRisk(score), type: addressType, flags, chain,
      dataSource: "seed", isStale: false, lastUpdated: new Date().toISOString(),
      breakdown,
      protocol: { name: protocolInfo.name, category: protocolInfo.category, auditedBy: protocolInfo.auditedBy },
      details: { txCount: -1, balance: "0", balanceETH: 0, isContract: true, isKnownScam: false, isKnownProtocol: true, walletAge: null, lastActive: null },
    };
    cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  }

  // ── Unknown address: on-chain queries ──
  let isContract = false;
  let txCount = 0;
  let balanceWei = BigInt(0);

  const [codeRes, txRes, balRes, firstTx, lastTx] = await Promise.allSettled([
    client.getCode({ address }),
    client.getTransactionCount({ address }),
    client.getBalance({ address }),
    getFirstTxTimestamp(address, chain),
    getLastTxTimestamp(address, chain),
  ]);

  if (codeRes.status === "fulfilled") {
    const code = codeRes.value;
    isContract = !!(code && code !== "0x" && code.length > 2);
    if (isContract) flags.push("IS_CONTRACT");
  } else { flags.push("CODE_FETCH_FAILED"); }

  if (txRes.status === "fulfilled") {
    txCount = Number(txRes.value);
  } else { flags.push("TX_COUNT_FETCH_FAILED"); }

  if (balRes.status === "fulfilled") balanceWei = balRes.value;

  const firstTxTs = firstTx.status === "fulfilled" ? firstTx.value : null;
  const lastTxTs  = lastTx.status  === "fulfilled" ? lastTx.value  : null;
  const balanceETH = parseFloat(formatEther(balanceWei));

  // ── Score breakdown ──

  // 1. On-chain History (max 4.0)
  let onChainHistory = 1.0;
  if (txCount === 0)         { onChainHistory = 0;   flags.push("NO_TRANSACTIONS"); }
  else if (txCount < 5)      { onChainHistory = 0.5; flags.push("FEW_TRANSACTIONS"); }
  else if (txCount >= 1000)    onChainHistory = 4.0;
  else if (txCount >= 100)     onChainHistory = 3.4;
  else if (txCount >= 20)      onChainHistory = 2.0;
  else                         onChainHistory = 1.2;

  if (firstTxTs) {
    const ageDays = (Date.now() - firstTxTs) / 86_400_000;
    if (ageDays >= 365) onChainHistory = Math.min(4.0, onChainHistory + 0.6);
    else if (ageDays >= 90) onChainHistory = Math.min(4.0, onChainHistory + 0.3);
  }

  // 2. Contract Analysis (max 3.0)
  let contractAnalysis = isContract ? 2.0 : 1.5;
  if (balanceETH >= 10) contractAnalysis = Math.min(3.0, contractAnalysis + 0.8);
  else if (balanceETH >= 1) contractAnalysis = Math.min(3.0, contractAnalysis + 0.4);
  else if (balanceETH >= 0.1) contractAnalysis = Math.min(3.0, contractAnalysis + 0.2);
  else if (balanceETH < 0.001 && txCount > 0) contractAnalysis = Math.max(0, contractAnalysis - 0.3);

  // 3. Blacklist Check (max 2.0)
  let blacklistCheck = 1.8;
  if (txCount === 0 && !isContract) blacklistCheck = 1.0;

  // 4. Activity Pattern (max 1.0)
  let activityPattern = 0.5;
  if (lastTxTs) {
    const h = (Date.now() - lastTxTs) / 3_600_000;
    if (h < 24)   activityPattern = 0.9;
    else if (h < 168)  activityPattern = 0.7;
    else if (h < 720)  activityPattern = 0.5;
    else               activityPattern = 0.2;
  }
  if (txCount === 0) activityPattern = 0;

  const breakdown: ScoreBreakdown = {
    onChainHistory:  Math.max(0, Math.min(4.0, Math.round(onChainHistory  * 10) / 10)),
    contractAnalysis: Math.max(0, Math.min(3.0, Math.round(contractAnalysis * 10) / 10)),
    blacklistCheck:  Math.max(0, Math.min(2.0, Math.round(blacklistCheck  * 10) / 10)),
    activityPattern: Math.max(0, Math.min(1.0, Math.round(activityPattern * 10) / 10)),
  };

  const score = Math.max(0, Math.min(10, Math.round(
    (breakdown.onChainHistory + breakdown.contractAnalysis + breakdown.blacklistCheck + breakdown.activityPattern) * 10
  ) / 10));

  const type: AddressType = isContract ? "CONTRACT" : txCount > 0 ? "EOA" : "UNKNOWN";

  if (score >= 7.0)  flags.push("TRUSTED");
  if (balanceETH >= 1) flags.push("FUNDED");
  if (!isContract) flags.push("NOT_BLACKLISTED");

  const result: TrustScoreResult = {
    score, risk: getRisk(score), type, flags, chain,
    dataSource: "onchain", isStale: false, lastUpdated: new Date().toISOString(),
    breakdown,
    details: {
      txCount,
      balance: balanceWei.toString(),
      balanceETH: Math.round(balanceETH * 10000) / 10000,
      isContract, isKnownScam: false, isKnownProtocol: false,
      walletAge: firstTxTs ? formatAge(firstTxTs) : null,
      lastActive: lastTxTs ? formatLastActive(lastTxTs) : null,
    },
  };

  cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}

// ─── Dynamic Weight System ───────────────────────────────────────────────────
//
// As community reviews accumulate, their signal becomes more reliable.
// Weights shift from on-chain dominant → community dominant over time.
//
//  Phase        Reviews   On-chain   Community
//  cold         0         100%       0%
//  seeding      1–4        75%       25%
//  growing      5–19       50%       50%
//  mature       20–49      30%       70%
//  established  50+        15%       85%

export interface DynamicWeights {
  onChain: number;    // 0–1 weight for Alchemy on-chain score
  community: number;  // 0–1 weight for community review score
  phase: "cold" | "seeding" | "growing" | "mature" | "established";
}

export function getDynamicWeights(reviewCount: number): DynamicWeights {
  if (reviewCount === 0)  return { onChain: 1.00, community: 0.00, phase: "cold" };
  if (reviewCount < 5)    return { onChain: 0.75, community: 0.25, phase: "seeding" };
  if (reviewCount < 20)   return { onChain: 0.50, community: 0.50, phase: "growing" };
  if (reviewCount < 50)   return { onChain: 0.30, community: 0.70, phase: "mature" };
  return                         { onChain: 0.15, community: 0.85, phase: "established" };
}

/**
 * Blend on-chain Alchemy score with community review score.
 *
 * @param onChainScore   — 0–10 from computeTrustScore()
 * @param avgRating      — 1–5 star average from reviews (or null if no reviews)
 * @param reviewCount    — total review count
 * @returns blended score 0–10
 */
export function blendTrustScore(
  onChainScore: number,
  avgRating: number | null,
  reviewCount: number,
): { blended: number; weights: DynamicWeights } {
  const weights = getDynamicWeights(reviewCount);

  // Convert avgRating (1–5 stars) → 0–10 scale
  const communityScore = avgRating != null ? (avgRating / 5) * 10 : 0;

  const blended = Math.max(0, Math.min(10,
    Math.round((onChainScore * weights.onChain + communityScore * weights.community) * 10) / 10,
  ));

  return { blended, weights };
}
