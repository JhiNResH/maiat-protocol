/**
 * ERC-8004 On-Chain Identity & Reputation for AI Agents
 *
 * Contract addresses (Base Mainnet):
 * - IdentityRegistry: 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
 * - ReputationRegistry: 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63
 * - Deploy block: 41663783
 */

import { createPublicClient, http, parseAbiItem, type PublicClient } from 'viem'
import { base } from 'viem/chains'

// Contract addresses
const IDENTITY_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as const
const REPUTATION_REGISTRY = '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63' as const
const DEPLOY_BLOCK = 41663783n
const CHUNK_SIZE = 9999n

// RPC endpoints in priority order
const RPC_URLS = [
  'https://base.gateway.tenderly.co',
  'https://mainnet.base.org',
]

// Module-level caches
const agentIdCache = new Map<string, bigint>()
let ownerMapCache: { map: Map<string, bigint>; timestamp: number } | null = null
const OWNER_MAP_TTL = 5 * 60 * 1000 // 5 minutes

// Event signature
const registeredEvent = parseAbiItem(
  'event Registered(uint256 indexed agentId, string agentURI, address indexed owner)'
)

// Reputation registry ABI
const REPUTATION_ABI = [
  {
    name: 'getReputation',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [
      { name: 'count', type: 'uint256' },
      { name: 'value', type: 'int256' },
    ],
  },
  {
    name: 'getReputationNormalized',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

// Create client for a specific RPC
function createClient(rpcIndex = 0): PublicClient {
  return createPublicClient({
    chain: base,
    transport: http(RPC_URLS[rpcIndex], {
      timeout: 10_000,
      retryCount: 1,
    }),
  })
}

// Execute with RPC fallback
async function withFallback<T>(
  fn: (client: PublicClient) => Promise<T>
): Promise<T> {
  let lastError: Error | null = null
  for (let i = 0; i < RPC_URLS.length; i++) {
    try {
      const client = createClient(i)
      return await fn(client)
    } catch (e) {
      lastError = e as Error
    }
  }
  throw lastError
}

/**
 * Scan Registered events to find the agentId for a given wallet address.
 * Scans from deploy block in 9999-block chunks.
 */
export async function lookupAgentId(
  walletAddress: string
): Promise<bigint | null> {
  const normalizedAddress = walletAddress.toLowerCase()

  // Check cache first
  if (agentIdCache.has(normalizedAddress)) {
    return agentIdCache.get(normalizedAddress)!
  }

  return withFallback(async (client) => {
    const currentBlock = await client.getBlockNumber()

    for (let from = DEPLOY_BLOCK; from <= currentBlock; from += CHUNK_SIZE + 1n) {
      const to = from + CHUNK_SIZE > currentBlock ? currentBlock : from + CHUNK_SIZE

      const logs = await client.getLogs({
        address: IDENTITY_REGISTRY,
        event: registeredEvent,
        fromBlock: from,
        toBlock: to,
      })

      for (const log of logs) {
        const owner = (log.args.owner as string).toLowerCase()
        const agentId = log.args.agentId as bigint

        // Cache all found mappings
        agentIdCache.set(owner, agentId)

        if (owner === normalizedAddress) {
          return agentId
        }
      }
    }

    return null
  })
}

/**
 * Get reputation data for an agent by agentId.
 * Calls getReputation and getReputationNormalized on ReputationRegistry.
 */
export async function getAgentReputation(
  agentId: bigint
): Promise<{ count: number; normalizedScore: number } | null> {
  return withFallback(async (client) => {
    const [reputation, normalizedScore] = await Promise.all([
      client.readContract({
        address: REPUTATION_REGISTRY,
        abi: REPUTATION_ABI,
        functionName: 'getReputation',
        args: [agentId],
      }),
      client.readContract({
        address: REPUTATION_REGISTRY,
        abi: REPUTATION_ABI,
        functionName: 'getReputationNormalized',
        args: [agentId],
      }),
    ])

    const [count] = reputation as [bigint, bigint]

    return {
      count: Number(count),
      normalizedScore: Number(normalizedScore as bigint),
    }
  })
}

/**
 * Get combined ERC-8004 data for a wallet address.
 * Returns null on any error (non-blocking).
 */
export async function getERC8004Data(walletAddress: string): Promise<{
  registered: boolean
  agentId?: number
  reputation?: { count: number; normalizedScore: number }
} | null> {
  try {
    const agentId = await lookupAgentId(walletAddress)

    if (agentId === null) {
      return { registered: false }
    }

    const reputation = await getAgentReputation(agentId)

    return {
      registered: true,
      agentId: Number(agentId),
      reputation: reputation ?? undefined,
    }
  } catch {
    return null
  }
}

/**
 * Build a complete owner->agentId map by scanning ALL Registered events.
 * Cached for 5 minutes at module level.
 */
export async function buildOwnerMap(): Promise<Map<string, bigint>> {
  const now = Date.now()

  // Return cached map if still valid
  if (ownerMapCache && now - ownerMapCache.timestamp < OWNER_MAP_TTL) {
    return ownerMapCache.map
  }

  const map = new Map<string, bigint>()

  await withFallback(async (client) => {
    const currentBlock = await client.getBlockNumber()

    for (let from = DEPLOY_BLOCK; from <= currentBlock; from += CHUNK_SIZE + 1n) {
      const to = from + CHUNK_SIZE > currentBlock ? currentBlock : from + CHUNK_SIZE

      const logs = await client.getLogs({
        address: IDENTITY_REGISTRY,
        event: registeredEvent,
        fromBlock: from,
        toBlock: to,
      })

      for (const log of logs) {
        const owner = (log.args.owner as string).toLowerCase()
        const agentId = log.args.agentId as bigint
        map.set(owner, agentId)
        // Also populate the agentId cache
        agentIdCache.set(owner, agentId)
      }
    }
  })

  // Update cache
  ownerMapCache = { map, timestamp: now }

  return map
}

/**
 * Get all registered ERC-8004 agents as a Map<lowercaseAddress, agentId (number)>.
 * Convenience wrapper around buildOwnerMap() for bulk list enrichment.
 */
export async function getAllRegisteredAgents(): Promise<Map<string, number>> {
  const bigMap = await buildOwnerMap()
  const result = new Map<string, number>()
  for (const [addr, id] of bigMap) {
    result.set(addr, Number(id))
  }
  return result
}
