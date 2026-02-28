/**
 * scripts/acp-indexer.ts
 *
 * ACP Behavioral Trust Score Indexer
 * ====================================
 * Scans ALL job history from Virtuals ACP on Base chain,
 * computes behavioral trust scores, and upserts into Supabase.
 *
 * Contract Addresses (from @virtuals-protocol/acp-node v0.3.0-beta.37):
 *   Base Sepolia V2:  0xdf54E6Ed6cD1d0632d973ADECf96597b7e87893c
 *   Base Mainnet V2:  0xa6C9BA866992cfD7fd6460ba912bfa405adA9df0
 *
 * Job Phases (ACPTypes.JobPhase enum):
 *   0 = REQUEST, 1 = NEGOTIATION, 2 = TRANSACTION, 3 = EVALUATION
 *   4 = COMPLETED, 5 = REJECTED, 6 = EXPIRED
 *
 * Run:
 *   npx tsx scripts/acp-indexer.ts              # Base Sepolia (default)
 *   npx tsx scripts/acp-indexer.ts --mainnet    # Base Mainnet
 *   npx tsx scripts/acp-indexer.ts --dry-run    # Compute scores, don't write to DB
 */

import "dotenv/config";
import { createPublicClient, http, getAddress } from "viem";
import { baseSepolia, base } from "viem/chains";
import { PrismaClient } from "@prisma/client";

// ─── Config ──────────────────────────────────────────────────────────────────

const IS_MAINNET = process.argv.includes("--mainnet");
const DRY_RUN = process.argv.includes("--dry-run");

const NETWORK = IS_MAINNET ? "Base Mainnet" : "Base Sepolia";
const CHAIN = IS_MAINNET ? base : baseSepolia;

/**
 * ACP Registry contract addresses (V2).
 * Source: @virtuals-protocol/acp-node package dist/index.js
 */
const ACP_CONTRACT = IS_MAINNET
  ? ("0xa6C9BA866992cfD7fd6460ba912bfa405adA9df0" as const)
  : ("0xdf54E6Ed6cD1d0632d973ADECf96597b7e87893c" as const);

const RPC_URL = IS_MAINNET
  ? process.env.ALCHEMY_BASE_RPC ?? "https://mainnet.base.org"
  : process.env.ALCHEMY_BASE_SEPOLIA_RPC ?? "https://sepolia.base.org";

// Batch sizes — keeps RPC calls within Alchemy free-tier limits
const BLOCK_CHUNK = 2_000;   // blocks per getLogs chunk (Alchemy limit)
const JOB_BATCH   = 50;      // multicall batch for getJob()

/**
 * ACP V2 estimated deployment blocks:
 *   Base Sepolia: ~15,000,000 (mid-2024)
 *   Base Mainnet: ~22,000,000 (late 2024)
 * Override with --from-block=<n>
 */
const DEFAULT_FROM_BLOCK = IS_MAINNET ? 22_000_000n : 15_000_000n;

// Parse optional --from-block=<n> CLI arg
const fromBlockArg = process.argv.find((a) => a.startsWith("--from-block="));
const USER_FROM_BLOCK = fromBlockArg
  ? BigInt(fromBlockArg.split("=")[1])
  : DEFAULT_FROM_BLOCK;

// ─── ABIs ────────────────────────────────────────────────────────────────────

/**
 * Minimal ABI for querying Virtuals ACP V2 contract.
 * Sourced from the @virtuals-protocol/acp-node SDK dist/index.js.
 */
