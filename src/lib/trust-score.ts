/**
 * Maiat Trust Score Engine V2
 * 
 * Calculation weights:
 * - On-chain activity (40%): txHash verification, on-chain review count
 * - Verified reviews (30%): quality, recency, AI moderation status
 * - Community trust (20%): upvotes, reviewer reputation
 * - AI quality (10%): baseline score from known projects
 */

import { prisma } from '@/lib/prisma'
import { TRUST_WEIGHTS, STALE_THRESHOLD_HOURS } from '@/lib/scoring-constants'

export interface TrustScoreBreakdown {
  onChainActivity: number      // 0-100
  verifiedReviews: number       // 0-100
  communityTrust: number        // 0-100
  aiQuality: number             // 0-100
}

export interface TrustScoreResult {
  score: number                 // 0-100 (weighted average)
  breakdown: TrustScoreBreakdown
  tokenAddress: string | null
  projectSlug: string | null
  timestamp: string
  metadata: {
    totalReviews: number
    verifiedReviewsCount: number
    avgRating: number
    totalUpvotes: number
  }
}

// Known project baseline scores keyed by address slug (not mutable name)
const AI_BASELINE_BY_ADDRESS: Record<string, number> = {
  // Blue-chip DeFi
  'aave': 88, 'uniswap': 90, 'lido': 85, 'compound': 82, 'curve-finance': 84,
  'pancakeswap': 80, 'ethena': 75, 'ether-fi': 78, 'morpho': 76, 'pendle': 74,
  'sky-makerdao': 86,
  // Top AI Agents (address slugs from seed-agents.ts)
  'aixbt-base': 82, 'game-virtuals-base': 78, 'luna-virtuals-base': 75,
  'vaderai': 72, 'neurobro': 68, 'billybets': 65, 'ethy-ai': 70,
  'music': 62, 'tracy-ai': 60, 'acolyt': 64, '1000x': 58,
  'araistotle': 56, 'ribbita': 55, 'mamo': 60, 'freya-protocol': 58,
}

function getAIBaselineScore(address: string, category: string): number {
  const normalized = address.toLowerCase().trim()
  return AI_BASELINE_BY_ADDRESS[normalized] ?? (category === 'm/defi' ? 60 : 50)
}

/**
 * Calculate on-chain activity score (0-100)
 * Based on: verified on-chain reviews, tx hash presence
 */
function calculateOnChainScore(verifiedCount: number, totalReviews: number): number {
  if (totalReviews === 0) return 0
  
  // Percentage of verified reviews
  const verificationRate = (verifiedCount / totalReviews) * 100
  
  // Boost for having more verified reviews
  const volumeBonus = Math.min(verifiedCount * 2, 20)
  
  return Math.min(verificationRate + volumeBonus, 100)
}

/**
 * Calculate verified reviews score (0-100)
 * Based on: review quality (rating), recency, active status
 */
