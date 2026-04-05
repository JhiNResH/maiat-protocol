import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * POST /api/agents/create
 *
 * Create a new Dojo agent (MVP — DB only, no on-chain yet).
 * Phase 2 will mint ERC-8004 + open ERC-6551 TBA.
 *
 * Body:
 *   ownerAddress: string   — creator wallet or Privy DID
 *   name: string
 *   description?: string
 *   avatarUrl?: string
 *   template?: "assistant" | "analyst" | "trader" | "guardian" | "researcher"
 *   skillIds?: string[]    — pre-equip skills on creation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ownerAddress, name, description, avatarUrl, template, skillIds } = body

    // --- Validation ---
    if (!ownerAddress || typeof ownerAddress !== 'string') {
      return NextResponse.json({ error: 'ownerAddress is required' }, { status: 400 })
    }
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json({ error: 'name must be at least 2 characters' }, { status: 400 })
    }
    if (name.trim().length > 64) {
      return NextResponse.json({ error: 'name must be 64 characters or less' }, { status: 400 })
    }

    const validTemplates = ['assistant', 'analyst', 'trader', 'guardian', 'researcher']
    const resolvedTemplate = validTemplates.includes(template) ? template : 'assistant'

    // --- Verify skills exist (if provided) ---
    let skillsToEquip: { id: string; priceUsdc: number; isPro: boolean }[] = []
    if (Array.isArray(skillIds) && skillIds.length > 0) {
      skillsToEquip = await prisma.skill.findMany({
        where: {
          id: { in: skillIds },
          isPublished: true,
        },
        select: { id: true, priceUsdc: true, isPro: true },
      })
      // Only allow free skills to be auto-equipped at creation (paid skills require purchase)
      skillsToEquip = skillsToEquip.filter((s) => !s.isPro || s.priceUsdc === 0)
    }

    // --- Create agent + equip free skills atomically ---
    const agent = await prisma.$transaction(async (tx) => {
      const newAgent = await tx.agent.create({
        data: {
          ownerAddress: ownerAddress.toLowerCase(),
          name: name.trim(),
          description: description?.trim() || null,
          avatarUrl: avatarUrl || null,
          template: resolvedTemplate,
          isPublished: false, // Pending first skill equip or manual publish
        },
      })

      // Auto-equip free skills
      if (skillsToEquip.length > 0) {
        await tx.skillEquipment.createMany({
          data: skillsToEquip.map((skill) => ({
            agentId: newAgent.id,
            skillId: skill.id,
            equippedAt: new Date(),
          })),
          skipDuplicates: true,
        })

        // Update install counts on skills
        await tx.skill.updateMany({
          where: { id: { in: skillsToEquip.map((s) => s.id) } },
          data: { totalInstalls: { increment: 1 } },
        })
      }

      return tx.agent.findUniqueOrThrow({
        where: { id: newAgent.id },
        include: {
          equippedSkills: {
            include: {
              skill: {
                select: { id: true, name: true, category: true, priceUsdc: true, creatorAvatar: true },
              },
            },
          },
        },
      })
    })

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        ownerAddress: agent.ownerAddress,
        name: agent.name,
        description: agent.description,
        avatarUrl: agent.avatarUrl,
        template: agent.template,
        rank: agent.rank,
        level: agent.level,
        xp: agent.xp,
        trustScore: agent.trustScore,
        isPublished: agent.isPublished,
        equippedSkills: (agent.equippedSkills as Array<{ skillId: string; skill: { name: string; category: string; priceUsdc: number } }>).map((e) => ({
          id: e.skillId,
          name: e.skill.name,
          category: e.skill.category,
          priceUsdc: e.skill.priceUsdc,
        })),
        createdAt: agent.createdAt,
        // Phase 2: erc8004Id + erc6551Tba will be populated after on-chain mint
        onChain: null,
      },
    }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/agents/create]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
