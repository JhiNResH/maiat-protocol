import { NextRequest, NextResponse } from 'next/server'
import { prisma, dbAvailable } from '@/lib/prisma'
import { computeTrustScore, type AcpAgent } from '@/lib/acp-indexer'

export const dynamic = 'force-dynamic'

const ACP_AGENTS_URL = 'https://acpx.virtuals.io/api/agents'

/**
 * Fallback: fetch agents directly from Virtuals ACP when DB is unavailable.
 */
async function fetchAgentsFromVirtuals(limit: number, search: string) {
  const params = new URLSearchParams({
    'pagination[page]': '1',
    'pagination[pageSize]': String(Math.min(limit, 25)),
  })
  if (search) params.set('filters[name]', search)
  const res = await fetch(`${ACP_AGENTS_URL}?${params}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Virtuals API ${res.status}`)
  const json = (await res.json()) as { data?: AcpAgent[]; meta?: { pagination?: { total?: number } } }
  return {
    agents: (json.data ?? []).map((a) => {
      const score = computeTrustScore(a)
      return {
        walletAddress: a.walletAddress,
        trustScore: score.trustScore,
        completionRate: score.completionRate,
        paymentRate: score.paymentRate,
        totalJobs: score.totalJobs,
        dataSource: 'ACP_BEHAVIORAL_LIVE' as string,
        lastUpdated: new Date(),
        rawMetrics: a as unknown,
      }
    }),
    total: json.meta?.pagination?.total ?? 0,
  }
}

/**
 * GET /api/v1/agents?sort=trust&limit=50&offset=0&search=name
 *
 * List ACP agents with behavioral trust scores (sourced from Virtuals ACP job history).
 * Data comes from the agentScore table populated by the ACP indexer.
 * Falls back to live Virtuals ACP API when DB is unavailable.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const sort = searchParams.get('sort') || 'trust'
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 1000)
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'))
    const search = searchParams.get('search') || ''

    const orderBy =
      sort === 'jobs'
        ? { totalJobs: 'desc' as const }
        : { trustScore: 'desc' as const }

    type AgentRow = {
      walletAddress: string; trustScore: number; completionRate: number;
      paymentRate: number; totalJobs: number; dataSource: string;
      lastUpdated: Date; rawMetrics: unknown;
    }
    let agents: AgentRow[]
    let total: number
    let source = 'DB_CACHE'

    if (!dbAvailable) {
      // ── No DB configured: live fetch from Virtuals ───────────────────────────
      const live = await fetchAgentsFromVirtuals(limit, search)
      agents = live.agents
      total  = live.total
      source = 'ACP_LIVE'
    } else if (search) {
      // Use raw SQL for ILIKE on JSON field + wallet address
      const searchPattern = `%${search}%`
      const orderCol = sort === 'jobs' ? 'total_jobs' : 'trust_score'

      try {
        const countResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
          `SELECT COUNT(*)::bigint as count FROM agent_scores
           WHERE wallet_address ILIKE $1
              OR raw_metrics->>'name' ILIKE $1
              OR raw_metrics->>'category' ILIKE $1`,
          searchPattern
        )
        total = Number(countResult[0]?.count ?? 0)

        agents = await prisma.$queryRawUnsafe(
          `SELECT id, wallet_address as "walletAddress", trust_score as "trustScore",
                  completion_rate as "completionRate", payment_rate as "paymentRate",
                  total_jobs as "totalJobs", data_source as "dataSource",
                  last_updated as "lastUpdated", raw_metrics as "rawMetrics"
           FROM agent_scores
           WHERE wallet_address ILIKE $1
              OR raw_metrics->>'name' ILIKE $1
              OR raw_metrics->>'category' ILIKE $1
           ORDER BY ${orderCol} DESC
           LIMIT $2 OFFSET $3`,
          searchPattern,
          limit,
          offset
        )
      } catch {
        // DB failed at runtime — fallback to Virtuals live data
        const live = await fetchAgentsFromVirtuals(limit, search)
        agents = live.agents
        total  = live.total
        source = 'ACP_LIVE'
      }
    } else {
      const where = {}
      try {
        ;[agents, total] = await Promise.all([
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
      } catch {
        // DB failed at runtime — fallback to Virtuals live data
        const live = await fetchAgentsFromVirtuals(limit, search)
        agents = live.agents
        total  = live.total
        source = 'ACP_LIVE'
      }
    }

    return NextResponse.json(
      {
        agents: agents.map((a) => {
          const raw = (a.rawMetrics ?? {}) as Record<string, unknown>
          const name =
            typeof raw.name === 'string' ? raw.name : a.walletAddress.slice(0, 10) + '...'
          const category = typeof raw.category === 'string' ? raw.category : null
          const logo = typeof raw.profilePic === 'string' ? raw.profilePic : null
          const description = typeof raw.description === 'string' ? raw.description : null

          return {
            id: a.walletAddress,
            name,
            category,
            logo,
            description,
            chain: 'Base',
            trust: {
              score: a.trustScore,
              grade: scoreToGrade(a.trustScore),
            },
            breakdown: {
              completionRate: a.completionRate,
              paymentRate: a.paymentRate,
              totalJobs: a.totalJobs,
              agdp: (raw as Record<string, unknown>)?.grossAgenticAmount ?? null,
              revenue: (raw as Record<string, unknown>)?.revenue ?? null,
            },
            dataSource: a.dataSource,
            lastUpdated: a.lastUpdated.toISOString(),
          }
        }),
        pagination: { total, limit, offset, has_more: offset + limit < total },
        meta: { api_version: 'v1', source },
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
