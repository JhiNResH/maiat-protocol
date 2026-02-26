/**
 * Maiat Seed — Multi-chain AI Agents + DeFi
 * 20 verified on-chain addresses across Base, Ethereum, BNB
 * Updated: 2026-02-26
 */

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const projects = [
  // ── Base: AI Agents ────────────────────────────────────────────────
  {
    name: 'AIXBT', slug: 'aixbt', symbol: 'AIXBT',
    address: '0x4F9Fd6Be4a90f2620860d680c0d4d5Fb53d1A825',
    description: 'AI market intelligence agent monitoring 400+ crypto KOLs. Generates real-time alpha signals and sentiment analysis. Peaked at $500M market cap.',
    website: 'https://app.virtuals.io/virtuals/1199',
    category: 'm/ai-agents', chain: 'Base', status: 'active', avgRating: 4.7, reviewCount: 0,
  },
  {
    name: 'Luna', slug: 'luna', symbol: 'LUNA',
    address: '0x55cD6469F597452B5A7536e2CD98fDE4c1247ee4',
    description: '24/7 AI livestreamer and virtual idol with 500K+ TikTok followers. First autonomous AI entertainer on Virtuals Protocol.',
    website: 'https://app.virtuals.io/virtuals/luna',
    category: 'm/ai-agents', chain: 'Base', status: 'active', avgRating: 4.5, reviewCount: 0,
  },
  {
    name: 'G.A.M.E', slug: 'game', symbol: 'GAME',
    address: '0x1C4cCa7C5Db003824208aDDa61Bd749E55F463A3',
    description: 'Virtuals Protocol core agent framework. Enables developers to build, deploy, and monetize autonomous AI agents.',
    website: 'https://docs.game.virtuals.io',
    category: 'm/ai-agents', chain: 'Base', status: 'active', avgRating: 4.6, reviewCount: 0,
  },
  {
    name: 'VaderAI', slug: 'vaderai', symbol: 'VADER',
    address: '0x731814e491571A2e9eE3c5b1F7f3b962eE8f4870',
    description: 'Autonomous DeFi trading agent. Executes strategies across DEXs, manages portfolio allocation. One of the earliest revenue-generating agents.',
    website: 'https://app.virtuals.io/virtuals/vader',
    category: 'm/ai-agents', chain: 'Base', status: 'active', avgRating: 4.3, reviewCount: 0,
  },
  {
    name: 'Freysa', slug: 'freysa', symbol: 'FAI',
    address: '0xb33ff54b9f7242ef1593d2c9bcd8f9df46c77935',
    description: 'Autonomous AI agent that controls a crypto wallet and cannot be persuaded to send funds. Game-theory experiment spawned a cultural phenomenon.',
    website: 'https://freysa.ai',
    category: 'm/ai-agents', chain: 'Base', status: 'active', avgRating: 4.2, reviewCount: 0,
  },
  {
    name: 'Virtuals Protocol', slug: 'virtual', symbol: 'VIRTUAL',
    address: '0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b',
    description: 'The launchpad for tokenized AI agents. Enables anyone to create, co-own, and deploy AI agents with on-chain revenue sharing.',
    website: 'https://app.virtuals.io',
    category: 'm/ai-agents', chain: 'Base', status: 'active', avgRating: 4.8, reviewCount: 0,
  },
  {
    name: 'Hey Anon', slug: 'anon', symbol: 'ANON',
    address: '0xeeb131aa97b8e09c7ae2d98aa1ff801ef35c9f11',
    description: 'AI DeFi protocol that simplifies on-chain interactions via natural language. Ask it to swap, bridge, or stake in plain English.',
    website: 'https://heyanon.ai',
    category: 'm/ai-agents', chain: 'Base', status: 'active', avgRating: 4.2, reviewCount: 0,
  },

  // ── Base: DeFi ─────────────────────────────────────────────────────
  {
    name: 'Aerodrome', slug: 'aerodrome', symbol: 'AERO',
    address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
    description: 'Base native DEX and liquidity hub. Built on Velodrome V2 architecture. Dominant trading volume on Base.',
    website: 'https://aerodrome.finance',
    category: 'm/defi', chain: 'Base', status: 'active', avgRating: 4.6, reviewCount: 0,
  },
  {
    name: 'Base USDC', slug: 'base-usdc', symbol: 'USDC',
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    description: 'Native USDC on Base — Circle\'s stablecoin bridged and issued directly. The most liquid asset on Base.',
    website: 'https://www.circle.com/usdc',
    category: 'm/defi', chain: 'Base', status: 'active', avgRating: 4.9, reviewCount: 0,
  },
  {
    name: 'Wrapped ETH (Base)', slug: 'weth-base', symbol: 'WETH',
    address: '0x4200000000000000000000000000000000000006',
    description: 'Canonical WETH on Base. Used across all Base DeFi protocols as the primary ETH wrapper.',
    website: 'https://base.org',
    category: 'm/defi', chain: 'Base', status: 'active', avgRating: 4.8, reviewCount: 0,
  },

  // ── Ethereum: DeFi ────────────────────────────────────────────────
  {
    name: 'Uniswap', slug: 'uniswap', symbol: 'UNI',
    address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    description: 'Leading decentralized exchange. Automated market maker with concentrated liquidity (V3/V4). Largest DEX by volume.',
    website: 'https://uniswap.org',
    category: 'm/defi', chain: 'Ethereum', status: 'active', avgRating: 4.7, reviewCount: 0,
  },
  {
    name: 'Aave V3', slug: 'aave-v3', symbol: 'AAVE',
    address: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
    description: 'Leading decentralized lending protocol. Supply assets to earn yield, borrow against collateral. V3 features efficiency mode and cross-chain deployments.',
    website: 'https://aave.com',
    category: 'm/defi', chain: 'Ethereum', status: 'active', avgRating: 4.8, reviewCount: 0,
  },
  {
    name: 'Lido stETH', slug: 'lido', symbol: 'LDO',
    address: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
    description: 'Liquid staking for ETH. Stake ETH and receive stETH — a yield-bearing token usable across DeFi.',
    website: 'https://lido.fi',
    category: 'm/defi', chain: 'Ethereum', status: 'active', avgRating: 4.6, reviewCount: 0,
  },
  {
    name: 'Compound V3', slug: 'compound-v3', symbol: 'COMP',
    address: '0xc3d688B66703497DAA19211EEdff47f25384cdc3',
    description: 'Battle-tested lending protocol. Compound V3 (Comet) introduces a single borrowable asset model for capital efficiency.',
    website: 'https://compound.finance',
    category: 'm/defi', chain: 'Ethereum', status: 'active', avgRating: 4.5, reviewCount: 0,
  },
  {
    name: 'Chainlink', slug: 'chainlink', symbol: 'LINK',
    address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
    description: 'Decentralized oracle network. Powers price feeds, VRF, automation, and CCIP cross-chain messaging across 1000+ protocols.',
    website: 'https://chain.link',
    category: 'm/defi', chain: 'Ethereum', status: 'active', avgRating: 4.7, reviewCount: 0,
  },
  {
    name: 'MakerDAO', slug: 'makerdao', symbol: 'MKR',
    address: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2',
    description: 'Creator of DAI stablecoin. Decentralized governance manages collateral risk and stability fees across the Sky/Maker ecosystem.',
    website: 'https://makerdao.com',
    category: 'm/defi', chain: 'Ethereum', status: 'active', avgRating: 4.5, reviewCount: 0,
  },
  {
    name: 'Curve Finance', slug: 'curve', symbol: 'CRV',
    address: '0xD533a949740bb3306d119CC777fa900bA034cd52',
    description: 'Stablecoin and pegged-asset DEX. Designed for low-slippage swaps between similar assets. Backbone of DeFi liquidity.',
    website: 'https://curve.fi',
    category: 'm/defi', chain: 'Ethereum', status: 'active', avgRating: 4.4, reviewCount: 0,
  },

  // ── Ethereum: AI Agent Infrastructure ────────────────────────────
  {
    name: 'Autonolas', slug: 'autonolas', symbol: 'OLAS',
    address: '0x0001A500A6B18995B03f44bb040A5fFc28E45CB0',
    description: 'Decentralized protocol for creating and running autonomous AI agent services on-chain. Powers 1000+ live agents across DeFi and data markets.',
    website: 'https://olas.network',
    category: 'm/ai-agents', chain: 'Ethereum', status: 'active', avgRating: 4.5, reviewCount: 0,
  },
]

