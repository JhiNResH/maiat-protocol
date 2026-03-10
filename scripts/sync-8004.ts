/**
 * Sync ERC-8004 registration status from on-chain events to AgentScore DB.
 * 
 * Strategy: Scan all Registered events from Identity Registry,
 * collect owner addresses, cross-reference with our AgentScore walletAddresses.
 * 
 * Run: npx tsx scripts/sync-8004.ts
 */

import { createPublicClient, http, parseAbiItem } from 'viem'
import { base } from 'viem/chains'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const IDENTITY_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as const
const DEPLOY_BLOCK = 41663783n
const CHUNK_SIZE = 9999n

const RPC_URLS = [
  'https://base.gateway.tenderly.co',
  'https://mainnet.base.org',
]

const registeredEvent = parseAbiItem(
  'event Registered(uint256 indexed agentId, string agentURI, address indexed owner)'
)

async function main() {
  console.log('🔄 Syncing ERC-8004 registrations...')

  // 1. Get all our agent wallet addresses
  const agents = await prisma.agentScore.findMany({
    select: { walletAddress: true },
  })
  const ourAddresses = new Set(agents.map(a => a.walletAddress.toLowerCase()))
  console.log(`📊 ${ourAddresses.size} agents in our DB`)

  // 2. Scan chain for all Registered events
  const registered = new Map<string, number>() // owner -> agentId

  for (const rpc of RPC_URLS) {
    try {
      const client = createPublicClient({
        chain: base,
        transport: http(rpc, { timeout: 30_000, retryCount: 2 }),
      })

      const currentBlock = await client.getBlockNumber()
      console.log(`🔍 Scanning blocks ${DEPLOY_BLOCK} → ${currentBlock} via ${rpc}`)

      for (let from = DEPLOY_BLOCK; from <= currentBlock; from += CHUNK_SIZE + 1n) {
        const to = from + CHUNK_SIZE > currentBlock ? currentBlock : from + CHUNK_SIZE

        try {
          const logs = await client.getLogs({
            address: IDENTITY_REGISTRY,
            event: registeredEvent,
            fromBlock: from,
            toBlock: to,
          })

          for (const log of logs) {
            const owner = (log.args.owner as string).toLowerCase()
            const agentId = Number(log.args.agentId as bigint)
            registered.set(owner, agentId)
          }

          if (Number(from - DEPLOY_BLOCK) % 50000n === 0) {
            process.stdout.write(`  Block ${from}... (${registered.size} found)\r`)
          }
        } catch (e) {
          // Skip chunk errors, continue
          console.warn(`  ⚠️ Chunk ${from}-${to} failed, skipping`)
        }
      }

      console.log(`\n✅ Found ${registered.size} total ERC-8004 registrations on-chain`)
      break // success, don't try next RPC
    } catch (e) {
      console.warn(`⚠️ RPC ${rpc} failed, trying next...`)
    }
  }

  // 3. Cross-reference: which of our agents are registered?
  let matched = 0
  let updated = 0

  for (const [owner, agentId] of registered) {
    if (ourAddresses.has(owner)) {
      matched++
      const result = await prisma.agentScore.updateMany({
        where: { walletAddress: owner },
        data: { has8004: true, erc8004Id: agentId },
      })
      if (result.count > 0) updated++
    }
  }

  // 4. Reset agents that are NOT registered (in case of deregistration)
  const registeredAddrs = [...registered.keys()]
  const notRegistered = [...ourAddresses].filter(a => !registered.has(a))
  if (notRegistered.length > 0) {
    await prisma.agentScore.updateMany({
      where: {
        walletAddress: { in: notRegistered },
        has8004: true,
      },
      data: { has8004: false, erc8004Id: null },
    })
  }

  console.log(`\n📋 Results:`)
  console.log(`  Total on-chain 8004 registrations: ${registered.size}`)
  console.log(`  Matched to our agents: ${matched}`)
  console.log(`  DB records updated: ${updated}`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
