/**
 * Sync ERC-8004 via 8004scan API — match by agent name to our DB.
 * 
 * 8004scan has agent_wallet + name. Our DB has walletAddress + name (in rawMetrics).
 * Match by lowercased name since wallet addresses differ.
 * 
 * Run: npx tsx scripts/sync-8004-v2.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BASE_URL = 'https://www.8004scan.io/api/v1/agents'
const CHAIN_ID = 8453
const PAGE_SIZE = 100
const DELAY_MS = 2000 // be nice to their API

async function fetchPage(offset: number): Promise<{ items: any[]; total: number } | null> {
  const url = `${BASE_URL}?chain_id=${CHAIN_ID}&limit=${PAGE_SIZE}&offset=${offset}`
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function main() {
  console.log('🔄 Syncing ERC-8004 from 8004scan API...')

  // 1. Build name→walletAddress map from our DB
  const agents = await prisma.agentScore.findMany({
    select: { walletAddress: true, rawMetrics: true },
  })

  const nameToWallet = new Map<string, string>() // lowercase name → walletAddress
  const walletSet = new Set<string>()
  for (const a of agents) {
    const raw = a.rawMetrics as any
    const name = raw?.name as string | undefined
    if (name) {
      nameToWallet.set(name.toLowerCase().trim(), a.walletAddress.toLowerCase())
    }
    walletSet.add(a.walletAddress.toLowerCase())
  }
  console.log(`📊 ${agents.length} agents in DB, ${nameToWallet.size} with names`)

  // 2. Paginate 8004scan API
  let offset = 0
  let total = 0
  let matched = 0
  let matchedByWallet = 0
  const matchedAddresses = new Set<string>()

  // First page to get total
  const first = await fetchPage(0)
  if (!first) {
    console.error('❌ Cannot reach 8004scan API')
    return
  }
  total = first.total
  console.log(`🔍 Total agents on 8004scan: ${total}`)

  // Process all pages
  while (offset < total) {
    const page = offset === 0 ? first : await fetchPage(offset)
    if (!page || !page.items?.length) {
      console.log(`  ⚠️ Page at offset ${offset} failed, skipping`)
      offset += PAGE_SIZE
      await sleep(DELAY_MS)
      continue
    }

    for (const item of page.items) {
      const tokenId = parseInt(item.token_id)
      const ownerAddr = (item.owner_address || '').toLowerCase()
      const agentWallet = (item.agent_wallet || '').toLowerCase()
      const name = (item.name || '').toLowerCase().trim()

      // Try match by wallet first
      let dbWallet: string | undefined
      if (walletSet.has(ownerAddr)) {
        dbWallet = ownerAddr
        matchedByWallet++
      } else if (walletSet.has(agentWallet)) {
        dbWallet = agentWallet
        matchedByWallet++
      } else if (name && nameToWallet.has(name)) {
        dbWallet = nameToWallet.get(name)
      }

      if (dbWallet && !matchedAddresses.has(dbWallet)) {
        matchedAddresses.add(dbWallet)
        matched++
        await prisma.agentScore.updateMany({
          where: { walletAddress: dbWallet },
          data: { has8004: true, erc8004Id: tokenId },
        })
      }
    }

    process.stdout.write(`  Processed ${Math.min(offset + PAGE_SIZE, total)}/${total} (matched: ${matched})\r`)
    offset += PAGE_SIZE
    if (offset < total) await sleep(DELAY_MS)
  }

  // 3. Reset non-matched agents
  const resetResult = await prisma.agentScore.updateMany({
    where: {
      has8004: true,
      walletAddress: { notIn: [...matchedAddresses] },
    },
    data: { has8004: false, erc8004Id: null },
  })

  console.log(`\n\n📋 Results:`)
  console.log(`  Total on 8004scan: ${total}`)
  console.log(`  Matched to our DB: ${matched} (${matchedByWallet} by wallet, ${matched - matchedByWallet} by name)`)
  console.log(`  Reset stale 8004 flags: ${resetResult.count}`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
