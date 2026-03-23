/**
 * Oracle Auto-Update Pipeline
 *
 * Reads AgentScore records from Prisma where trustScore changed since last sync,
 * then batch-updates the TrustScoreOracle contract on Base Sepolia.
 *
 * Optimizations:
 * - Delta filter: only pushes scores that changed by >= SCORE_DELTA_THRESHOLD (10 points)
 * - Tracks last-pushed scores in memory to avoid redundant txs
 * - Supports immediate push for critical alerts (pushSingleScore)
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
  type Address,
} from 'viem'
import { base, baseSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { prisma } from '@/lib/prisma'

const ORACLE_ADDRESS = (
  process.env.ORACLE_ADDRESS ||
  process.env.TRUST_SCORE_ORACLE_ADDRESS ||
  '0xf662902ca227baba3a4d11a1bc58073e0b0d1139'  // TrustScoreOracle on Base Sepolia
) as `0x${string}`

const USE_TESTNET = process.env.ORACLE_USE_TESTNET === 'true'
const CHAIN = USE_TESTNET ? baseSepolia : base

// Only push if score changed by >= this amount (saves gas)
const SCORE_DELTA_THRESHOLD = 10

// DataSource enum matches contract: NONE=0, SEED=1, API=2, COMMUNITY=3, VERIFIED=4
const DATA_SOURCE_MAP: Record<string, number> = {
  ACP_BEHAVIORAL: 2,
  COMMUNITY: 3,
  VERIFIED: 4,
  SEED: 1,
}

const ORACLE_ABI = [
  {
    name: 'batchUpdateTokenScores',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokens', type: 'address[]' },
      { name: 'scores', type: 'uint256[]' },
      { name: 'reviewCounts', type: 'uint256[]' },
      { name: 'avgRatings', type: 'uint256[]' },
      { name: 'dataSource', type: 'uint8' },
    ],
    outputs: [],
  },
  {
    name: 'updateTokenScore',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'score', type: 'uint256' },
      { name: 'reviewCount', type: 'uint256' },
      { name: 'avgRating', type: 'uint256' },
      { name: 'dataSource', type: 'uint8' },
    ],
    outputs: [],
  },
] as const

// ── In-memory state ─────────────────────────────────────────────────────────

let lastSyncTime: Date | null = null

// Track last-pushed scores to detect meaningful changes
const lastPushedScores: Map<string, number> = new Map()

export interface SyncResult {
  synced: number
  skippedNoDelta: number
  txHashes: string[]
  errors: string[]
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getClients() {
  const updaterKey = process.env.ORACLE_UPDATER_KEY || process.env.EAS_DEPLOYER_KEY
  if (!updaterKey) {
    throw new Error('ORACLE_UPDATER_KEY or EAS_DEPLOYER_KEY env var is not set')
  }

  const account = privateKeyToAccount(updaterKey as Hex)
  const rpcUrl = USE_TESTNET
    ? (process.env.ALCHEMY_BASE_SEPOLIA_RPC || undefined)
    : (process.env.ALCHEMY_BASE_RPC || undefined)

  const publicClient = createPublicClient({
    chain: CHAIN,
    transport: http(rpcUrl),
  })

  const walletClient = createWalletClient({
    account,
    chain: CHAIN,
    transport: http(rpcUrl),
  })

  return { account, publicClient, walletClient }
}

/**
 * Fetch AgentScore records that have been updated since the last sync
 * and have a valid tokenAddress (required for on-chain update).
 */
async function getChangedScores() {
  const where: Record<string, unknown> = {
    tokenAddress: { not: null },
  }
  if (lastSyncTime) {
    where.lastUpdated = { gt: lastSyncTime }
  }

  return prisma.agentScore.findMany({
    where,
    orderBy: { lastUpdated: 'asc' },
  })
}

/**
 * Filter records to only those with meaningful score changes (>= SCORE_DELTA_THRESHOLD).
 * Always includes records we've never pushed before.
 */
function filterByDelta(records: Array<{ tokenAddress: string | null; trustScore: number }>) {
  const significant: typeof records = []
  const skipped: typeof records = []

  for (const r of records) {
    if (!r.tokenAddress) continue
    const addr = r.tokenAddress.toLowerCase()
    const lastScore = lastPushedScores.get(addr)

    if (lastScore === undefined || Math.abs(r.trustScore - lastScore) >= SCORE_DELTA_THRESHOLD) {
      significant.push(r)
    } else {
      skipped.push(r)
    }
  }

  return { significant, skipped }
}

// ── Main sync (cron) ────────────────────────────────────────────────────────

/**
 * Sync changed AgentScore records to the TrustScoreOracle contract.
 * Only pushes scores that changed by >= SCORE_DELTA_THRESHOLD.
 * Batches up to 100 records per transaction.
 */
