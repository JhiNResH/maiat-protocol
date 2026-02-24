import { createPublicClient, http, getAddress, isAddress } from "viem";
import { base } from "viem/chains";

const ALCHEMY_BASE_RPC = process.env.ALCHEMY_BASE_RPC ?? "https://mainnet.base.org";

const client = createPublicClient({
  chain: base,
  transport: http(ALCHEMY_BASE_RPC),
});

// --- Known Protocols (Base mainnet) ---
// Format: checksummed address → { name, category, auditedBy? }

interface ProtocolInfo {
  name: string;
  category: "DEX" | "LENDING" | "BRIDGE" | "STABLECOIN" | "ORACLE" | "INFRASTRUCTURE" | "YIELD" | "NFT";
  auditedBy?: string[];
  baseScore: number; // 0-10
}

const KNOWN_PROTOCOLS = new Map<string, ProtocolInfo>([
  // Uniswap
  ["0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24", { name: "Uniswap V3 Router", category: "DEX", auditedBy: ["Trail of Bits", "ABDK"], baseScore: 9.5 }],
  ["0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD", { name: "Uniswap Universal Router", category: "DEX", auditedBy: ["Trail of Bits"], baseScore: 9.5 }],
  ["0x33128a8fC17869897dcE68Ed026d694621f6FDfD", { name: "Uniswap V3 Factory", category: "DEX", auditedBy: ["Trail of Bits", "ABDK"], baseScore: 9.5 }],
  // Aerodrome (Base native DEX)
  ["0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43", { name: "Aerodrome Router", category: "DEX", auditedBy: ["Code4rena"], baseScore: 8.5 }],
  ["0x420DD381b31aEf6683db6B902084cB0FFECe40Da", { name: "Aerodrome Factory", category: "DEX", auditedBy: ["Code4rena"], baseScore: 8.5 }],
  // Aave V3
  ["0xA238Dd80C259a72e81d7e4664a9801593F98d1c5", { name: "Aave V3 Pool", category: "LENDING", auditedBy: ["OpenZeppelin", "Trail of Bits", "Sigma Prime"], baseScore: 9.5 }],
  // Compound V3
  ["0xb125E6687d4313864e53df431d5425969c15Eb2F", { name: "Compound V3 USDC", category: "LENDING", auditedBy: ["OpenZeppelin", "ChainSecurity"], baseScore: 9.0 }],
  // Morpho
  ["0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb", { name: "Morpho Blue", category: "LENDING", auditedBy: ["Spearbit", "Cantina"], baseScore: 8.5 }],
  // Chainlink
  ["0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70", { name: "Chainlink ETH/USD Feed", category: "ORACLE", auditedBy: ["Trail of Bits"], baseScore: 9.5 }],
  // Circle (USDC)
  ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", { name: "USDC", category: "STABLECOIN", auditedBy: ["Deloitte"], baseScore: 9.0 }],
  // WETH
  ["0x4200000000000000000000000000000000000006", { name: "WETH", category: "INFRASTRUCTURE", baseScore: 9.5 }],
  // Base Bridge
  ["0x4200000000000000000000000000000000000010", { name: "L2StandardBridge", category: "BRIDGE", auditedBy: ["Sherlock", "OpenZeppelin"], baseScore: 9.0 }],
  // Stargate
  ["0x45f1A95A4D3f3836523F5c83673c797f4d4d263B", { name: "Stargate Router", category: "BRIDGE", auditedBy: ["Zellic", "Quantstamp"], baseScore: 8.0 }],
  // Extra Finance
  ["0xBb505c54D71E9e599cB8435b4F0cEEc05fC71cbD", { name: "Extra Finance", category: "YIELD", auditedBy: ["Peckshield"], baseScore: 7.5 }],
]);

// Known scam / burn addresses
const KNOWN_SCAM_ADDRESSES = new Set([
  "0x000000000000000000000000000000000000dEaD",
  "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF",
  "0x0000000000000000000000000000000000000000",
]);

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type AddressType = "EOA" | "CONTRACT" | "PROTOCOL" | "TOKEN" | "UNKNOWN";

