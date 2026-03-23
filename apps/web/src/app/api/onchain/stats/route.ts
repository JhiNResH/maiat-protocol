import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOnChainReviewCount, isOnChainEnabled } from '@/lib/onchain'

export const dynamic = 'force-dynamic'

/**
 * GET /api/onchain/stats
 * Returns on-chain verification statistics
 */
export async function GET() {
  const enabled = isOnChainEnabled()

  // Count verified reviews in DB
  const verifiedCount = await prisma.review.count({
    where: { txHash: { not: null } },
  })

  const totalReviews = await prisma.review.count()

  // Try to get on-chain count
  let onChainCount = 0
  if (enabled) {
    try {
      onChainCount = Number(await getOnChainReviewCount())
    } catch {
      onChainCount = verifiedCount
    }
  }

  return NextResponse.json({
    enabled,
    contractAddress: process.env.NEXT_PUBLIC_REVIEW_REGISTRY_ADDRESS || null,
    network: 'BSC Testnet',
    totalReviews,
    verifiedReviews: verifiedCount,
    onChainCount,
    verificationRate: totalReviews > 0 ? (verifiedCount / totalReviews * 100).toFixed(1) : '0',
  })
}