export async function syncOracleScores(): Promise<SyncResult> {
  const { publicClient, walletClient } = getClients()

  const allRecords = await getChangedScores()
  if (allRecords.length === 0) {
    return { synced: 0, skippedNoDelta: 0, txHashes: [], errors: [] }
  }

  const { significant, skipped } = filterByDelta(allRecords)

  if (significant.length === 0) {
    // Update sync time even if nothing to push (records were checked)
    lastSyncTime = new Date()
    return { synced: 0, skippedNoDelta: skipped.length, txHashes: [], errors: [] }
  }

  const txHashes: string[] = []
  const errors: string[] = []
  const BATCH_SIZE = 100

  for (let i = 0; i < significant.length; i += BATCH_SIZE) {
    const batch = significant.slice(i, i + BATCH_SIZE)

    const tokens = batch.map((r) => r.tokenAddress as Address)
    const scores = batch.map((r) => BigInt(Math.min(Math.max(r.trustScore, 0), 100)))
    const reviewCounts = batch.map((r) => BigInt(r.totalJobs))
    const avgRatings = batch.map((r) =>
      BigInt(Math.round(Math.min(Number(r.completionRate), 1) * 500))
    )
    const dataSource = DATA_SOURCE_MAP[(batch[0] as Record<string, unknown>).dataSource as string] ?? 2

    try {
      if (batch.length === 1) {
        const hash = await walletClient.writeContract({
          address: ORACLE_ADDRESS,
          abi: ORACLE_ABI,
          functionName: 'updateTokenScore',
          args: [tokens[0], scores[0], reviewCounts[0], avgRatings[0], dataSource],
        })
        await publicClient.waitForTransactionReceipt({ hash })
        txHashes.push(hash)
        console.log(`[oracle-updater] Updated ${tokens[0]} score=${scores[0]} tx=${hash}`)
      } else {
        const hash = await walletClient.writeContract({
          address: ORACLE_ADDRESS,
          abi: ORACLE_ABI,
          functionName: 'batchUpdateTokenScores',
          args: [tokens, scores, reviewCounts, avgRatings, dataSource],
        })
        await publicClient.waitForTransactionReceipt({ hash })
        txHashes.push(hash)
        console.log(`[oracle-updater] Batch updated ${batch.length} scores tx=${hash}`)
      }

      // Track what we pushed
      for (const r of batch) {
        lastPushedScores.set(r.tokenAddress!.toLowerCase(), r.trustScore)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[oracle-updater] Batch failed:`, msg)
      errors.push(msg)
    }
  }

  if (txHashes.length > 0) {
    lastSyncTime = new Date()
  }

  return {
    synced: significant.length,
    skippedNoDelta: skipped.length,
    txHashes,
    errors,
  }
}

// ── Immediate push (for Sentinel alerts / critical changes) ─────────────────

/**
 * Push a single token score to the oracle immediately.
 * Used by Sentinel when a rug alert fires — bypasses cron + delta filter.
 */
export async function pushSingleScore(
  tokenAddress: string,
  score: number,
  reviewCount: number = 0,
  avgRating: number = 0,
  dataSource: 'API' | 'COMMUNITY' | 'VERIFIED' | 'SEED' = 'API',
): Promise<{ txHash: string } | { error: string }> {
  try {
    const { publicClient, walletClient } = getClients()

    const hash = await walletClient.writeContract({
      address: ORACLE_ADDRESS,
      abi: ORACLE_ABI,
      functionName: 'updateTokenScore',
      args: [
        tokenAddress as Address,
        BigInt(Math.min(Math.max(score, 0), 100)),
        BigInt(reviewCount),
        BigInt(avgRating),
        DATA_SOURCE_MAP[dataSource] ?? 2,
      ],
    })
    await publicClient.waitForTransactionReceipt({ hash })

    lastPushedScores.set(tokenAddress.toLowerCase(), score)
    console.log(`[oracle-updater] IMMEDIATE push ${tokenAddress} score=${score} tx=${hash}`)

    return { txHash: hash }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[oracle-updater] Immediate push failed:`, msg)
    return { error: msg }
  }
}

// ── EIP-712 Signed Scores (for hookData verification) ───────────────────────

const EIP712_DOMAIN = {
  name: 'MaiatTrustOracle',
  version: '1',
  chainId: USE_TESTNET ? 84532 : 8453,
  verifyingContract: ORACLE_ADDRESS,
} as const

const SCORE_TYPES = {
  TrustScore: [
    { name: 'token', type: 'address' },
    { name: 'score', type: 'uint256' },
    { name: 'timestamp', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
  ],
} as const

let signatureNonce = 0

/**
 * Sign a trust score off-chain using EIP-712.
 * The signature can be included in swap hookData for on-chain verification.
 * This eliminates the need to push scores to the oracle contract.
 *
 * Returns: { token, score, timestamp, nonce, signature }
 */
export async function signScore(
  tokenAddress: string,
  score: number,
): Promise<{
  token: string
  score: number
  timestamp: number
  nonce: number
  signature: string
}> {
  const updaterKey = process.env.ORACLE_UPDATER_KEY || process.env.EAS_DEPLOYER_KEY
  if (!updaterKey) {
    throw new Error('ORACLE_UPDATER_KEY or EAS_DEPLOYER_KEY env var is not set')
  }

  const account = privateKeyToAccount(updaterKey as Hex)
  const walletClient = createWalletClient({
    account,
    chain: CHAIN,
    transport: http(),
  })

  const timestamp = Math.floor(Date.now() / 1000)
  const nonce = ++signatureNonce

  const signature = await walletClient.signTypedData({
    domain: EIP712_DOMAIN,
    types: SCORE_TYPES,
    primaryType: 'TrustScore',
    message: {
      token: tokenAddress as Address,
      score: BigInt(score),
      timestamp: BigInt(timestamp),
      nonce: BigInt(nonce),
    },
  })

  return {
    token: tokenAddress,
    score,
    timestamp,
    nonce,
    signature,
  }
}