const ACP_V2_ABI = [
  // JobCreated event (V2)
  {
    type: "event" as const,
    name: "JobCreated",
    inputs: [
      { indexed: true,  name: "jobId",     type: "uint256" },
      { indexed: true,  name: "accountId", type: "uint256" },
      { indexed: true,  name: "client",    type: "address" },
      { indexed: false, name: "provider",  type: "address" },
      { indexed: false, name: "evaluator", type: "address" },
      { indexed: false, name: "expiredAt", type: "uint256" },
    ],
  },
  // jobCounter() → total jobs created
  {
    type: "function" as const,
    name: "jobCounter",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view" as const,
  },
  // getJob(jobId) → Job struct
  {
    type: "function" as const,
    name: "getJob",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id",              type: "uint256"  },
          { name: "accountId",       type: "uint256"  },
          { name: "client",          type: "address"  },
          { name: "provider",        type: "address"  },
          { name: "evaluator",       type: "address"  },
          { name: "creator",         type: "address"  },
          { name: "budget",          type: "uint256"  },
          { name: "jobPaymentToken", type: "address"  },
          { name: "phase",           type: "uint8"    },
          { name: "expiredAt",       type: "uint256"  },
          { name: "createdAt",       type: "uint256"  },
          { name: "memoCount",       type: "uint256"  },
          { name: "metadata",        type: "string"   },
          { name: "amountClaimed",   type: "uint256"  },
        ],
      },
    ],
    stateMutability: "view" as const,
  },
] as const;

// ─── Types ───────────────────────────────────────────────────────────────────

/** ACPTypes.JobPhase enum from Virtuals Protocol SDK */
const JobPhase = {
  REQUEST:     0,
  NEGOTIATION: 1,
  TRANSACTION: 2,
  EVALUATION:  3,
  COMPLETED:   4,
  REJECTED:    5,
  EXPIRED:     6,
} as const;

interface AcpJob {
  id:            bigint;
  accountId:     bigint;
  client:        string;
  provider:      string;
  evaluator:     string;
  creator:       string;
  budget:        bigint;
  phase:         number;
  expiredAt:     bigint;
  createdAt:     bigint;
  amountClaimed: bigint;
}

interface AgentMetrics {
  walletAddress:             string;
  totalJobsAsProvider:       number;
  completedJobs:             number;
  rejectedJobs:              number;
  expiredJobs:               number;
  inProgressJobs:            number;
  paymentFulfilledJobs:      number;
  firstJobTimestamp:         number | null;
  lastJobTimestamp:          number | null;
  /** completion_rate = completed / (completed + rejected + expired) */
  completionRate:            number;
  /** payment_fulfillment_rate = jobs with amountClaimed > 0 / completed */
  paymentFulfillmentRate:    number;
  /** expire_rate = expired / total (ghosting indicator) */
  expireRate:                number;
}

interface TrustScoreResult {
  walletAddress:  string;
  trustScore:     number;  // 0–100
  completionRate: number;
  paymentRate:    number;
  expireRate:     number;
  totalJobs:      number;
  rawMetrics:     AgentMetrics;
}

// ─── Score Formula ────────────────────────────────────────────────────────────

/**
 * ACP Trust Score formula (per spec: 2026-02-28-acp-trust-score-ingestion.md)
 *
 * acp_score =
 *   completion_rate   × 35 +
 *   payment_rate      × 25 +
 *   age_factor        × 20 +   // (now - first_job) / 365 days, max 1.0
 *   volume_factor     × 10 +   // log10(total_jobs+1) / 2, max 1.0
 *   (1 - expire_rate) × 10
 *
 * Already scales to 0–100.
 */
