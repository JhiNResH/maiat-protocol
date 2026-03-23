/**
 * FairScale Reputation API Integration
 * 
 * Integrates with FairScale.xyz to fetch wallet-level reputation tiers
 * and combine them with Maiat's behavioral scoring for comprehensive
 * agent trust assessment.
 * 
 * FairScale provides wallet-level reputation (Tier 1-5) based on:
 * - Transaction count and frequency
 * - Account age
 * - Fraud/blacklist flags
 * - KYC verification status (if applicable)
 */

import { cache } from 'react'

/**
 * FairScale Reputation Tier (1 = lowest, 5 = highest)
 */
export type FairScaleTier = 1 | 2 | 3 | 4 | 5

/**
 * FairScale reputation data for a wallet
 */
export interface FairScaleReputation {
  wallet: string
  tier: FairScaleTier
  score: number // 0-100 based on tier
  transactionCount: number
  accountAgeInDays: number
  verified: boolean
  fraudFlags: string[]
  lastUpdated: number // unix timestamp
}

/**
 * Cache configuration
 */
const CACHE_CONFIG = {
  tier: 24 * 60 * 60, // 24 hours
  fraudFlags: 6 * 60 * 60, // 6 hours
  refresh: 60 * 60, // 1 hour minimum between updates
}

/**
 * In-memory cache for FairScale reputation data
 * In production, this should use Redis or similar
 */
const reputationCache = new Map<
  string,
  { data: FairScaleReputation; timestamp: number }
>()

/**
 * Convert FairScale tier to reputation score (0-100)
 */
function tierToScore(tier: FairScaleTier): number {
  const tierScores: Record<FairScaleTier, number> = {
    1: 20, // New wallet
    2: 40, // Some activity
    3: 60, // Moderate history
    4: 80, // Established user
    5: 100, // Elite user
  }
  return tierScores[tier]
}

/**
 * Apply adjustments to base reputation score based on signals
 */
function applyAdjustments(
  baseScore: number,
  signals: {
    verified: boolean
    fraudFlags: string[]
    solanaHistoryBonus: boolean
    daoParticipation: boolean
  }
): number {
  let adjustedScore = baseScore

  // Positive adjustments
  if (signals.verified) adjustedScore += 10
  if (signals.solanaHistoryBonus) adjustedScore += 5
  if (signals.daoParticipation) adjustedScore += 5

  // Negative adjustments
  if (signals.fraudFlags.includes('rug_history')) adjustedScore -= 50
  if (signals.fraudFlags.includes('blacklist')) adjustedScore -= 100
  if (signals.fraudFlags.includes('honeypot')) adjustedScore -= 30

  // Cap score to 0-100
  return Math.max(0, Math.min(100, adjustedScore))
}

/**
 * Mock FairScale API response for development
 * In production, this calls the actual FairScale API
 */
async function mockFairScaleApi(
  wallet: string
): Promise<Omit<FairScaleReputation, 'lastUpdated'>> {
  // Simulated tier detection based on wallet characteristics
  // In production: call https://api.fairscale.xyz/wallet/:address
  
  const mockWallets: Record<
    string,
    Omit<FairScaleReputation, 'lastUpdated'>
  > = {
    '0x5facebd66d78a69b400dc702049374b95745fbc5': {
      wallet: '0x5facebd66d78a69b400dc702049374b95745fbc5',
      tier: 4,
      score: 80,
      transactionCount: 1240,
      accountAgeInDays: 450,
      verified: true,
      fraudFlags: [],
    },
    '0xbad0000000000000000000000000000000000001': {
      wallet: '0xbad0000000000000000000000000000000000001',
      tier: 1,
      score: 20,
      transactionCount: 2,
      accountAgeInDays: 5,
      verified: false,
      fraudFlags: [],
    },
    '0xf00000000000000000000000000000000000000d': {
      wallet: '0xf00000000000000000000000000000000000000d',
      tier: 2,
      score: 40,
      transactionCount: 15,
      accountAgeInDays: 60,
      verified: false,
      fraudFlags: ['honeypot_flag'],
    },
  }

  // Check if we have mock data, otherwise generate based on hash
  if (mockWallets[wallet]) {
    return mockWallets[wallet]
  }

  // Generate mock score based on wallet address hash
  const hash = wallet
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const mockTier = (Math.abs(hash) % 5) + 1 as FairScaleTier
  const baseScore = tierToScore(mockTier)

  return {
    wallet,
    tier: mockTier,
    score: baseScore,
    transactionCount: Math.floor(Math.random() * 500) + 10,
    accountAgeInDays: Math.floor(Math.random() * 400) + 30,
    verified: Math.random() > 0.7,
    fraudFlags: [],
  }
}

/**
 * Fetch FairScale reputation for a wallet
 * Implements caching with fallback to mock data in development
 */
