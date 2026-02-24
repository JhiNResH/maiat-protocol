import { createPublicClient, http, getAddress, isAddress } from "viem";
import { baseSepolia } from "viem/chains";

const client = createPublicClient({
  chain: baseSepolia,
  transport: http("https://sepolia.base.org"),
});

// Hardcoded known scam addresses (checksummed)
const KNOWN_SCAM_ADDRESSES = new Set([
  "0x000000000000000000000000000000000000dEaD",
  "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF",
  "0x6B175474E89094C44Da98b954EedeAC495271d0F", // placeholder scam 1
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // placeholder scam 2
  "0xdAC17F958D2ee523a2206206994597C13D831ec7", // placeholder scam 3
]).add("0x0000000000000000000000000000000000000000");

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface TrustScoreResult {
  score: number;        // 0-1000
  risk: RiskLevel;
  type: "EOA" | "CONTRACT" | "UNKNOWN";
  flags: string[];
  details: {
    txCount: number;
    isContract: boolean;
    isKnownScam: boolean;
    rawScore: number;
  };
}

// Simple cache: address -> { result, expiresAt }
interface CacheEntry {
  result: TrustScoreResult;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getRisk(score: number): RiskLevel {
  if (score > 700) return "LOW";
  if (score > 400) return "MEDIUM";
  if (score > 100) return "HIGH";
  return "CRITICAL";
}

export async function computeTrustScore(
  rawAddress: string
): Promise<TrustScoreResult> {
  // Validate address
  if (!isAddress(rawAddress)) {
    throw new Error(`Invalid Ethereum address: ${rawAddress}`);
  }

  const address = getAddress(rawAddress); // checksummed

  // Check cache
  const cached = cache.get(address);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const flags: string[] = [];
  let score = 500; // baseline

  // --- Factor 1: Known scam check ---
  const isKnownScam = KNOWN_SCAM_ADDRESSES.has(address);
  if (isKnownScam) {
    flags.push("KNOWN_SCAM_ADDRESS");
    score = 0;
  }

  // --- Factor 2: Is contract? ---
  let isContract = false;
  try {
    const code = await client.getCode({ address });
    isContract = !!(code && code !== "0x" && code.length > 2);
    if (isContract) {
      flags.push("IS_CONTRACT");
      // Contracts get a slight bonus as they are deployed intentionally
      score = Math.min(1000, score + 50);
    }
  } catch {
    flags.push("CODE_FETCH_FAILED");
  }

  // --- Factor 3: Transaction count ---
  let txCount = 0;
  try {
    txCount = Number(
      await client.getTransactionCount({ address })
    );

    if (txCount === 0) {
      flags.push("NO_TRANSACTIONS");
      score = Math.max(0, score - 200);
    } else if (txCount < 5) {
      flags.push("FEW_TRANSACTIONS");
      score = Math.max(0, score - 50);
    } else if (txCount >= 100) {
      score = Math.min(1000, score + 200);
    } else if (txCount >= 20) {
      score = Math.min(1000, score + 100);
    } else if (txCount >= 5) {
      score = Math.min(1000, score + 50);
    }
  } catch {
    flags.push("TX_COUNT_FETCH_FAILED");
    score = Math.max(0, score - 100);
  }

  // Clamp if known scam, regardless of other factors
  if (isKnownScam) {
    score = 0;
  }

  const result: TrustScoreResult = {
    score: Math.max(0, Math.min(1000, Math.round(score))),
    risk: getRisk(score),
    type: isContract ? "CONTRACT" : txCount > 0 ? "EOA" : "UNKNOWN",
    flags,
    details: {
      txCount,
      isContract,
      isKnownScam,
      rawScore: score,
    },
  };

  // Cache result
  cache.set(address, { result, expiresAt: Date.now() + CACHE_TTL_MS });

  return result;
}
