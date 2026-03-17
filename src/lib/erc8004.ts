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

// RPC endpoints in priority order — publicnode most reliable, Alchemy if available
const ALCHEMY_BASE_RPC = process.env.ALCHEMY_BASE_RPC || null;
const RPC_URLS = [
  ...(ALCHEMY_BASE_RPC ? [ALCHEMY_BASE_RPC] : []),
  'https://base-rpc.publicnode.com',
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
// Type alias for ERC-8004 data result
export type ERC8004Data = Awaited<ReturnType<typeof getERC8004Data>> | null;

// ─── Write Operations (requires admin wallet) ────────────────────────────────

// ERC-8004 Identity Registry ABI (standard)
const IDENTITY_REGISTRY_WRITE_ABI = [
  {
    name: 'register',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'agentURI', type: 'string' }],
    outputs: [{ name: 'agentId', type: 'uint256' }],
  },
] as const

/**
 * Register an agent in the official ERC-8004 IdentityRegistry.
 * Uses Privy server wallet API with gas sponsorship (paymaster).
 * Agent's own wallet calls register() as msg.sender — zero gas cost.
 * Returns the new agentId on success, or null if already registered.
 */
export async function registerAgent(
  walletAddress: string,
  privyWalletId?: string,
): Promise<bigint | null> {
  const { getAddress, encodeFunctionData } = await import('viem')
  const { base: baseChain } = await import('viem/chains')

  const checksummedAddress = getAddress(walletAddress)
  const agentURI = `https://app.maiat.io/agent/${checksummedAddress}`

  if (!privyWalletId) {
    console.log(`[erc8004] no privyWalletId for ${checksummedAddress}, skipping on-chain register`)
    return null
  }

  // Encode register(string agentURI) calldata
  const calldata = encodeFunctionData({
    abi: IDENTITY_REGISTRY_WRITE_ABI,
    functionName: 'register',
    args: [agentURI],
  })

  // Use Privy server wallet with gas sponsorship (paymaster)
  try {
    const { PrivyClient } = await import('@privy-io/server-auth')
    const privy = new PrivyClient(
      process.env.PRIVY_APP_ID!,
      process.env.PRIVY_APP_SECRET!,
    )

    // ERC-01: Detect if Privy sponsorship is configured before sending
    // sponsor: true will fail silently if Privy Dashboard sponsorship is not enabled for Base (8453)
    const { hash: txHash } = await privy.walletApi.ethereum.sendTransaction({
      walletId: privyWalletId,
      caip2: 'eip155:8453', // Base mainnet
      transaction: {
        to: IDENTITY_REGISTRY,
        data: calldata,
      },
      sponsor: true, // Requires Privy Dashboard: Gas Sponsorship → Base (8453) enabled
    }).catch((sponsorErr: any) => {
      // ERC-01: If sponsorship fails, surface a clear error instead of silent null
      const msg = sponsorErr?.message || String(sponsorErr)
      if (msg.includes('sponsor') || msg.includes('paymaster') || msg.includes('gas')) {
        throw new Error(`[erc8004] Privy gas sponsorship not configured for Base. Enable in Privy Dashboard → Policies → Gas Sponsorship → Add chain 8453. Error: ${msg}`)
      }
      throw sponsorErr
    })

    console.log(`[erc8004] ✅ register tx sent via Privy (sponsored): ${txHash} for ${checksummedAddress}`)

    // Wait for receipt and extract agentId from Registered event
    const publicClient = createPublicClient({ chain: baseChain, transport: http(RPC_URLS[0]) })
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash as `0x${string}`,
      timeout: 15000,
    })

    for (const log of receipt.logs) {
      try {
        const decoded = publicClient.decodeEventLog({
          abi: [registeredEvent],
          data: log.data,
          topics: log.topics,
        }) as { agentId: bigint }
        if (decoded?.agentId !== undefined) {
          agentIdCache.set(checksummedAddress.toLowerCase(), decoded.agentId)
          console.log(`[erc8004] ✅ agentId from receipt: ${decoded.agentId}`)
          return decoded.agentId
        }
      } catch {}
    }

    return BigInt(-1) // tx confirmed but couldn't parse agentId
  } catch (txErr: any) {
    const errMsg = txErr.shortMessage || txErr.message || ''
    if (errMsg.includes('revert') || errMsg.includes('already')) {
      console.log(`[erc8004] agent ${checksummedAddress} likely already registered (${errMsg})`)
      return null
    }
    console.error(`[erc8004] register tx failed:`, errMsg)
    return null // Don't throw — non-blocking for passport flow
  }
}

/**
 * Get or generate a KYA (Know Your Agent) code for a wallet address.
 * Uses the agentId as a seed if available, otherwise generates locally.
 */
export async function getKYACode(walletAddress: string): Promise<string> {
  const KYA_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I

  try {
    const agentId = await lookupAgentId(walletAddress)
    if (agentId !== null) {
      // Deterministic KYA code from agentId
      let id = Number(agentId)
      let code = ''
      for (let i = 0; i < 4; i++) {
        code += KYA_CHARS[id % KYA_CHARS.length]
        id = Math.floor(id / KYA_CHARS.length)
      }
      return `MAIAT-${code}`
    }
  } catch {
    // Fall through to random generation
  }

  // Fallback: generate from address bytes
  const bytes = Buffer.from(walletAddress.replace('0x', '').slice(0, 8), 'hex')
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += KYA_CHARS[(bytes[i] ?? Math.floor(Math.random() * KYA_CHARS.length)) % KYA_CHARS.length]
  }
  return `MAIAT-${code}`
}

/**
 * Get the numeric agentId for a wallet address (0 if not registered).
 * Returns null if lookup fails.
 */
export async function getAgentId(walletAddress: string): Promise<number | null> {
  try {
    const agentId = await lookupAgentId(walletAddress)
    return agentId !== null ? Number(agentId) : null
  } catch {
    return null
  }
}
