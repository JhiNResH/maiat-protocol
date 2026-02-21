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

// Known project baseline scores (AI quality)
const AI_BASELINE_SCORES: Record<string, number> = {
  // Blue-chip DeFi
  'aave': 88, 'uniswap': 90, 'lido': 85, 'compound': 82, 'curve finance': 84,
  'pancakeswap': 80, 'ethena': 75, 'ether.fi': 78, 'morpho': 76, 'pendle': 74,
  'sky (makerdao)': 86,
  // Top AI Agents
  'aixbt': 82, 'g.a.m.e': 78, 'luna': 75, 'vaderai': 72, 'neurobro': 68,
  'billybets': 65, 'ethy ai': 70, 'music': 62, 'tracy.ai': 60, 'acolyt': 64,
  '1000x': 58, 'araistotle': 56, 'ribbita': 55, 'mamo': 60, 'freya protocol': 58,
}

function getAIBaselineScore(name: string, category: string): number {
  const normalized = name.toLowerCase().trim()
  return AI_BASELINE_SCORES[normalized] ?? (category === 'm/defi' ? 60 : 50)
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
  const project = await prisma.project.findFirst({
    where: {
      OR: [
        { address: tokenAddressOrSlug.toLowerCase() },
        { slug: tokenAddressOrSlug.toLowerCase() },
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

  if (!project) {
    throw new Error(`Project not found: ${tokenAddressOrSlug}`)
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
  const aiQuality = getAIBaselineScore(project.name, project.category)
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
  const aiBaseline = getAIBaselineScore(name, category)
  
  if (reviewCount === 0) return aiBaseline
  
  const communityScore = Math.round(avgRating * 20)
  
  let aiWeight: number, communityWeight: number
  if (reviewCount <= 5) { aiWeight = 60; communityWeight = 40 }
  else if (reviewCount <= 20) { aiWeight = 30; communityWeight = 70 }
  else { aiWeight = 10; communityWeight = 90 }
  
  return Math.round((aiBaseline * aiWeight + communityScore * communityWeight) / 100)
}