function calculateVerifiedReviewsScore(
  reviews: Array<{ rating: number; createdAt: Date; status: string }>
): number {
  if (reviews.length === 0) return 0
  
  // Average rating to 0-100 scale
  const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
  const ratingScore = (avgRating / 5) * 100
  
  // Recency bonus: reviews in last 30 days get boost
  const now = new Date()
  const recentReviews = reviews.filter(r => {
    const daysAgo = (now.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    return daysAgo <= 30
  })
  const recencyBonus = Math.min((recentReviews.length / reviews.length) * 20, 20)
  
  // Active status bonus
  const activeReviews = reviews.filter(r => r.status === 'active')
  const activeRate = (activeReviews.length / reviews.length) * 100
  
  return Math.min((ratingScore * 0.6) + (recencyBonus) + (activeRate * 0.2), 100)
}

/**
 * Calculate community trust score (0-100)
 * Based on: upvotes, reviewer reputation
 */
function calculateCommunityTrustScore(
  totalUpvotes: number,
  totalReviews: number,
  avgReviewerReputation: number
): number {
  if (totalReviews === 0) return 0
  
  // Upvotes per review
  const upvotesPerReview = totalUpvotes / totalReviews
  const upvoteScore = Math.min(upvotesPerReview * 10, 60) // Max 60 from upvotes
  
  // Reviewer reputation (0-1000 scale to 0-40)
  const reputationScore = Math.min((avgReviewerReputation / 1000) * 40, 40)
  
  return Math.min(upvoteScore + reputationScore, 100)
}

import { isAddress } from 'viem'
import { analyzeToken } from './token-analysis'

/**
 * Main Trust Score calculation function
 * 
 * @param tokenAddressOrSlug - Token address (0x...) or project slug
 * @returns TrustScoreResult object
 */
export async function calculateTrustScore(
  tokenAddressOrSlug: string
): Promise<TrustScoreResult> {
  // Try to find project by address or slug
  let project = await prisma.project.findFirst({
    where: {
      OR: [
        { address: tokenAddressOrSlug.toLowerCase() },
        { slug: tokenAddressOrSlug.toLowerCase() },
        { name: { contains: tokenAddressOrSlug, mode: 'insensitive' } }
      ]
    },
    include: {
      reviews: {
        include: {
          reviewer: true
        }
      }
    }
  })

  // ON-THE-FLY GENERATION LOGIC
  if (!project) {
    // We only process on-the-fly if it is a valid EVM address format
    if (!isAddress(tokenAddressOrSlug)) {
      throw new Error(`Project not found: ${tokenAddressOrSlug}. Please provide a valid contract address to instantly generate a trust score.`)
    }

    try {
      const address = tokenAddressOrSlug.toLowerCase()
      // 1. Fetch on-chain data
      const analysis = await analyzeToken(address)
      if (!analysis || (!analysis.name && !analysis.symbol)) {
        throw new Error(`Invalid token address: ${address}. Could not read token name/symbol from chain.`)
      }

      // 2. Determine basic stats
      const isVerified = analysis.safetyChecks.verifiedSourceCode
      const isRenounced = analysis.safetyChecks.ownershipRenounced
      let baseScore = 40 // Default for unknown new tokens
      if (isVerified) baseScore += 20
      if (isRenounced) baseScore += 10
      if (analysis.safetyChecks.proxyContract) baseScore -= 10

      // 3. Generate baseline description using AI
      let aiDescription = `An automatically profiled token on Base.`
      try {
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY
        if (apiKey) {
          const { GoogleGenerativeAI } = await import('@google/generative-ai')
          const genAI = new GoogleGenerativeAI(apiKey)
          const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
          const prompt = `Write a short, professional, ONE sentence description for a newly indexed crypto project.
Name: ${analysis.name}
Symbol: ${analysis.symbol}
Verified: ${isVerified ? 'Yes' : 'No'}
Ownership Renounced: ${isRenounced ? 'Yes' : 'No'}`
          const result = await model.generateContent(prompt)
          aiDescription = result.response.text().trim()
        }
      } catch (aiErr) {
        console.warn('AI description generation failed, using fallback', aiErr)
      }

      // 4. Create the project in the database
      project = await prisma.project.create({
        data: {
          address: address,
          name: analysis.name || 'Unknown Token',
          slug: address, // use address as fallback slug initially
          symbol: analysis.symbol || '???',
          category: 'm/memecoin', // default category for auto-indexed tokens
          description: aiDescription,
          chain: 'base-mainnet',
          status: 'active',
          trustScore: baseScore,
          onChainScore: isVerified ? 100 : 0,
        },
        include: {
          reviews: {
            include: {
              reviewer: true
            }
          }
        }
      })
    } catch (err: any) {
      // Re-throw if it failed during creation or analysis
      throw new Error(err.message || `Failed to instant-analyze project for address: ${tokenAddressOrSlug}`)
    }
  }

  // Extract review data
  const reviews = project.reviews
  const totalReviews = reviews.length
  const verifiedReviews = reviews.filter(r => r.txHash !== null && r.txHash !== '')
  const verifiedCount = verifiedReviews.length
  
  const totalUpvotes = reviews.reduce((sum, r) => sum + r.upvotes, 0)
  const avgRating = totalReviews > 0 
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews 
    : 0

  const avgReviewerReputation = totalReviews > 0
    ? reviews.reduce((sum, r) => sum + r.reviewer.reputationScore, 0) / totalReviews
    : 0

  // Calculate individual scores
  const aiQuality = getAIBaselineScore(project.address, project.category)
  const onChainActivity = calculateOnChainScore(verifiedCount, totalReviews)
  const verifiedReviewsScore = calculateVerifiedReviewsScore(
    reviews.map(r => ({
      rating: r.rating,
      createdAt: r.createdAt,
      status: r.status
    }))
  )
  const communityTrust = calculateCommunityTrustScore(
    totalUpvotes,
    totalReviews,
    avgReviewerReputation
  )

  // Weighted final score
  // On-chain (40%) + Verified Reviews (30%) + Community (20%) + AI (10%)
  const finalScore = Math.round(
    onChainActivity * 0.4 +
    verifiedReviewsScore * 0.3 +
    communityTrust * 0.2 +
    aiQuality * 0.1
  )

  return {
    score: finalScore,
    breakdown: {
      onChainActivity: Math.round(onChainActivity),
      verifiedReviews: Math.round(verifiedReviewsScore),
      communityTrust: Math.round(communityTrust),
      aiQuality: Math.round(aiQuality)
    },
    tokenAddress: project.address,
    projectSlug: project.slug,
    timestamp: new Date().toISOString(),
    metadata: {
      totalReviews,
      verifiedReviewsCount: verifiedCount,
      avgRating: parseFloat(avgRating.toFixed(2)),
      totalUpvotes
    }
  }
}

/**
 * Simplified trust score for listing pages (backwards compatible)
 * Used by homepage and other existing pages
 * 
 * For detailed breakdown, use calculateTrustScore(tokenAddressOrSlug)
 */
export function getSimpleTrustScore(
  name: string,
  category: string,
  avgRating: number,
  reviewCount: number
): number {
  const categoryDefault = category === 'm/defi' ? 60 : 50

  if (reviewCount === 0) return categoryDefault

  const communityScore = Math.round(avgRating * 20)

  let communityWeight: number
  if (reviewCount <= 5) { communityWeight = 40 }
  else if (reviewCount <= 20) { communityWeight = 70 }
  else { communityWeight = 90 }

  const defaultWeight = 100 - communityWeight
  return Math.round((categoryDefault * defaultWeight + communityScore * communityWeight) / 100)
}

// ============================================
// V2: 3-Layer Trust Score for Agent API
// ============================================

export function computeAgentTrustScore(
  onChain: number,
  offChain: number,
  human: number = 50
): { score: number; grade: string } {
  const score = Math.round(
    TRUST_WEIGHTS.ON_CHAIN * Math.min(100, Math.max(0, onChain)) +
    TRUST_WEIGHTS.OFF_CHAIN * Math.min(100, Math.max(0, offChain)) +
    TRUST_WEIGHTS.HUMAN_REVIEWS * Math.min(100, Math.max(0, human))
  )

  let grade: string
  if (score >= 90) grade = 'S'
  else if (score >= 80) grade = 'A'
  else if (score >= 70) grade = 'B'
  else if (score >= 60) grade = 'C'
  else if (score >= 40) grade = 'D'
  else grade = 'F'

  return { score, grade }
}

export function getConfidence(project: {
  marketCap: number | null;
  github: string | null;
  website: string | null;
  reviewCount: number;
}): 'high' | 'medium' | 'low' {
  let signals = 0
  if (project.marketCap) signals++
  if (project.github) signals++
  if (project.website) signals++
  if (project.reviewCount > 0) signals++

  if (signals >= 3) return 'high'
  if (signals >= 2) return 'medium'
  return 'low'
}

/**
 * Check if a trust score is stale based on its last update timestamp.
 * Returns true if the score hasn't been updated within the threshold.
 */
export function isStale(
  lastUpdated: Date | null | undefined,
  thresholdHours: number = STALE_THRESHOLD_HOURS
): boolean {
  if (!lastUpdated) return true
  const ageMs = Date.now() - lastUpdated.getTime()
  return ageMs > thresholdHours * 60 * 60 * 1000
}

// ============================================
// V3: Unified Review Count + DataSource Resolution
// ============================================

export type UnifiedDataSource = 'seed' | 'onchain' | 'community' | 'verified'

/**
 * Get total review count for an address, combining both review systems:
 * - Review model (project-based, linked to Project table)
 * - TrustReview model (address-based, from v1 API)
 *
 * This bridges the gap between the two review systems.
 */
export async function getReviewCountForAddress(address: string): Promise<{
  total: number
  projectReviews: number
  trustReviews: number
  avgRating: number
}> {
  const normalizedAddress = address.toLowerCase()

  try {
    const [trustReviews, projectReviewData] = await Promise.all([
      // TrustReview table (v1 API reviews)
      prisma.trustReview.findMany({
        where: { address: { equals: address, mode: 'insensitive' } },
        select: { rating: true },
      }),
      // Review table (project-based reviews) — need to find project first
      prisma.project.findFirst({
        where: { address: normalizedAddress },
        select: {
          reviews: {
            where: { status: 'active' },
            select: { rating: true },
          },
        },
      }),
    ])

    const projectReviews = projectReviewData?.reviews ?? []
    const allRatings = [
      ...trustReviews.map(r => r.rating),
      ...projectReviews.map(r => r.rating),
    ]

    const total = allRatings.length
    const avgRating = total > 0
      ? Math.round((allRatings.reduce((s, r) => s + r, 0) / total) * 10) / 10
      : 0

    return {
      total,
      projectReviews: projectReviews.length,
      trustReviews: trustReviews.length,
      avgRating,
    }
  } catch {
    return { total: 0, projectReviews: 0, trustReviews: 0, avgRating: 0 }
  }
}

/**
 * Determine the data source for an address based on review count.
 *
 * - reviewCount >= 5 → 'community' (unlocks token in TrustGateHook)
 * - reviewCount > 0 but < 5 → 'onchain' (has some data but not enough)
 * - reviewCount === 0 → 'seed' (hardcoded baseline only)
 *
 * This is used by the sync-oracle script to set the correct DataSource
 * on the TrustScoreOracle contract.
 */
export async function getDataSourceForAddress(
  address: string
): Promise<UnifiedDataSource> {
  const { total } = await getReviewCountForAddress(address)

  if (total >= 5) return 'community'
  if (total > 0) return 'onchain'
  return 'seed'
}

