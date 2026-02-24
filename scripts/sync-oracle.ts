/**
 * Sync Oracle Script
 *
 * Reads current trust scores from the Maiat API and pushes them
 * to the TrustScoreOracle contract on Base Sepolia.
 *
 * When a token accumulates reviewCount >= 5, the DataSource is upgraded
 * from SEED → COMMUNITY, automatically unlocking it in TrustGateHook.
 *
 * Usage:
 *   npx tsx scripts/sync-oracle.ts
 *
 * Environment variables required:
 *   - BASE_RELAYER_PRIVATE_KEY: Private key for submitting txs
 *   - TRUST_ORACLE_ADDRESS: Address of deployed TrustScoreOracle
 *   - DATABASE_URL: Database connection string
 */

import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// --- Config ---

const TRUST_ORACLE_ADDRESS = process.env.TRUST_ORACLE_ADDRESS as
  | `0x${string}`
  | undefined;
const RELAYER_PRIVATE_KEY = process.env.BASE_RELAYER_PRIVATE_KEY as
  | `0x${string}`
  | undefined;

// DataSource enum matches TrustScoreOracle.sol
const DataSourceEnum: Record<string, number> = {
  NONE: 0,
  SEED: 1,
  API: 2,
  COMMUNITY: 3,
  VERIFIED: 4,
};

// Known protocol addresses to sync (Base mainnet addresses)
const SYNC_ADDRESSES = [
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
  "0x4200000000000000000000000000000000000006", // WETH
  "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", // DAI
  "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD", // Uniswap Universal Router
  "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43", // Aerodrome Router
  "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5", // Aave V3 Pool
  "0xb125E6687d4313864e53df431d5425969c15Eb2F", // Compound V3
  "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb", // Morpho Blue
  "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70", // Chainlink ETH/USD
  "0x4200000000000000000000000000000000000010", // Base Bridge
  "0x45f1A95A4D3f3836523F5c83673c797f4d4d263B", // Stargate
  "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b", // Virtuals VIRTUAL
  "0x4f9fd6be4a90f2620860d680c0d4d5fb53d1a825", // AIXBT
];

// TrustScoreOracle ABI (minimal — only what we need)
const ORACLE_ABI = [
  {
    name: "batchUpdateTokenScores",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokens", type: "address[]" },
      { name: "scores", type: "uint256[]" },
      { name: "reviewCounts", type: "uint256[]" },
      { name: "avgRatings", type: "uint256[]" },
      { name: "dataSource", type: "uint8" },
    ],
    outputs: [],
  },
  {
    name: "updateUserReputation",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "user", type: "address" },
      { name: "reputationScore", type: "uint256" },
      { name: "totalReviews", type: "uint256" },
      { name: "scarabPoints", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "getTokenData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "trustScore", type: "uint256" },
          { name: "reviewCount", type: "uint256" },
          { name: "avgRating", type: "uint256" },
          { name: "lastUpdated", type: "uint256" },
          { name: "dataSource", type: "uint8" },
        ],
      },
    ],
  },
] as const;

// --- Main ---

interface TokenSyncData {
  address: string;
  score: number;
  reviewCount: number;
  avgRating: number; // stored as rating * 100 (e.g. 450 = 4.5 stars)
  dataSource: number;
}

async function fetchTokenData(address: string): Promise<TokenSyncData> {
  // Try API first
  try {
    const apiUrl =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const [scoreRes, reviewRes] = await Promise.all([
      fetch(`${apiUrl}/api/v1/score/${address}`),
      fetch(`${apiUrl}/api/v1/review?address=${address}`),
    ]);

    const scoreData = scoreRes.ok ? await scoreRes.json() : null;
    const reviewData = reviewRes.ok ? await reviewRes.json() : null;

    const reviewCount = reviewData?.count ?? 0;
    const avgRating = reviewData?.averageRating ?? 0;

    // Determine DataSource based on review count
    let dataSource = DataSourceEnum.SEED;
    if (reviewCount >= 5) {
      dataSource = DataSourceEnum.COMMUNITY;
    } else if (reviewCount > 0) {
      dataSource = DataSourceEnum.API;
    }

    // Convert score from 0-10 scale to 0-100
    const score100 = scoreData?.score
      ? Math.round(scoreData.score * 10)
      : 50;

    return {
      address,
      score: Math.min(100, Math.max(0, score100)),
      reviewCount,
      avgRating: Math.round(avgRating * 100), // 4.5 → 450
      dataSource,
    };
  } catch (error) {
    console.error(`Failed to fetch data for ${address}:`, error);
    return {
      address,
      score: 50,
      reviewCount: 0,
      avgRating: 0,
      dataSource: DataSourceEnum.SEED,
    };
  }
}

