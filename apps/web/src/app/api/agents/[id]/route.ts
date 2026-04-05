import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/agents/[id]
 *
 * Fetch a single Dojo agent by ID, with equipped skills, recent jobs, and stats.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const agent = await prisma.agent.findUnique({
      where: { id },
      include: {
        equippedSkills: {
          where: { isActive: true },
          include: {
            skill: {
              select: {
                id: true,
                name: true,
                description: true,
                category: true,
                tags: true,
                priceUsdc: true,
                isPro: true,
                avgRating: true,
                reviewCount: true,
                creatorAvatar: true,
                creatorName: true,
              },
            },
          },
          orderBy: { equippedAt: 'desc' },
        },
        jobHistory: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            inputPrompt: true,
            verdict: true,
            amountUsdc: true,
            status: true,
            createdAt: true,
            executionTime: true,
          },
        },
      },
    })

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    return NextResponse.json({
      agent: {
        id: agent.id,
        erc8004Id: agent.erc8004Id,
        erc6551Tba: agent.erc6551Tba,
        ownerAddress: agent.ownerAddress,
        name: agent.name,
        description: agent.description,
        avatarUrl: agent.avatarUrl,
        template: agent.template,
        rank: agent.rank,
        level: agent.level,
        xp: agent.xp,
        trustScore: agent.trustScore,
        completionRate: agent.completionRate,
        totalJobs: agent.totalJobs,
        totalEarned: agent.totalEarned,
        isPublished: agent.isPublished,
        isPaused: agent.isPaused,
        equippedSkills: (agent.equippedSkills as Array<{ id: string; skill: Record<string, unknown>; equippedAt: Date; nftTokenId: number | null }>).map((e) => ({
          equipmentId: e.id,
          skill: e.skill,
          equippedAt: e.equippedAt,
          nftTokenId: e.nftTokenId,
        })),
        recentJobs: (agent as unknown as { jobHistory: unknown[] }).jobHistory,
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt,
      },
    })
  } catch (err) {
    console.error('[GET /api/agents/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/agents/[id]
 *
 * Update agent metadata. Only the owner can update.
 * Body: { ownerAddress, name?, description?, avatarUrl?, isPublished? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const { ownerAddress, name, description, avatarUrl, isPublished } = body

    if (!ownerAddress) {
      return NextResponse.json({ error: 'ownerAddress is required for auth' }, { status: 400 })
    }

    const agent = await prisma.agent.findUnique({ where: { id } })
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }
    if (agent.ownerAddress.toLowerCase() !== ownerAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const updated = await prisma.agent.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(avatarUrl !== undefined && { avatarUrl: avatarUrl || null }),
        ...(isPublished !== undefined && { isPublished }),
      },
    })

    return NextResponse.json({ success: true, agent: { id: updated.id, name: updated.name, isPublished: updated.isPublished } })
  } catch (err) {
    console.error('[PATCH /api/agents/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
