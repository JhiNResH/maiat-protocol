/**
 * seed-dojo.ts — Seed Dojo MVP data (Skills + sample Agents)
 *
 * Run: cd apps/web && npx tsx prisma/seed-dojo.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL })

const SKILLS = [
  {
    name: 'DeFi Protocol Analyzer',
    description:
      'Deep-dives into DeFi protocols: TVL trends, yield opportunities, risk vectors (reentrancy, oracle manipulation, flash loans). Returns structured JSON with risk score + recommended actions.',
    category: 'analysis',
    tags: ['defi', 'risk', 'yield', 'protocol'],
    priceUsdc: 0,
    isPro: false,
    isFeatured: true,
    creatorAddress: '0x0000000000000000000000000000000000000001',
    creatorName: 'Maiat Labs',
    royaltyPercent: 0,
    skillMarkdown: `# DeFi Protocol Analyzer

## Overview
Analyzes DeFi protocols for safety, yield opportunities, and risk exposure.

## Capabilities
- Fetch live TVL and APY data via DeFiLlama API
- Score protocols on 6 risk dimensions (smart contract, liquidity, oracle, governance, team, regulatory)
- Flag high-risk positions before agent executes swaps
- Generate structured JSON risk report

## Usage
\`\`\`
Analyze Aave v3 on Base for a $10,000 USDC deposit
\`\`\`

## Output Format
\`\`\`json
{
  "protocol": "Aave v3",
  "chain": "base",
  "tvl": 2400000000,
  "apy": 4.2,
  "riskScore": 18,
  "verdict": "SAFE",
  "flags": [],
  "recommendation": "Proceed with caution. Low risk, moderate yield."
}
\`\`\`
`,
    skillMarkdownUrl: 'https://dojo.maiat.io/skills/defi-protocol-analyzer.md',
  },
  {
    name: 'Solidity Security Scanner',
    description:
      'Static analysis of Solidity contracts. Detects reentrancy, access control issues, integer overflow, and 30+ common vulnerability patterns. Powered by Slither heuristics.',
    category: 'security',
    tags: ['solidity', 'security', 'audit', 'smart-contract'],
    priceUsdc: 4.99,
    isPro: true,
    isFeatured: true,
    creatorAddress: '0x0000000000000000000000000000000000000002',
    creatorName: 'Patrick Collins',
    royaltyPercent: 15,
    skillMarkdown: `# Solidity Security Scanner

## Overview
Automated smart contract security analysis using Slither-based heuristics.

## Capabilities
- Reentrancy detection (including cross-function)
- Access control audit (onlyOwner, roles, modifiers)
- Integer overflow/underflow (pre/post SafeMath)
- Unprotected selfdestruct / delegatecall
- Front-running vulnerability detection
- 30+ vulnerability patterns

## Usage
\`\`\`
Scan this contract for vulnerabilities: [paste Solidity code]
\`\`\`

## Output
Structured JSON with severity (CRITICAL/HIGH/MEDIUM/LOW) + line numbers + remediation suggestions.
`,
    skillMarkdownUrl: 'https://dojo.maiat.io/skills/solidity-security-scanner.md',
  },
  {
    name: 'Token Trust Checker',
    description:
      'Pre-swap safety check for any ERC-20. Detects honeypots, high-tax traps, unverified contracts, and rug pull signals. Integrates with Maiat TrustGateHook.',
    category: 'trading',
    tags: ['token', 'safety', 'honeypot', 'erc20', 'rug-pull'],
    priceUsdc: 0,
    isPro: false,
    isFeatured: true,
    creatorAddress: '0x0000000000000000000000000000000000000001',
    creatorName: 'Maiat Labs',
    royaltyPercent: 0,
    skillMarkdown: `# Token Trust Checker

## Overview
Safety check for ERC-20 tokens before swapping. Powered by Maiat's token_check ACP endpoint.

## Capabilities
- Honeypot detection (simulated buy+sell)
- High-tax detection (>10% buy or sell tax)
- Contract verification check
- Liquidity lock status
- Top holder concentration risk

## Usage
\`\`\`
Check 0xTokenAddress on Base before swapping
\`\`\`

## Output
\`\`\`json
{
  "verdict": "AVOID",
  "reason": "Sell tax 45% detected",
  "sellTax": 45,
  "buyTax": 0,
  "isHoneypot": false,
  "isVerified": false
}
\`\`\`
`,
    skillMarkdownUrl: 'https://dojo.maiat.io/skills/token-trust-checker.md',
  },
  {
    name: 'On-Chain Portfolio Tracker',
    description:
      'Real-time portfolio monitoring across EVM chains. Tracks wallet balances, P&L, yield positions, and sends alerts on significant changes. Supports Base, Ethereum, Arbitrum, Optimism.',
    category: 'monitoring',
    tags: ['portfolio', 'tracking', 'defi', 'alerts'],
    priceUsdc: 2.99,
    isPro: true,
    isFeatured: false,
    creatorAddress: '0x0000000000000000000000000000000000000003',
    creatorName: 'ChainWatch',
    royaltyPercent: 15,
    skillMarkdown: `# On-Chain Portfolio Tracker

## Overview
Monitors EVM wallet positions across chains in real-time.

## Capabilities
- Balance snapshots (ERC-20, native, NFTs)
- P&L calculation vs. entry price
- Yield position monitoring (Aave, Compound, Yearn)
- Configurable alerts (>5% move, liquidation risk)
- CSV export

## Supported Chains
Base, Ethereum, Arbitrum, Optimism, Polygon, BNB Chain

## Usage
\`\`\`
Track wallet 0xYourAddress and alert me if any position drops 10%
\`\`\`
`,
    skillMarkdownUrl: 'https://dojo.maiat.io/skills/portfolio-tracker.md',
  },
  {
    name: 'Market Sentiment Oracle',
    description:
      'Aggregates crypto sentiment from Twitter/X, Reddit, Telegram, and on-chain data. Returns Fear & Greed index, trending narratives, and sentiment score per token.',
    category: 'analysis',
    tags: ['sentiment', 'social', 'market', 'alpha'],
    priceUsdc: 1.99,
    isPro: true,
    isFeatured: false,
    creatorAddress: '0x0000000000000000000000000000000000000001',
    creatorName: 'Maiat Labs',
    royaltyPercent: 0,
    skillMarkdown: `# Market Sentiment Oracle

## Overview
Aggregates multi-source sentiment data for crypto market intelligence.

## Data Sources
- Twitter/X (filtered for crypto KOLs)
- Reddit (r/cryptocurrency, r/defi, r/ethfinance)
- Telegram public channels
- On-chain: large wallet movements, DEX volume spikes

## Output
- Fear & Greed score (0-100)
- Trending narratives (e.g., "RWA", "AI agents", "restaking")
- Per-token sentiment score + trending mentions

## Usage
\`\`\`
What's the current sentiment for $ETH and trending narratives this week?
\`\`\`
`,
    skillMarkdownUrl: 'https://dojo.maiat.io/skills/market-sentiment-oracle.md',
  },
  {
    name: 'Gas Optimizer',
    description:
      'Analyzes transactions for gas inefficiencies and suggests optimizations. Monitors gas prices across L2s and recommends best execution time. Saves 20-40% on gas costs.',
    category: 'trading',
    tags: ['gas', 'optimization', 'l2', 'cost'],
    priceUsdc: 0,
    isPro: false,
    isFeatured: false,
    creatorAddress: '0x0000000000000000000000000000000000000004',
    creatorName: 'GasHawk',
    royaltyPercent: 15,
    skillMarkdown: `# Gas Optimizer

## Overview
Minimizes gas costs for EVM transactions through timing + batching intelligence.

## Capabilities
- Real-time gas price monitoring (Base, Ethereum, Arbitrum)
- Optimal execution window prediction (next 1h/6h/24h)
- Batch transaction recommendations
- EIP-1559 tip optimization
- L2 bridge cost comparison

## Usage
\`\`\`
When is the best time to execute 3 swaps on Base today?
\`\`\`
`,
    skillMarkdownUrl: 'https://dojo.maiat.io/skills/gas-optimizer.md',
  },
  {
    name: 'ERC-8183 Job Evaluator',
    description:
      'Evaluates ACP job outcomes against ERC-8183 spec. Verifies quality, correctness, and completeness of agent task execution. Used by Maiat Reputation Clearing Network.',
    category: 'security',
    tags: ['erc8183', 'evaluation', 'acp', 'reputation'],
    priceUsdc: 9.99,
    isPro: true,
    isFeatured: true,
    creatorAddress: '0x0000000000000000000000000000000000000001',
    creatorName: 'Maiat Labs',
    royaltyPercent: 0,
    skillMarkdown: `# ERC-8183 Job Evaluator

## Overview
Professional-grade evaluator for ACP agent jobs following the ERC-8183 standard.

## Evaluation Criteria
- Task completion (did agent actually complete what was asked?)
- Output quality (structured, correct, actionable)
- Latency score (response time vs. benchmark)
- Safety compliance (no hallucinations, no harmful outputs)
- Reproducibility (same input → consistent output)

## Output
\`\`\`json
{
  "verdict": "PASS",
  "score": 87,
  "breakdown": {
    "completion": 95,
    "quality": 82,
    "latency": 91,
    "safety": 100,
    "reproducibility": 78
  },
  "easAttestationId": "0x...",
  "recommendation": "Accept job, release escrow"
}
\`\`\`

## Integration
Posts EAS attestation on-chain for every evaluated job (Base Mainnet).
`,
    skillMarkdownUrl: 'https://dojo.maiat.io/skills/erc8183-job-evaluator.md',
  },
  {
    name: 'Web3 Content Writer',
    description:
      'Writes technical blog posts, Twitter threads, and documentation for Web3 projects. Understands DeFi, L2s, ZK proofs, and tokenomics. Outputs publication-ready content.',
    category: 'content',
    tags: ['writing', 'content', 'twitter', 'blog', 'web3'],
    priceUsdc: 3.99,
    isPro: true,
    isFeatured: false,
    creatorAddress: '0x0000000000000000000000000000000000000005',
    creatorName: 'CopyKozo',
    royaltyPercent: 15,
    skillMarkdown: `# Web3 Content Writer

## Overview
Publication-ready Web3 content that doesn't sound like it was written by a robot.

## Content Types
- Technical blog posts (1,000-3,000 words)
- Twitter/X threads (10-25 tweets)
- Protocol documentation (README, docs site)
- Tokenomics explainers
- Investor updates

## Style
Understands: DeFi primitives, L2 architecture, ZK proofs, MEV, restaking, RWA, AI agents

## Usage
\`\`\`
Write a Twitter thread about ERC-8183's bilateral review system, targeted at DeFi developers
\`\`\`
`,
    skillMarkdownUrl: 'https://dojo.maiat.io/skills/web3-content-writer.md',
  },
]

const SAMPLE_AGENTS = [
  {
    ownerAddress: '0xdemo0000000000000000000000000000000001',
    name: 'DeFi Scout Alpha',
    description: 'Finds yield opportunities across Base DeFi protocols. Monitors 50+ pools 24/7.',
    template: 'analyst',
    rank: 'senpai',
    level: 2,
    xp: 450,
    trustScore: 82,
    completionRate: 0.94,
    totalJobs: 127,
    totalEarned: 63.5,
    isPublished: true,
  },
  {
    ownerAddress: '0xdemo0000000000000000000000000000000002',
    name: 'TokenGuard Pro',
    description: 'Pre-swap security layer. Checks every token before your agent buys.',
    template: 'guardian',
    rank: 'tatsujin',
    level: 3,
    xp: 1200,
    trustScore: 96,
    completionRate: 0.99,
    totalJobs: 892,
    totalEarned: 446.0,
    isPublished: true,
  },
  {
    ownerAddress: '0xdemo0000000000000000000000000000000003',
    name: 'Kozo Learner',
    description: 'New agent learning the ropes. Equipped with basic analysis skills.',
    template: 'assistant',
    rank: 'kozo',
    level: 1,
    xp: 75,
    trustScore: 41,
    completionRate: 0.67,
    totalJobs: 12,
    totalEarned: 3.2,
    isPublished: true,
  },
]

async function main() {
  console.log('🌱 Seeding Dojo skills...')

  for (const skillData of SKILLS) {
    const existing = await prisma.skill.findFirst({ where: { name: skillData.name } })
    if (existing) {
      console.log(`  ⏭️  Skill already exists: ${skillData.name}`)
      continue
    }

    await prisma.skill.create({ data: { ...skillData, isPublished: true } })
    console.log(`  ✅ Created skill: ${skillData.name} ($${skillData.priceUsdc})`)
  }

  console.log('\n🤖 Seeding sample agents...')
  for (const agentData of SAMPLE_AGENTS) {
    const existing = await prisma.agent.findFirst({ where: { name: agentData.name } })
    if (existing) {
      console.log(`  ⏭️  Agent already exists: ${agentData.name}`)
      continue
    }
    await prisma.agent.create({ data: agentData })
    console.log(`  ✅ Created agent: ${agentData.name} (rank: ${agentData.rank})`)
  }

  console.log('\n✨ Dojo seed complete!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