const seedUsers = [
  { address: '0xd3adbeef00000000000000000000000000b33f', displayName: 'DeFi_Degen_42' },
  { address: '0xc0ffee00000000000000000000000000ee0000', displayName: 'AgentMaxi' },
  { address: '0xbeefcafe000000000000000000000000cafe00', displayName: 'VirtualsOG' },
  { address: '0xfaced00d000000000000000000000000d00d00', displayName: 'BaseBuilder' },
  { address: '0xdead0001000000000000000000000000000001', displayName: 'CryptoReviewer' },
]

async function main() {
  console.log('🌱 Seeding Maiat — Base + Ethereum (18 projects)\n')

  await prisma.vote.deleteMany({})
  await prisma.review.deleteMany({})
  await prisma.project.deleteMany({})
  await prisma.user.deleteMany({})
  console.log('🗑️  Cleared old data\n')

  for (const u of seedUsers) {
    await prisma.user.create({ data: { address: u.address, displayName: u.displayName, reputationScore: Math.floor(Math.random() * 500) + 100 } })
    console.log(`   👤 ${u.displayName}`)
  }

  console.log('\n🚀 Seeding projects...')
  for (const p of projects) {
    await prisma.project.create({ data: p })
    console.log(`   [${p.chain}] ✅ ${p.name}`)
  }

  console.log(`\n✅ Done! ${projects.length} projects (BNB removed), ${seedUsers.length} users`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
