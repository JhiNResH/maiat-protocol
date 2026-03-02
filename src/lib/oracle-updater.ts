/**
 * Oracle Auto-Update Pipeline
 *
 * Reads AgentScore records from Prisma where trustScore changed since last sync,
 * then batch-updates the TrustScoreOracle contract on Base Sepolia.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
  type Address,
} from 'viem'
import { baseSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { prisma } from '@/lib/prisma'

// TrustScoreOracle on Base Sepolia
const ORACLE_ADDRESS = '0xf6629021AE4E138Dc0869A4CB81462Bb4C28c819' as const

// DataSource enum matches contract: NONE=0, SEED=1, API=2, COMMUNITY=3, VERIFIED=4
const DATA_SOURCE_MAP: Record<string, number> = {
  ACP_BEHAVIORAL: 2, // API source
  COMMUNITY: 3,
  VERIFIED: 4,
  SEED: 1,
}

const BATCH_UPDATE_ABI = [
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

// Persistent in-memory tracker; in production use a DB column or KV store
let lastSyncTime: Date | null = null

export interface SyncResult {
  synced: number
  txHashes: string[]
  errors: string[]
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
 * Sync all changed AgentScore records to the TrustScoreOracle contract.
 * Batches up to 100 records per transaction.
 */
export async function syncOracleScores(): Promise<SyncResult> {
  const updaterKey = process.env.ORACLE_UPDATER_KEY
  if (!updaterKey) {
    throw new Error('ORACLE_UPDATER_KEY env var is not set')
  }

  const account = privateKeyToAccount(updaterKey as Hex)

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  })

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(),
  })

  const records = await getChangedScores()
  if (records.length === 0) {
    return { synced: 0, txHashes: [], errors: [] }
  }

  const txHashes: string[] = []
  const errors: string[] = []
  const BATCH_SIZE = 100

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)

    const tokens = batch.map((r) => r.tokenAddress as Address)
    const scores = batch.map((r) => BigInt(Math.min(Math.max(r.trustScore, 0), 100)))
    const reviewCounts = batch.map((r) => BigInt(r.totalJobs))
    // avgRating: convert completionRate (0-1) to stars*100 (0-500)
    const avgRatings = batch.map((r) =>
      BigInt(Math.round(Math.min(r.completionRate, 1) * 500))
    )
    const dataSource = DATA_SOURCE_MAP[batch[0].dataSource] ?? 2

    try {
      if (batch.length === 1) {
        // Single update
        const hash = await walletClient.writeContract({
          address: ORACLE_ADDRESS,
          abi: BATCH_UPDATE_ABI,
          functionName: 'updateTokenScore',
          args: [tokens[0], scores[0], reviewCounts[0], avgRatings[0], dataSource],
        })
        await publicClient.waitForTransactionReceipt({ hash })
        txHashes.push(hash)
        console.log(`[oracle-updater] Updated ${tokens[0]} score=${scores[0]} tx=${hash}`)
      } else {
        // Batch update
        const hash = await walletClient.writeContract({
          address: ORACLE_ADDRESS,
          abi: BATCH_UPDATE_ABI,
          functionName: 'batchUpdateTokenScores',
          args: [tokens, scores, reviewCounts, avgRatings, dataSource],
        })
        await publicClient.waitForTransactionReceipt({ hash })
        txHashes.push(hash)
        console.log(
          `[oracle-updater] Batch updated ${batch.length} scores tx=${hash}`
        )
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[oracle-updater] Batch failed:`, msg)
      errors.push(msg)
    }
  }

  // Update sync timestamp on success
  if (txHashes.length > 0) {
    lastSyncTime = new Date()
  }

  return {
    synced: records.length - (errors.length > 0 ? BATCH_SIZE : 0),
    txHashes,
    errors,
  }
}
