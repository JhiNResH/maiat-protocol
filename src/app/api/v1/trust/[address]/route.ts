import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getConfidence, isStale } from '@/lib/trust-score'
import { TRUST_WEIGHTS } from '@/lib/scoring-constants'
import { apiLog } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/trust/:address?chain=base
 * 
 * Returns trust score for an AI agent.
 * Primary endpoint agents call before executing trades.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params
  try {
    const chain = request.nextUrl.searchParams.get('chain')

    const project = await prisma.project.findFirst({
      where: {
        OR: [
          { address: address.toLowerCase() },
          { slug: address.toLowerCase() },
        ],
      },
      include: {
        reviews: {
          where: { status: 'active' },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            reviewer: {
              select: { displayName: true, reputationScore: true },
            },
          },
        },
      },
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Agent not found', address, hint: 'Use GET /api/v1/agents to list all agents' },
        { status: 404 }
      )
    }

    if (chain && project.chain !== chain.toLowerCase()) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    const confidence = getConfidence(project)

    return NextResponse.json({
      agent: {
        id: project.address,
        name: project.name,
        slug: project.slug,
        symbol: project.symbol,
        chain: project.chain,
        tier: project.tier,
        description: project.description,
        functions: project.coreFunctions ? JSON.parse(project.coreFunctions) : [],
        links: {
          website: project.website,
          twitter: project.twitter,
          github: project.github,
          docs: project.docs,
        },
      },
      trust: {
        score: project.trustScore,
        isStale: isStale(project.trustUpdatedAt),
        grade: project.trustGrade,
        breakdown: {
          on_chain: project.onChainScore,
          off_chain: project.offChainScore,
          human_reviews: project.humanScore,
        },
        confidence,
        weights: { on_chain: TRUST_WEIGHTS.ON_CHAIN, off_chain: TRUST_WEIGHTS.OFF_CHAIN, human_reviews: TRUST_WEIGHTS.HUMAN_REVIEWS },
        recommendation: getRecommendation(project.trustScore),
        last_updated: project.trustUpdatedAt?.toISOString() || null,
      },
      market: {
        market_cap: project.marketCap,
        price: project.price,
        volume_24h: project.volume24h,
        last_updated: project.marketUpdatedAt?.toISOString() || null,
      },
      reviews: {
        count: project.reviewCount,
        avg_rating: project.avgRating,
        recent: project.reviews.map((r) => ({
          rating: r.rating,
          content: r.content.slice(0, 200),
          reviewer: r.reviewer.displayName || 'Anonymous',
          reputation: r.reviewer.reputationScore,
          created_at: r.createdAt.toISOString(),
        })),
      },
      meta: { api_version: 'v1', status: project.status },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'X-Maiat-Trust-Score': String(project.trustScore || 0),
        'X-Maiat-Trust-Grade': project.trustGrade || 'N/A',
      },
    })
  } catch (error: any) {
    apiLog.error('trust', error, { address })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function getRecommendation(score: number | null): string {
  if (!score) return 'INSUFFICIENT_DATA'
  if (score >= 80) return 'TRUSTED'
  if (score >= 60) return 'NEUTRAL'
  if (score >= 40) return 'CAUTION'
  return 'HIGH_RISK'
}