export async function getFairScaleReputation(
  wallet: string,
  options?: {
    forceRefresh?: boolean
    useCache?: boolean
  }
): Promise<FairScaleReputation> {
  const useCache = options?.useCache !== false
  const forceRefresh = options?.forceRefresh === true

  // Check cache first
  if (useCache && !forceRefresh) {
    const cached = reputationCache.get(wallet.toLowerCase())
    if (cached && Date.now() - cached.timestamp < CACHE_CONFIG.tier * 1000) {
      return cached.data
    }
  }

  try {
    // In production: call FairScale API
    // const response = await fetch(
    //   `https://api.fairscale.xyz/reputation/${wallet}`,
    //   {
    //     headers: {
    //       'Authorization': `Bearer ${process.env.FAIRSCALE_API_KEY}`,
    //     },
    //   }
    // )
    // const data = await response.json()

    // For now, use mock data
    const mockData = await mockFairScaleApi(wallet)

    const reputation: FairScaleReputation = {
      ...mockData,
      score: applyAdjustments(mockData.score, {
        verified: mockData.verified,
        fraudFlags: mockData.fraudFlags,
        solanaHistoryBonus: false, // Would check on-chain
        daoParticipation: false, // Would check governance contracts
      }),
      lastUpdated: Date.now(),
    }

    // Cache the result
    if (useCache) {
      reputationCache.set(wallet.toLowerCase(), {
        data: reputation,
        timestamp: Date.now(),
      })
    }

    return reputation
  } catch (error) {
    console.error(`[FairScale] Error fetching reputation for ${wallet}:`, error)

    // Return degraded/default reputation on API failure
    return {
      wallet,
      tier: 3, // Conservative default
      score: 60,
      transactionCount: 0,
      accountAgeInDays: 0,
      verified: false,
      fraudFlags: [],
      lastUpdated: Date.now(),
    }
  }
}

/**
 * Calculate Maiat reputation score based on FairScale tier + behavioral data
 * Combines FairScale wallet reputation (35%) with agent behavioral history (40%)
 * and token risk assessment (25%)
 */
export async function calculateAgentTrustScore(params: {
  walletAddress: string
  behaviorScore: number // 0-100, from Maiat Oracle
  tokenScore?: number // 0-100, optional, defaults to 50
}): Promise<{
  trustScore: number // Final 0-100 score
  reputationScore: number // 35% weight
  behaviorScore: number // 40% weight
  tokenScore: number // 25% weight
  tier: 'untrusted' | 'questionable' | 'cautious' | 'trusted' | 'elite'
}> {
  const fairscale = await getFairScaleReputation(params.walletAddress)
  const tokenScore = params.tokenScore ?? 50

  // Apply weights: Behavior (40%), Reputation (35%), Token (25%)
  const trustScore =
    (params.behaviorScore * 0.4 + fairscale.score * 0.35 + tokenScore * 0.25)

  // Determine tier based on score
  let tier: 'untrusted' | 'questionable' | 'cautious' | 'trusted' | 'elite'
  if (trustScore <= 20) tier = 'untrusted'
  else if (trustScore <= 40) tier = 'questionable'
  else if (trustScore <= 60) tier = 'cautious'
  else if (trustScore <= 80) tier = 'trusted'
  else tier = 'elite'

  return {
    trustScore: Math.round(trustScore),
    reputationScore: fairscale.score,
    behaviorScore: params.behaviorScore,
    tokenScore,
    tier,
  }
}

/**
 * Calculate dynamic ACP fee based on trust score
 * Elite agents get discounts, untrusted agents pay premiums
 */
export function calculateAcpFee(
  baseFee: number,
  trustScore: number
): {
  finalFee: number
  discountPercent: number
  reason: string
} {
  let feeMultiplier = 1
  let discountPercent = 0
  let reason = 'standard'

  if (trustScore >= 81) {
    // Elite: 25% discount
    feeMultiplier = 0.75
    discountPercent = -25
    reason = 'elite_discount'
  } else if (trustScore >= 61) {
    // Trusted: standard
    feeMultiplier = 1.0
    reason = 'trusted_standard'
  } else if (trustScore >= 41) {
    // Cautious: 50% premium
    feeMultiplier = 1.5
    discountPercent = 50
    reason = 'cautious_premium'
  } else if (trustScore >= 21) {
    // Questionable: 200% premium
    feeMultiplier = 3.0
    discountPercent = 200
    reason = 'questionable_premium'
  } else {
    // Untrusted: blocked (fee = -1)
    return {
      finalFee: -1,
      discountPercent: 0,
      reason: 'untrusted_blocked',
    }
  }

  return {
    finalFee: baseFee * feeMultiplier,
    discountPercent,
    reason,
  }
}

/**
 * Clear cache for a specific wallet or all wallets
 */
export function clearReputationCache(wallet?: string): void {
  if (wallet) {
    reputationCache.delete(wallet.toLowerCase())
  } else {
    reputationCache.clear()
  }
}

/**
 * Get cache stats (for monitoring)
 */
export function getCacheStats(): {
  cachedWallets: number
  oldestCacheEntry: number | null
} {
  return {
    cachedWallets: reputationCache.size,
    oldestCacheEntry: Array.from(reputationCache.values())
      .map((v) => v.timestamp)
      .sort()
      .at(0) || null,
  }
}
