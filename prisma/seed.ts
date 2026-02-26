/**
 * Maiat Seed: Virtuals Protocol AI Agents + DeFi Protocols
 * 
 * Top 10 hottest Virtuals agents from agdp.io leaderboard
 * + Major DeFi protocols for the m/defi category
 * 
 * Updated: 2026-02-17 (ETHDenver prep)
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface ProjectSeed {
  name: string
  slug: string
  symbol?: string
  address: string
  description: string
  image?: string
  website?: string
  category: string
  chain: string
  status: string
  avgRating: number
  reviewCount: number
}

// ═══════════════════════════════════════════
// 🤖 TOP 10 VIRTUALS AI AGENTS (by popularity)
// ═══════════════════════════════════════════
const aiAgents: ProjectSeed[] = [
  {
    name: 'AIXBT',
    slug: 'aixbt',
    symbol: 'AIXBT',
    address: '0x4F9Fd6Be4a90f2620860d680c0d4d5Fb53d1A825',
    description: 'AI market intelligence agent monitoring 400+ crypto KOLs. Generates real-time alpha signals, sentiment analysis, and trend detection. Peaked at $500M market cap. The on-chain Bloomberg terminal.',
    image: '/icons/stocks.png',
    website: 'https://app.virtuals.io/virtuals/aixbt',
    category: 'm/ai-agents',
    chain: 'Base',
    status: 'active',
    avgRating: 4.7,
    reviewCount: 0,
  },
  {
    name: 'Luna',
    slug: 'luna',
    symbol: 'LUNA',
    address: '0x55cD6469F597452B5A7536e2CD98fDE4c1247ee4',
    description: '24/7 AI livestreamer and virtual idol with 500K+ TikTok followers. First autonomous AI entertainer on Virtuals Protocol. Generates revenue through donations and agent commerce.',
    image: '/icons/star.png',
    website: 'https://app.virtuals.io/virtuals/luna',
    category: 'm/ai-agents',
    chain: 'Base',
    status: 'active',
    avgRating: 4.5,
    reviewCount: 0,
  },
  {
    name: 'G.A.M.E',
    slug: 'game',
    address: '0x1C4cCa7C5Db003824208aDDa61Bd749E55F463A3',
    description: 'Virtuals Protocol core agent framework. Enables developers to build, deploy, and monetize autonomous AI agents. Powers the entire Virtuals ecosystem with configurable agent behaviors.',
    image: '/icons/controller.png',
    website: 'https://docs.game.virtuals.io',
    category: 'm/ai-agents',
    chain: 'Base',
    status: 'active',
    avgRating: 4.6,
    reviewCount: 0,
  },
  {
    name: 'VaderAI',
    slug: 'vaderai',
    address: '0x731814e491571A2e9eE3c5b1F7f3b962eE8f4870',
    description: 'Autonomous DeFi trading agent. Executes strategies across DEXs, analyzes on-chain data, and manages portfolio allocation. One of the earliest revenue-generating agents on Virtuals.',
    image: '/icons/ninja-head.png',
    website: 'https://app.virtuals.io/virtuals/vader',
    category: 'm/ai-agents',
    chain: 'Base',
    status: 'active',
    avgRating: 4.3,
    reviewCount: 0,
  },
]

// ═══════════════════════════════════════════
// 🐸 MEMECOINS
// ═══════════════════════════════════════════
const memecoins: ProjectSeed[] = [
  {
    name: 'Hey Anon',
    slug: 'anon',
    symbol: 'ANON',
    address: '0xeeb131aa97b8e09c7ae2d98aa1ff801ef35c9f11',
    description: 'HeyAnon is an AI DeFi protocol crossed with memetic culture that simplifies on-chain interactions via natural language.',
    image: '/icons/ninja-head.png',
    website: 'https://heyanon.ai',
    category: 'Token',
    chain: 'Base',
    status: 'active',
    avgRating: 4.2,
    reviewCount: 0,
  }
]

// ═══════════════════════════════════════════
// 🏦 DEFI PROTOCOLS (Multi-chain)
// ═══════════════════════════════════════════
const defiProtocols: ProjectSeed[] = [
  {
    name: 'Uniswap',
    slug: 'uniswap',
    address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
    description: 'Leading decentralized exchange on Ethereum. Automated market maker with concentrated liquidity (v3/v4).',
    image: '/icons/uniswap.png',
    website: 'https://uniswap.org',
    category: 'm/defi',
    chain: 'Ethereum',
    status: 'active',
    avgRating: 4.7,
    reviewCount: 0,
  },
  {
    name: 'Aave V3',
    slug: 'aave-v3',
    symbol: 'AAVE',
    address: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
    description: 'The leading decentralized lending protocol. Supply assets to earn yield, borrow against collateral. V3 features efficiency mode and multi-chain deployment.',
    website: 'https://aave.com',
    category: 'm/defi',
    chain: 'Ethereum',
    status: 'active',
    avgRating: 4.8,
    reviewCount: 0,
  },
  {
    name: 'PancakeSwap',
    slug: 'pancakeswap',
    symbol: 'CAKE',
    address: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
    description: 'Largest DEX on BNB Chain. AMM with farming, lottery, and prediction markets.',
    image: '/icons/pancakeswap.png',
    website: 'https://pancakeswap.finance',
    category: 'm/defi',
    chain: 'BNB',
    status: 'active',
    avgRating: 4.3,
    reviewCount: 0,
  },
  {
    name: 'Lido',
    slug: 'lido',
    symbol: 'LDO',
    address: '0xae7ab96520de3a18e5e111b5eaab095312d7fe84',
    description: 'Liquid staking for digital assets. Stake your ETH and use it across DeFi.',
    website: 'https://lido.fi',
    category: 'm/defi',
    chain: 'Ethereum',
    status: 'active',
    avgRating: 4.6,
    reviewCount: 0,
  },
]

// ═══════════════════════════════════════════
// 👤 SEED USERS (for reviews)
// ═══════════════════════════════════════════
const seedUsers = [
  { address: '0xd3ad...b33f', displayName: 'DeFi_Degen_42' },
  { address: '0xc0ff...ee00', displayName: 'AgentMaxi' },
  { address: '0xbeef...cafe', displayName: 'VirtualsOG' },
  { address: '0xface...d00d', displayName: 'BaseBuilder' },
  { address: '0xdead...0001', displayName: 'CryptoReviewer' },
]

async function main() {
  console.log('🌱 Seeding Maiat with Multi-chain AI Agents & DeFi data...\n')

  // Clear existing data
  console.log('🗑️  Clearing old data...')
  await prisma.vote.deleteMany({})
  await prisma.review.deleteMany({})
  await prisma.project.deleteMany({})
  await prisma.user.deleteMany({})
  console.log('   Done.\n')

  // Seed Users
  console.log('👤 Creating seed users...')
  const createdUsers = []
  for (const u of seedUsers) {
    const user = await prisma.user.create({
      data: { address: u.address, displayName: u.displayName, reputationScore: Math.floor(Math.random() * 500) + 100 }
    })
    createdUsers.push(user)
    console.log(`   ✅ ${u.displayName}`)
  }

  // Combine projects
  const allProjects = [...aiAgents, ...memecoins, ...defiProtocols]

  // Seed Projects
  console.log('\n🚀 Seeding Multi-chain Projects...')
  const projectMap: Record<string, string> = {}
  for (const project of allProjects) {
    const p = await prisma.project.create({ data: project })
    projectMap[project.address] = p.id
    console.log(`   [${project.chain}] 🟢 ${project.name} (${project.slug})`)
  }

  console.log(`\n✅ Seed complete!`)
  console.log(`   📦 Total Projects: ${allProjects.length}`)
  console.log(`   👤 Total Users: ${seedUsers.length}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
