import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/leaderboard
 *
 * Dojo agent leaderboard with multiple ranking modes.
 *
 * Query params:
 *   sort?:    "trust" (default) | "earnings" | "jobs" | "level"
 *   limit?:   max 100 (default 20)
 *   offset?:  pagination offset
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const sort = searchParams.get('sort') || 'trust'
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'))

    type AgentOrderBy =
      | { trustScore: 'desc' }
      | { totalEarned: 'desc' }
      | { totalJobs: 'desc' }
      | { level: 'desc' }

    const orderByMap: Record<string, AgentOrderBy> = {
      trust: { trustScore: 'desc' },
      earnings: { totalEarned: 'desc' },
      jobs: { totalJobs: 'desc' },
      level: { level: 'desc' },
    }
    const orderBy: AgentOrderBy = orderByMap[sort] ?? { trustScore: 'desc' }

    const [agents, total] = await Promise.all([
      prisma.agent.findMany({
        where: { isPublished: true },
        orderBy,
        take: limit,
        skip: offset,
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          template: true,
          rank: true,
          level: true,
          xp: true,
          trustScore: true,
          completionRate: true,
          totalJobs: true,
          totalEarned: true,
          ownerAddress: true,
          createdAt: true,
          equippedSkills: {
            where: { isActive: true },
            select: {
              skill: {
                select: { id: true, name: true, category: true, creatorAvatar: true },
              },
            },
            take: 3,
          },
        },
      }),
      prisma.agent.count({ where: { isPublished: true } }),
    ])

    // Add rank position
    const ranked = agents.map((agent, idx) => ({
      position: offset + idx + 1,
      ...agent,
      equippedSkills: (agent.equippedSkills as Array<{ skill: unknown }>).map((e) => e.skill),
    }))

    // --- Platform-wide stats for dashboard ---
    const [platformStats] = await prisma.$transaction([
      prisma.agent.aggregate({
        where: { isPublished: true },
        _avg: { trustScore: true, completionRate: true },
        _sum: { totalJobs: true, totalEarned: true },
        _count: { id: true },
      }),
    ])

    return NextResponse.json({
      leaderboard: ranked,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      platform: {
        totalAgents: platformStats._count.id,
        avgTrustScore: Math.round(platformStats._avg.trustScore ?? 0),
        avgCompletionRate: platformStats._avg.completionRate ?? 0,
        totalJobsCompleted: platformStats._sum.totalJobs ?? 0,
        totalEarned: platformStats._sum.totalEarned ?? 0,
      },
    })
  } catch (err) {
    console.error('[GET /api/leaderboard]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