export interface TrustScoreResult {
  score: number;        // 0-10 (one decimal)
  risk: RiskLevel;
  type: AddressType;
  flags: string[];
  protocol?: {
    name: string;
    category: string;
    auditedBy?: string[];
  };
  details: {
    txCount: number;
    isContract: boolean;
    isKnownScam: boolean;
    isKnownProtocol: boolean;
    rawScore: number;
  };
}

// Simple cache
interface CacheEntry {
  result: TrustScoreResult;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getRisk(score: number): RiskLevel {
  if (score >= 7) return "LOW";
  if (score >= 5) return "MEDIUM";
  if (score >= 3) return "HIGH";
  return "CRITICAL";
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

  // --- Factor 0: Known scam ---
  const isKnownScam = KNOWN_SCAM_ADDRESSES.has(address);
  if (isKnownScam) {
    flags.push("KNOWN_SCAM_ADDRESS");
    const result: TrustScoreResult = {
      score: 0,
      risk: "CRITICAL",
      type: "UNKNOWN",
      flags,
      details: { txCount: 0, isContract: false, isKnownScam: true, isKnownProtocol: false, rawScore: 0 },
    };
    cache.set(address, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  }

  // --- Factor 1: Known protocol check ---
  const protocolInfo = KNOWN_PROTOCOLS.get(address);
  if (protocolInfo) {
    flags.push("KNOWN_PROTOCOL");
    if (protocolInfo.auditedBy?.length) flags.push("AUDITED");

    const result: TrustScoreResult = {
      score: protocolInfo.baseScore,
      risk: getRisk(protocolInfo.baseScore),
      type: "PROTOCOL",
      flags,
      protocol: {
        name: protocolInfo.name,
        category: protocolInfo.category,
        auditedBy: protocolInfo.auditedBy,
      },
      details: { txCount: -1, isContract: true, isKnownScam: false, isKnownProtocol: true, rawScore: protocolInfo.baseScore },
    };
    cache.set(address, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  }

  // --- Factor 2: Is contract? ---
  let isContract = false;
  try {
    const code = await client.getCode({ address });
    isContract = !!(code && code !== "0x" && code.length > 2);
    if (isContract) {
      flags.push("IS_CONTRACT");
    }
  } catch {
    flags.push("CODE_FETCH_FAILED");
  }

  // --- Factor 3: Transaction count ---
  let txCount = 0;
  try {
    txCount = Number(await client.getTransactionCount({ address }));
  } catch {
    flags.push("TX_COUNT_FETCH_FAILED");
  }

  // --- Compute score (0-10 scale) ---
  let score = 5.0; // baseline

  // Contract bonus
  if (isContract) {
    score += 0.5;
  }

  // Transaction count factor
  if (txCount === 0) {
    flags.push("NO_TRANSACTIONS");
    score -= 2.0;
  } else if (txCount < 5) {
    flags.push("FEW_TRANSACTIONS");
    score -= 0.5;
  } else if (txCount >= 1000) {
    score += 2.5;
  } else if (txCount >= 100) {
    score += 2.0;
  } else if (txCount >= 20) {
    score += 1.0;
  } else if (txCount >= 5) {
    score += 0.5;
  }

  // Clamp to 0-10
  score = Math.max(0, Math.min(10, score));
  // Round to one decimal
  score = Math.round(score * 10) / 10;

  const addressType: AddressType = isContract ? "CONTRACT" : txCount > 0 ? "EOA" : "UNKNOWN";

  const result: TrustScoreResult = {
    score,
    risk: getRisk(score),
    type: addressType,
    flags,
    details: {
      txCount,
      isContract,
      isKnownScam: false,
      isKnownProtocol: false,
      rawScore: score,
    },
  };

  cache.set(address, { result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}
