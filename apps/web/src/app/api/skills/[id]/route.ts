import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/skills/[id]
 *
 * Fetch full skill detail, including reviews and related skills.
 * skillMarkdown is only returned if:
 *   (a) skill is free, OR
 *   (b) request includes ?buyerAddress=0x... and they have a completed purchase
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const buyerAddress = request.nextUrl.searchParams.get('buyerAddress')?.toLowerCase()

    const skill = await prisma.skill.findUnique({
      where: { id },
      include: {
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            rating: true,
            comment: true,
            reviewerAddress: true,
            createdAt: true,
          },
        },
      },
    })

    if (!skill || !skill.isPublished) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 })
    }

    // --- Check if buyer has purchased (for paid skills) ---
    let hasPurchased = false
    if (buyerAddress) {
      if (skill.priceUsdc === 0 || !skill.isPro) {
        hasPurchased = true
      } else {
        const purchase = await prisma.skillPurchase.findFirst({
          where: {
            skillId: id,
            buyerAddress,
            status: 'completed',
          },
        })
        hasPurchased = !!purchase
      }
    }

    // --- Related skills (same category, excluding this one) ---
    const related = await prisma.skill.findMany({
      where: {
        isPublished: true,
        category: skill.category,
        id: { not: id },
      },
      orderBy: { totalPurchases: 'desc' },
      take: 4,
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        priceUsdc: true,
        isPro: true,
        creatorAvatar: true,
        avgRating: true,
        totalPurchases: true,
        creatorName: true,
      },
    })

    return NextResponse.json({
      skill: {
        id: skill.id,
        erc1155Id: skill.erc1155Id,
        name: skill.name,
        description: skill.description,
        category: skill.category,
        tags: skill.tags,
        priceUsdc: skill.priceUsdc,
        isPro: skill.isPro,
        isFeatured: skill.isFeatured,
        skillMarkdownUrl: skill.skillMarkdownUrl,
        // Only include raw markdown if buyer has access
        skillMarkdown: hasPurchased || skill.priceUsdc === 0 ? skill.skillMarkdown : null,
        creatorAddress: skill.creatorAddress,
        creatorName: skill.creatorName,
        creatorAvatar: skill.creatorAvatar,
        totalPurchases: skill.totalPurchases,
        totalInstalls: skill.totalInstalls,
        avgRating: skill.avgRating,
        reviewCount: skill.reviewCount,
        royaltyPercent: skill.royaltyPercent,
        reviews: skill.reviews,
        hasPurchased,
        createdAt: skill.createdAt,
        updatedAt: skill.updatedAt,
      },
      related,
    })
  } catch (err) {
    console.error('[GET /api/skills/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