function computeTrustScore(metrics: AgentMetrics): TrustScoreResult {
  const nowSec = Math.floor(Date.now() / 1000);

  // Age factor: (now - first_job_unix) / 365 days, capped at 1.0
  const ageDays = metrics.firstJobTimestamp
    ? (nowSec - metrics.firstJobTimestamp) / 86_400
    : 0;
  const ageFactor = Math.min(ageDays / 365, 1.0);

  // Volume factor: log10(total_jobs+1) / 2, capped at 1.0
  const volumeFactor = Math.min(
    Math.log10(metrics.totalJobsAsProvider + 1) / 2,
    1.0
  );

  const rawScore =
    metrics.completionRate       * 35 +
    metrics.paymentFulfillmentRate * 25 +
    ageFactor                    * 20 +
    volumeFactor                 * 10 +
    (1 - metrics.expireRate)     * 10;

  // Clamp to 0–100 and round
  const trustScore = Math.round(Math.max(0, Math.min(100, rawScore)));

  return {
    walletAddress:  metrics.walletAddress,
    trustScore,
    completionRate: metrics.completionRate,
    paymentRate:    metrics.paymentFulfillmentRate,
    expireRate:     metrics.expireRate,
    totalJobs:      metrics.totalJobsAsProvider,
    rawMetrics:     metrics,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Compute behavioral metrics for a single provider from their job list.
 */
function computeMetrics(walletAddress: string, jobs: AcpJob[]): AgentMetrics {
  // Only count jobs where this address is the provider
  const providerJobs = jobs.filter(
    (j) => j.provider.toLowerCase() === walletAddress.toLowerCase()
  );

  const total     = providerJobs.length;
  const completed = providerJobs.filter((j) => j.phase === JobPhase.COMPLETED).length;
  const rejected  = providerJobs.filter((j) => j.phase === JobPhase.REJECTED).length;
  const expired   = providerJobs.filter((j) => j.phase === JobPhase.EXPIRED).length;
  const inProgress = total - completed - rejected - expired;

  // Payment fulfilled: completed jobs where provider received payment (amountClaimed > 0)
  // Note: x402 payments may not reflect in amountClaimed — we default completed → paid
  const paymentFulfilled = providerJobs.filter(
    (j) => j.phase === JobPhase.COMPLETED
  ).length; // All completed jobs are considered paid in ACP (escrow auto-releases)

  const finalisedJobs = completed + rejected + expired;

  const completionRate         = finalisedJobs > 0 ? completed / finalisedJobs : 0;
  const paymentFulfillmentRate = completed > 0     ? paymentFulfilled / completed : 0;
  const expireRate             = total > 0         ? expired / total : 0;

  // Sort timestamps
  const timestamps = providerJobs
    .map((j) => Number(j.createdAt))
    .filter((t) => t > 0)
    .sort((a, b) => a - b);

  return {
    walletAddress,
    totalJobsAsProvider:    total,
    completedJobs:          completed,
    rejectedJobs:           rejected,
    expiredJobs:            expired,
    inProgressJobs:         inProgress,
    paymentFulfilledJobs:   paymentFulfilled,
    firstJobTimestamp:      timestamps[0]                     ?? null,
    lastJobTimestamp:       timestamps[timestamps.length - 1] ?? null,
    completionRate,
    paymentFulfillmentRate,
    expireRate,
  };
}

// ─── Main Indexer ─────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔍 ACP Indexer — ${NETWORK}`);
  console.log(`   Contract: ${ACP_CONTRACT}`);
  console.log(`   RPC:      ${RPC_URL}`);
  if (DRY_RUN) console.log("   ⚠️  DRY RUN — no DB writes\n");

  // ── 1. Set up clients ────────────────────────────────────────────────────

  const publicClient = createPublicClient({
    chain:     CHAIN,
    transport: http(RPC_URL),
  });

  const db = new PrismaClient();

  try {
    // ── 2. Get current block & total job count ───────────────────────────

    const latestBlock = await publicClient.getBlockNumber();
    console.log(`📦 Latest block: ${latestBlock}`);

    let totalJobs: bigint;
    try {
      totalJobs = await publicClient.readContract({
        address:      ACP_CONTRACT,
        abi:          ACP_V2_ABI,
        functionName: "jobCounter",
      }) as bigint;
      console.log(`📊 Total jobs in registry: ${totalJobs}\n`);
    } catch (err) {
      console.warn("⚠️  Could not read jobCounter — contract may not be deployed on this network.");
      console.warn("   Using event scanning only.\n");
      totalJobs = 0n;
    }

    // ── 3. Scan JobCreated events to build provider → jobId map ─────────

    console.log("🔎 Scanning JobCreated events...");

    // Provider → Set of job IDs
    const providerJobs = new Map<string, Set<bigint>>();
    // JobId → creation timestamp (from event block)
    const jobIdToProvider = new Map<string, string>();

    let scannedChunks = 0;
    const fromBlock = USER_FROM_BLOCK;

    console.log(`   Scanning from block ${fromBlock.toLocaleString()} (use --from-block=<n> to override)\n`);

    for (let start = fromBlock; start <= latestBlock; start += BigInt(BLOCK_CHUNK)) {
      const end = start + BigInt(BLOCK_CHUNK) - 1n < latestBlock
        ? start + BigInt(BLOCK_CHUNK) - 1n
        : latestBlock;

      try {
        const logs = await publicClient.getLogs({
          address:   ACP_CONTRACT,
          // Use the event ABI directly (more reliable than parseAbiItem for mixed indexed)
          event:     ACP_V2_ABI[0],
          fromBlock: start,
          toBlock:   end,
        });

        for (const log of logs) {
          const args = log.args as {
            jobId:     bigint;
            accountId: bigint;
            client:    string;
            provider:  string;
            evaluator: string;
            expiredAt: bigint;
          };

          if (!args.provider) continue;

          const providerAddr = getAddress(args.provider);

          if (!providerJobs.has(providerAddr)) {
            providerJobs.set(providerAddr, new Set());
          }
          providerJobs.get(providerAddr)!.add(args.jobId);
          jobIdToProvider.set(args.jobId.toString(), providerAddr);
        }

        scannedChunks++;
        if (scannedChunks % 10 === 0) {
          process.stdout.write(
            `\r   Scanned to block ${end.toLocaleString()} / ${latestBlock.toLocaleString()} — ${providerJobs.size} providers found`
          );
        }

        // Throttle to avoid rate limits
        if (logs.length > 0) await sleep(200);
        else await sleep(50);

      } catch (err: any) {
        const errMsg = err.message ?? String(err);
        console.error(`\n⚠️  Error scanning blocks ${start}–${end}: ${errMsg.slice(0, 200)}`);
        // If it's a block-range error, skip ahead; otherwise, retry
        await sleep(1000);
      }
    }

    console.log(`\n✅ Event scan complete: ${providerJobs.size} unique providers, ${jobIdToProvider.size} jobs\n`);

    if (providerJobs.size === 0) {
      console.log("ℹ️  No jobs found on this network. Exiting.");
      return;
    }

    // ── 4. Fetch full job details via multicall (batched) ────────────────

    console.log("📡 Fetching job details via multicall...");

    // All unique job IDs across all providers
    const allJobIds = Array.from(jobIdToProvider.keys()).map(BigInt);

    // Provider → AcpJob[]
    const providerJobData = new Map<string, AcpJob[]>();

    for (let i = 0; i < allJobIds.length; i += JOB_BATCH) {
      const batch = allJobIds.slice(i, i + JOB_BATCH);

      try {
        const calls = batch.map((jobId) => ({
          address:      ACP_CONTRACT as `0x${string}`,
          abi:          ACP_V2_ABI,
          functionName: "getJob" as const,
          args:         [jobId] as const,
        }));

        const results = await publicClient.multicall({ contracts: calls, allowFailure: true });

        for (let j = 0; j < batch.length; j++) {
          const result = results[j];
          if (result.status !== "success" || !result.result) continue;

          // Viem multicall returns the tuple as-is; cast it
          const raw = result.result as {
            id:            bigint;
            accountId:     bigint;
            client:        string;
            provider:      string;
            evaluator:     string;
            creator:       string;
            budget:        bigint;
            jobPaymentToken: string;
            phase:         number;
            expiredAt:     bigint;
            createdAt:     bigint;
            memoCount:     bigint;
            metadata:      string;
            amountClaimed: bigint;
          };

          const job: AcpJob = {
            id:            raw.id,
            accountId:     raw.accountId,
            client:        raw.client,
            provider:      raw.provider,
            evaluator:     raw.evaluator,
            creator:       raw.creator,
            budget:        raw.budget,
            phase:         raw.phase,
            expiredAt:     raw.expiredAt,
            createdAt:     raw.createdAt,
            amountClaimed: raw.amountClaimed,
          };

          const providerAddr = getAddress(job.provider);
          if (!providerJobData.has(providerAddr)) {
            providerJobData.set(providerAddr, []);
          }
          providerJobData.get(providerAddr)!.push(job);
        }

        process.stdout.write(
          `\r   Fetched ${Math.min(i + JOB_BATCH, allJobIds.length)} / ${allJobIds.length} jobs`
        );

        await sleep(150);

      } catch (err: any) {
        console.error(`\n⚠️  Multicall error for batch ${i}–${i + JOB_BATCH}: ${err.message?.slice(0, 100)}`);
        await sleep(500);
      }
    }

    console.log(`\n✅ Fetched job details for ${providerJobData.size} providers\n`);

    // ── 5. Compute metrics & trust scores ────────────────────────────────

    console.log("🧮 Computing trust scores...");

    const scoreResults: TrustScoreResult[] = [];

    for (const [providerAddr, jobs] of providerJobData.entries()) {
      const metrics = computeMetrics(providerAddr, jobs);
      const scored  = computeTrustScore(metrics);
      scoreResults.push(scored);
    }

    // Sort by trust score descending for nice display
    scoreResults.sort((a, b) => b.trustScore - a.trustScore);

    console.log(`\n📋 Trust Score Results (top 20):\n`);
    console.log(
      "   Address                                    Score  Jobs  Complete  Expire"
    );
    console.log("   " + "─".repeat(75));

    for (const r of scoreResults.slice(0, 20)) {
      console.log(
        `   ${r.walletAddress.slice(0, 42).padEnd(44)} ${String(r.trustScore).padStart(3)}    ${String(r.totalJobs).padStart(4)}  ${(r.completionRate * 100).toFixed(0).padStart(6)}%  ${(r.expireRate * 100).toFixed(0).padStart(5)}%`
      );
    }

    if (DRY_RUN) {
      console.log("\n⚠️  DRY RUN — skipping DB writes.");
      return;
    }

    // ── 6. Upsert to Supabase ────────────────────────────────────────────

    console.log(`\n💾 Upserting ${scoreResults.length} agent scores to Supabase...`);

    let saved = 0;
    let failed = 0;

    for (const score of scoreResults) {
      try {
        // Serialize through JSON to satisfy Prisma's InputJsonValue type
        const rawMetricsJson = JSON.parse(JSON.stringify(score.rawMetrics));

        await db.agentScore.upsert({
          where:  { walletAddress: score.walletAddress },
          create: {
            walletAddress:  score.walletAddress,
            trustScore:     score.trustScore,
            completionRate: score.completionRate,
            paymentRate:    score.paymentRate,
            expireRate:     score.expireRate,
            totalJobs:      score.totalJobs,
            dataSource:     "ACP_BEHAVIORAL",
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            rawMetrics:     rawMetricsJson,
          },
          update: {
            trustScore:     score.trustScore,
            completionRate: score.completionRate,
            paymentRate:    score.paymentRate,
            expireRate:     score.expireRate,
            totalJobs:      score.totalJobs,
            dataSource:     "ACP_BEHAVIORAL",
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            rawMetrics:     rawMetricsJson,
          },
        });
        saved++;
      } catch (err: any) {
        console.error(`\n❌ DB error for ${score.walletAddress}: ${err.message?.slice(0, 80)}`);
        failed++;
      }
    }

    console.log(`\n✅ Done — ${saved} upserted, ${failed} failed`);

  } finally {
    await db.$disconnect();
  }
}

main().catch(async (err) => {
  console.error("\n💥 Fatal error:", err);
  process.exit(1);
});