async function main() {
  console.log("🔄 Maiat Oracle Sync — Starting...\n");

  if (!TRUST_ORACLE_ADDRESS) {
    console.error(
      "❌ TRUST_ORACLE_ADDRESS not set. Deploy TrustScoreOracle first."
    );
    process.exit(1);
  }

  if (!RELAYER_PRIVATE_KEY) {
    console.error("❌ BASE_RELAYER_PRIVATE_KEY not set.");
    process.exit(1);
  }

  // Setup clients
  const account = privateKeyToAccount(RELAYER_PRIVATE_KEY);
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http("https://sepolia.base.org"),
  });
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http("https://sepolia.base.org"),
  });

  console.log(`📡 Oracle: ${TRUST_ORACLE_ADDRESS}`);
  console.log(`🔑 Relayer: ${account.address}`);
  console.log(`📊 Syncing ${SYNC_ADDRESSES.length} addresses...\n`);

  // Fetch data for all addresses
  const tokenDataList = await Promise.all(
    SYNC_ADDRESSES.map(fetchTokenData)
  );

  // Separate by DataSource for batching
  const seedTokens = tokenDataList.filter(
    (t) => t.dataSource === DataSourceEnum.SEED
  );
  const apiTokens = tokenDataList.filter(
    (t) => t.dataSource === DataSourceEnum.API
  );
  const communityTokens = tokenDataList.filter(
    (t) => t.dataSource === DataSourceEnum.COMMUNITY
  );

  // Print summary
  console.log("📋 Summary:");
  for (const t of tokenDataList) {
    const dsLabel = ["NONE", "SEED", "API", "COMMUNITY", "VERIFIED"][
      t.dataSource
    ];
    console.log(
      `  ${t.address.slice(0, 10)}... → Score: ${t.score}, Reviews: ${t.reviewCount}, DataSource: ${dsLabel}`
    );
  }
  console.log();

  // Batch update by DataSource
  for (const [label, tokens, ds] of [
    ["SEED", seedTokens, DataSourceEnum.SEED],
    ["API", apiTokens, DataSourceEnum.API],
    ["COMMUNITY", communityTokens, DataSourceEnum.COMMUNITY],
  ] as [string, TokenSyncData[], number][]) {
    if (tokens.length === 0) {
      console.log(`⏭️  No ${label} tokens to sync`);
      continue;
    }

    console.log(
      `🔄 Syncing ${tokens.length} ${label} tokens...`
    );

    try {
      const txHash = await walletClient.writeContract({
        address: TRUST_ORACLE_ADDRESS,
        abi: ORACLE_ABI,
        functionName: "batchUpdateTokenScores",
        args: [
          tokens.map((t) => t.address as `0x${string}`),
          tokens.map((t) => BigInt(t.score)),
          tokens.map((t) => BigInt(t.reviewCount)),
          tokens.map((t) => BigInt(t.avgRating)),
          ds,
        ],
      });

      console.log(`✅ ${label} batch tx: ${txHash}`);

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });
      console.log(
        `   Confirmed in block ${receipt.blockNumber} (gas: ${receipt.gasUsed})\n`
      );
    } catch (error) {
      console.error(`❌ ${label} batch failed:`, error);
    }
  }

  // Highlight community tokens (these are now tradeable via TrustGateHook!)
  if (communityTokens.length > 0) {
    console.log("\n🎉 Community-verified tokens (unlocked for trading):");
    for (const t of communityTokens) {
      console.log(
        `   ${t.address} → ${t.reviewCount} reviews, score: ${t.score}`
      );
    }
  }

  console.log("\n✅ Oracle sync complete!");
}

main().catch(console.error);
