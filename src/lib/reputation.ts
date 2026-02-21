/**
 * User Reputation System
 * 
 * Scarab points + review history → trust level → fee tier
 */
import { prisma } from '@/lib/prisma'

export interface UserReputation {
  address: string
  scarabPoints: number
  totalReviews: number
  totalUpvotes: number
  reputationScore: number
  trustLevel: 'new' | 'trusted' | 'verified' | 'guardian'
  feeTier: number // percentage, e.g. 0.5 = 0.5%
  feeDiscount: string // human readable
}

const FEE_TIERS = [
  { minScore: 200, level: 'guardian' as const, fee: 0, discount: '100% off (0% fee)' },
  { minScore: 50, level: 'verified' as const, fee: 0.1, discount: '80% off (0.1% fee)' },
  { minScore: 10, level: 'trusted' as const, fee: 0.3, discount: '40% off (0.3% fee)' },
  { minScore: 0, level: 'new' as const, fee: 0.5, discount: 'Standard (0.5% fee)' },
]

export async function getUserReputation(walletAddress: string): Promise<UserReputation> {
  const address = walletAddress.toLowerCase()

  // Get user from DB
  const user = await prisma.user.findUnique({ where: { address } })

  // Get Scarab balance
  const scarab = await prisma.scarabBalance.findUnique({ where: { address } })

  const reputationScore = user?.reputationScore ?? 0
  const scarabPoints = scarab?.balance ?? 0
  const totalReviews = user?.totalReviews ?? 0
  const totalUpvotes = user?.totalUpvotes ?? 0

  // Combined score: reputation + scarab weighted
  const combinedScore = reputationScore + Math.floor(scarabPoints / 10)

  // Determine tier
  const tier = FEE_TIERS.find(t => combinedScore >= t.minScore) ?? FEE_TIERS[FEE_TIERS.length - 1]

  return {
    address,
    scarabPoints,
    totalReviews,
    totalUpvotes,
    reputationScore: combinedScore,
    trustLevel: tier.level,
    feeTier: tier.fee,
    feeDiscount: tier.discount,
  }
}
