import { createPublicClient, http, getAddress, isAddress, formatEther } from "viem";
import { base } from "viem/chains";

const ALCHEMY_BASE_RPC = process.env.ALCHEMY_BASE_RPC ?? "https://mainnet.base.org";
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY ?? "";
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY ?? "";

const client = createPublicClient({
  chain: base,
  transport: http(ALCHEMY_BASE_RPC),
});

// --- Known Protocols (Base mainnet) ---
interface ProtocolInfo {
  name: string;
  category: "DEX" | "LENDING" | "BRIDGE" | "STABLECOIN" | "ORACLE" | "INFRASTRUCTURE" | "YIELD" | "NFT";
  auditedBy?: string[];
  baseScore: number;
}

const KNOWN_PROTOCOLS = new Map<string, ProtocolInfo>([
  ["0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24", { name: "Uniswap V3 Router", category: "DEX", auditedBy: ["Trail of Bits", "ABDK"], baseScore: 847 }],
  ["0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD", { name: "Uniswap Universal Router", category: "DEX", auditedBy: ["Trail of Bits"], baseScore: 860 }],
  ["0x33128a8fC17869897dcE68Ed026d694621f6FDfD", { name: "Uniswap V3 Factory", category: "DEX", auditedBy: ["Trail of Bits", "ABDK"], baseScore: 870 }],
  ["0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43", { name: "Aerodrome Router", category: "DEX", auditedBy: ["Code4rena"], baseScore: 780 }],
  ["0x420DD381b31aEf6683db6B902084cB0FFECe40Da", { name: "Aerodrome Factory", category: "DEX", auditedBy: ["Code4rena"], baseScore: 780 }],
  ["0xA238Dd80C259a72e81d7e4664a9801593F98d1c5", { name: "Aave V3 Pool", category: "LENDING", auditedBy: ["OpenZeppelin", "Trail of Bits", "Sigma Prime"], baseScore: 920 }],
  ["0xb125E6687d4313864e53df431d5425969c15Eb2F", { name: "Compound V3 USDC", category: "LENDING", auditedBy: ["OpenZeppelin", "ChainSecurity"], baseScore: 880 }],
  ["0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb", { name: "Morpho Blue", category: "LENDING", auditedBy: ["Spearbit", "Cantina"], baseScore: 820 }],
  ["0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70", { name: "Chainlink ETH/USD Feed", category: "ORACLE", auditedBy: ["Trail of Bits"], baseScore: 910 }],
  ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", { name: "USDC", category: "STABLECOIN", auditedBy: ["Deloitte"], baseScore: 920 }],
  ["0x4200000000000000000000000000000000000006", { name: "WETH", category: "INFRASTRUCTURE", baseScore: 920 }],
  ["0x4200000000000000000000000000000000000010", { name: "L2StandardBridge", category: "BRIDGE", auditedBy: ["Sherlock", "OpenZeppelin"], baseScore: 870 }],
  ["0x45f1A95A4D3f3836523F5c83673c797f4d4d263B", { name: "Stargate Router", category: "BRIDGE", auditedBy: ["Zellic", "Quantstamp"], baseScore: 790 }],
  ["0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", { name: "DAI", category: "STABLECOIN", auditedBy: ["Trail of Bits"], baseScore: 890 }],
  ["0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", { name: "USDbC", category: "STABLECOIN", baseScore: 850 }],
]);

const KNOWN_SCAM_ADDRESSES = new Set([
  "0x000000000000000000000000000000000000dEaD",
  "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF",
  "0x0000000000000000000000000000000000000000",
]);

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type AddressType = "EOA" | "CONTRACT" | "PROTOCOL" | "TOKEN" | "UNKNOWN";

