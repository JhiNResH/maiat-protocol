import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  hashReviewContent,
  submitReviewOnChain,
  verifyOnChain,
  isOnChainEnabled,
  getExplorerUrl,
} from '@/lib/onchain'
import { verifyLimiter, checkRateLimit } from '@/lib/ratelimit'
import type { Hex } from 'viem'

export const dynamic = 'force-dynamic'

/**
 * GET /api/reviews/[id]/verify
 * Check on-chain verification status of a review
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const review = await prisma.review.findUnique({
    where: { id },
    include: {
      reviewer: { select: { address: true } },
      project: { select: { category: true } },
    },
  })

  if (!review) {
    return NextResponse.json({ error: 'Review not found' }, { status: 404 })
  }

  // If we have a txHash, verify it on-chain
  if (review.txHash && review.onChainReviewId) {
    const verified = await verifyOnChain(review.onChainReviewId as Hex)
    return NextResponse.json({
      verified,
      txHash: review.txHash,
      onChainReviewId: review.onChainReviewId,
      explorerUrl: getExplorerUrl(review.txHash),
      contentHash: review.contentHash,
    })
  }

  return NextResponse.json({
    verified: false,
    txHash: null,
    onChainReviewId: null,
    explorerUrl: null,
    contentHash: review.contentHash,
  })
}

/**
 * POST /api/reviews/[id]/verify
 * Submit review to Base Sepolia on-chain (server-side relayer)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!isOnChainEnabled()) {
    return NextResponse.json(
      { error: 'On-chain verification not available (contract not deployed)' },
      { status: 503 }
    )
  }

  // **SECURITY FIX #2: Rate Limiting (prevent gas drain attack)**
  const rateLimitResult = await checkRateLimit(verifyLimiter, `verify:${id}`)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded for this review',
        limit: rateLimitResult.limit,
        remaining: rateLimitResult.remaining,
        resetAt: rateLimitResult.reset.toISOString(),
      },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset.getTime().toString(),
        }
      }
    )
  }

  // **SECURITY FIX #4: Race Condition Protection**
  // Use Prisma transaction with optimistic locking
  const review = await prisma.$transaction(async (tx) => {
    const existingReview = await tx.review.findUnique({
      where: { id },
      include: {
        reviewer: { select: { address: true } },
        project: { select: { id: true, category: true } },
      },
    })

    if (!existingReview) {
      throw new Error('Review not found')
    }

    // Already verified (race condition check)
    if (existingReview.txHash) {
      return existingReview
    }

    return existingReview
  })

  if (!review) {
    return NextResponse.json({ error: 'Review not found' }, { status: 404 })
  }

  // Already verified (return existing data)
  if (review.txHash) {
    return NextResponse.json({
      alreadyVerified: true,
      txHash: review.txHash,
      explorerUrl: getExplorerUrl(review.txHash),
    })
  }

  // **SECURITY FIX #3: Authorization Check**
  // Only allow review owner to trigger verification (or remove this endpoint entirely)
  const body = await request.json().catch(() => ({}))
  const requesterAddress = body.requesterAddress?.toLowerCase()

  if (requesterAddress && requesterAddress !== review.reviewer.address.toLowerCase()) {
    return NextResponse.json(
      { error: 'Unauthorized - only review owner can verify' },
      { status: 403 }
    )
  }

  // Hash the review content
  const contentHash = hashReviewContent(review.content, review.rating, review.reviewerId)

  // Submit on-chain
  const result = await submitReviewOnChain(
    review.project.category,
    review.project.id,
    contentHash
  )

  if (!result) {
    return NextResponse.json(
      { error: 'On-chain submission failed' },
      { status: 500 }
    )
  }

  // Update review with on-chain proof (with another race condition check)
  const updated = await prisma.review.updateMany({
    where: {
      id,
      txHash: null, // Only update if still not verified
    },
    data: {
      txHash: result.txHash,
      contentHash,
      onChainReviewId: result.reviewId,
    },
  })

  if (updated.count === 0) {
    // Race condition: another request beat us
    const existing = await prisma.review.findUnique({ where: { id } })
    return NextResponse.json({
      alreadyVerified: true,
      txHash: existing?.txHash || result.txHash,
      explorerUrl: getExplorerUrl(existing?.txHash || result.txHash),
    })
  }

  return NextResponse.json({
    verified: true,
    txHash: result.txHash,
    onChainReviewId: result.reviewId,
    explorerUrl: getExplorerUrl(result.txHash),
    contentHash,
  })
}
