import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/agents?sort=trust&limit=50&offset=0&search=name
 *
 * List ACP agents with behavioral trust scores (sourced from Virtuals ACP job history).
 * Data comes from the agentScore table populated by the ACP indexer.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const sort = searchParams.get('sort') || 'trust'
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'))
    const search = searchParams.get('search') || ''

    const where = search
      ? {
          OR: [
            { walletAddress: { contains: search, mode: 'insensitive' as const } },
            { rawMetrics: { path: ['name'], string_contains: search } },
          ],
        }
      : {}

    const orderBy =
      sort === 'jobs'
        ? { totalJobs: 'desc' as const }
        : { trustScore: 'desc' as const }

    const [agents, total] = await Promise.all([
      prisma.agentScore.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
        select: {
          walletAddress: true,
          trustScore: true,
          completionRate: true,
          paymentRate: true,
          totalJobs: true,
          dataSource: true,
          lastUpdated: true,
          rawMetrics: true,
        },
      }),
      prisma.agentScore.count({ where }),
    ])

    return NextResponse.json(
      {
        agents: agents.map((a) => {
          const raw = (a.rawMetrics ?? {}) as Record<string, unknown>
          const name =
            typeof raw.name === 'string' ? raw.name : a.walletAddress.slice(0, 10) + '...'
          const category = typeof raw.category === 'string' ? raw.category : null
          const logo = typeof raw.profilePic === 'string' ? raw.profilePic : null

          return {
            id: a.walletAddress,
            name,
            category,
            logo,
            chain: 'Base',
            trust: {
              score: a.trustScore,
              grade: scoreToGrade(a.trustScore),
            },
            breakdown: {
              completionRate: a.completionRate,
              paymentRate: a.paymentRate,
              totalJobs: a.totalJobs,
            },
            dataSource: a.dataSource,
            lastUpdated: a.lastUpdated.toISOString(),
          }
        }),
        pagination: { total, limit, offset, has_more: offset + limit < total },
        meta: { api_version: 'v1', source: 'ACP_BEHAVIORAL' },
      },
      {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
      }
    )
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[Agents API] Error:', msg)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function scoreToGrade(score: number): string {
  if (score >= 90) return 'A+'
  if (score >= 80) return 'A'
  if (score >= 70) return 'B'
  if (score >= 60) return 'C'
  if (score >= 50) return 'D'
  return 'F'
}
