import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/agents?chain=base&tier=1&sort=trust&limit=20
 * 
 * List all agents with trust scores. Supports filtering and sorting.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const chain = searchParams.get('chain')
    const tier = searchParams.get('tier')
    const sort = searchParams.get('sort') || 'trust'
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0') || 0)

    const where: Record<string, unknown> = {
      category: 'm/ai-agents',
      status: 'active',
    }
    if (chain) where.chain = chain.toLowerCase()
    if (tier) where.tier = tier

    const orderBy: Record<string, string> = {}
    switch (sort) {
      case 'market_cap': orderBy.marketCap = 'desc'; break
      case 'name': orderBy.name = 'asc'; break
      case 'reviews': orderBy.reviewCount = 'desc'; break
      default: orderBy.trustScore = 'desc'; break
    }

    const [agents, total] = await Promise.all([
      prisma.project.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
        select: {
          address: true,
          name: true,
          slug: true,
          symbol: true,
          chain: true,
          tier: true,
          description: true,
          trustScore: true,
          trustGrade: true,
          onChainScore: true,
          offChainScore: true,
          humanScore: true,
          marketCap: true,
          price: true,
          reviewCount: true,
          avgRating: true,
          website: true,
          twitter: true,
        },
      }),
      prisma.project.count({ where }),
    ])

    return NextResponse.json({
      agents: agents.map((a) => ({
        id: a.address,
        name: a.name,
        slug: a.slug,
        symbol: a.symbol,
        chain: a.chain,
        tier: a.tier,
        description: a.description?.slice(0, 150),
        trust: {
          score: a.trustScore,
          grade: a.trustGrade,
          on_chain: a.onChainScore,
          off_chain: a.offChainScore,
          human: a.humanScore,
        },
        market_cap: a.marketCap,
        price: a.price,
        reviews: a.reviewCount,
        avg_rating: a.avgRating,
        links: { website: a.website, twitter: a.twitter },
      })),
      pagination: { total, limit, offset, has_more: offset + limit < total },
      meta: { api_version: 'v1', filters: { chain, tier, sort } },
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    })
  } catch (error: any) {
    console.error('[Agents API] Error:', error.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