export interface ScoreBreakdown {
  onChainHistory: number;    // max 400
  contractAnalysis: number;  // max 300
  blacklistCheck: number;    // max 200
  activityPattern: number;   // max 100
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

export interface TrustScoreResult {
  score: number;           // 0-1000
  risk: RiskLevel;
  type: AddressType;
  flags: string[];
  breakdown: ScoreBreakdown;
  protocol?: {
    name: string;
    category: string;
    auditedBy?: string[];
  };
  details: AddressDetails;
}

// Simple cache
interface CacheEntry {
  result: TrustScoreResult;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getRisk(score: number): RiskLevel {
  if (score >= 700) return "LOW";
  if (score >= 400) return "MEDIUM";
  if (score >= 100) return "HIGH";
  return "CRITICAL";
}

// Fetch first tx timestamp from Basescan for wallet age
async function getFirstTxTimestamp(address: string): Promise<number | null> {
  if (!BASESCAN_API_KEY) return null;
  try {
    const url = `https://api.basescan.org/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=1&sort=asc&apikey=${BASESCAN_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json() as { status: string; result: Array<{ timeStamp: string }> };
    if (data.status === "1" && data.result?.length > 0) {
      return parseInt(data.result[0].timeStamp) * 1000;
    }
  } catch { /* ignore */ }
  return null;
}

// Fetch last tx timestamp
async function getLastTxTimestamp(address: string): Promise<number | null> {
  if (!BASESCAN_API_KEY) return null;
  try {
    const url = `https://api.basescan.org/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=1&sort=desc&apikey=${BASESCAN_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json() as { status: string; result: Array<{ timeStamp: string }> };
    if (data.status === "1" && data.result?.length > 0) {
      return parseInt(data.result[0].timeStamp) * 1000;
    }
  } catch { /* ignore */ }
  return null;
}

function formatAge(timestampMs: number): string {
  const diffMs = Date.now() - timestampMs;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days >= 365) {
    const years = Math.floor(days / 365);
    const months = Math.floor((days % 365) / 30);
    return months > 0 ? `${years}y ${months}mo` : `${years}y`;
  }
  if (days >= 30) {
    return `${Math.floor(days / 30)} months`;
  }
  return `${days} days`;
}

function formatLastActive(timestampMs: number): string {
  const diffMs = Date.now() - timestampMs;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return `${days} days ago`;
}

export async function computeTrustScore(
  rawAddress: string
): Promise<TrustScoreResult> {
  if (!isAddress(rawAddress)) {
    throw new Error(`Invalid Ethereum address: ${rawAddress}`);
  }

  const address = getAddress(rawAddress);

  // Check cache
  const cached = cache.get(address);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const flags: string[] = [];

  // --- Known scam ---
  const isKnownScam = KNOWN_SCAM_ADDRESSES.has(address);
  if (isKnownScam) {
    flags.push("KNOWN_SCAM_ADDRESS");
    const result: TrustScoreResult = {
      score: 0,
      risk: "CRITICAL",
      type: "UNKNOWN",
      flags,
      breakdown: { onChainHistory: 0, contractAnalysis: 0, blacklistCheck: 0, activityPattern: 0 },
      details: { txCount: 0, balance: "0", balanceETH: 0, isContract: false, isKnownScam: true, isKnownProtocol: false, walletAge: null, lastActive: null },
    };
    cache.set(address, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  }

  // --- Known protocol ---
  const protocolInfo = KNOWN_PROTOCOLS.get(address);
  if (protocolInfo) {
    flags.push("KNOWN_PROTOCOL");
    if (protocolInfo.auditedBy?.length) flags.push("AUDITED");
    flags.push("VERIFIED");

    const score = protocolInfo.baseScore;
    // Distribute score across categories proportionally
    const breakdown: ScoreBreakdown = {
      onChainHistory: Math.min(400, Math.round(score * 0.4)),
      contractAnalysis: Math.min(300, Math.round(score * 0.3)),
      blacklistCheck: Math.min(200, Math.round(score * 0.2)),
      activityPattern: Math.min(100, Math.round(score * 0.1)),
    };

    const result: TrustScoreResult = {
      score,
      risk: getRisk(score),
      type: "PROTOCOL",
      flags,
      breakdown,
      protocol: {
        name: protocolInfo.name,
        category: protocolInfo.category,
        auditedBy: protocolInfo.auditedBy,
      },
      details: { txCount: -1, balance: "0", balanceETH: 0, isContract: true, isKnownScam: false, isKnownProtocol: true, walletAge: null, lastActive: null },
    };
    cache.set(address, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  }

  // --- On-chain queries ---
  let isContract = false;
  let txCount = 0;
  let balanceWei = BigInt(0);

  // Parallel queries
  const [codeResult, txCountResult, balanceResult, firstTx, lastTx] = await Promise.allSettled([
    client.getCode({ address }),
    client.getTransactionCount({ address }),
    client.getBalance({ address }),
    getFirstTxTimestamp(address),
    getLastTxTimestamp(address),
  ]);

  if (codeResult.status === "fulfilled") {
    const code = codeResult.value;
    isContract = !!(code && code !== "0x" && code.length > 2);
    if (isContract) flags.push("IS_CONTRACT");
  } else {
    flags.push("CODE_FETCH_FAILED");
  }

  if (txCountResult.status === "fulfilled") {
    txCount = Number(txCountResult.value);
  } else {
    flags.push("TX_COUNT_FETCH_FAILED");
  }

  if (balanceResult.status === "fulfilled") {
    balanceWei = balanceResult.value;
  }

  const firstTxTs = firstTx.status === "fulfilled" ? firstTx.value : null;
  const lastTxTs = lastTx.status === "fulfilled" ? lastTx.value : null;

  const balanceETH = parseFloat(formatEther(balanceWei));
  const walletAge = firstTxTs ? formatAge(firstTxTs) : null;
  const lastActive = lastTxTs ? formatLastActive(lastTxTs) : null;

  // --- Score Breakdown ---

  // 1. On-chain History (max 400)
  let onChainHistory = 100; // baseline
  if (txCount === 0) {
    onChainHistory = 0;
    flags.push("NO_TRANSACTIONS");
  } else if (txCount < 5) {
    onChainHistory = 50;
    flags.push("FEW_TRANSACTIONS");
  } else if (txCount >= 1000) {
    onChainHistory = 400;
  } else if (txCount >= 100) {
    onChainHistory = 340;
  } else if (txCount >= 20) {
    onChainHistory = 200;
  } else {
    onChainHistory = 120;
  }
  // Wallet age bonus
  if (firstTxTs) {
    const ageDays = (Date.now() - firstTxTs) / (1000 * 60 * 60 * 24);
    if (ageDays >= 365) onChainHistory = Math.min(400, onChainHistory + 60);
    else if (ageDays >= 90) onChainHistory = Math.min(400, onChainHistory + 30);
  }

  // 2. Contract Analysis (max 300)
  let contractAnalysis = 150; // baseline for EOA
  if (isContract) {
    contractAnalysis = 200; // contracts start higher
    // Could check verified source via Basescan later
  }
  // Balance factor
  if (balanceETH >= 10) contractAnalysis = Math.min(300, contractAnalysis + 80);
  else if (balanceETH >= 1) contractAnalysis = Math.min(300, contractAnalysis + 40);
  else if (balanceETH >= 0.1) contractAnalysis = Math.min(300, contractAnalysis + 20);
  else if (balanceETH < 0.001 && txCount > 0) contractAnalysis = Math.max(0, contractAnalysis - 30);

  // 3. Blacklist Check (max 200)
  let blacklistCheck = 180; // default: not on blacklist
  if (isKnownScam) {
    blacklistCheck = 0;
  }
  // Could integrate GoPlus/ScamSniffer here
  if (txCount === 0 && !isContract) {
    blacklistCheck = 100; // unknown = partial score
  }

  // 4. Activity Pattern (max 100)
  let activityPattern = 50; // baseline
  if (lastTxTs) {
    const hoursSinceLastTx = (Date.now() - lastTxTs) / (1000 * 60 * 60);
    if (hoursSinceLastTx < 24) activityPattern = 90;
    else if (hoursSinceLastTx < 168) activityPattern = 70; // week
    else if (hoursSinceLastTx < 720) activityPattern = 50; // month
    else activityPattern = 20; // dormant
  }
  if (txCount === 0) activityPattern = 0;

  const breakdown: ScoreBreakdown = {
    onChainHistory: Math.max(0, Math.min(400, Math.round(onChainHistory))),
    contractAnalysis: Math.max(0, Math.min(300, Math.round(contractAnalysis))),
    blacklistCheck: Math.max(0, Math.min(200, Math.round(blacklistCheck))),
    activityPattern: Math.max(0, Math.min(100, Math.round(activityPattern))),
  };

  const score = Math.max(0, Math.min(1000,
    breakdown.onChainHistory + breakdown.contractAnalysis + breakdown.blacklistCheck + breakdown.activityPattern
  ));

  const addressType: AddressType = isContract ? "CONTRACT" : txCount > 0 ? "EOA" : "UNKNOWN";

  // Additional flags
  if (score >= 700) flags.push("TRUSTED");
  if (balanceETH >= 1) flags.push("FUNDED");
  if (!isContract) flags.push("NOT_BLACKLISTED"); // basic check

  const result: TrustScoreResult = {
    score,
    risk: getRisk(score),
    type: addressType,
    flags,
    breakdown,
    details: {
      txCount,
      balance: balanceWei.toString(),
      balanceETH: Math.round(balanceETH * 10000) / 10000,
      isContract,
      isKnownScam: false,
      isKnownProtocol: false,
      walletAge,
      lastActive,
    },
  };

  cache.set(address, { result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}
