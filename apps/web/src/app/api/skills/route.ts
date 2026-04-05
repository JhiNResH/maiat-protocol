import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/skills
 *
 * Browse the Dojo skill marketplace.
 *
 * Query params:
 *   search?:   full-text filter on name/description/tags
 *   category?: "analysis" | "trading" | "monitoring" | "security" | ...
 *   sort?:     "popular" (default) | "newest" | "rating" | "price_asc" | "price_desc" | "free"
 *   limit?:    max 100 (default 24)
 *   offset?:   pagination offset (default 0)
 *   featured?: "true" — only featured skills
 *   free?:     "true" — only free skills
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const search = searchParams.get('search')?.trim() || ''
    const category = searchParams.get('category') || ''
    const sort = searchParams.get('sort') || 'popular'
    const limit = Math.min(parseInt(searchParams.get('limit') || '24'), 100)
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'))
    const featuredOnly = searchParams.get('featured') === 'true'
    const freeOnly = searchParams.get('free') === 'true'

    // --- Build where clause ---
    type WhereClause = {
      isPublished: boolean
      isFeatured?: boolean
      priceUsdc?: number
      category?: { equals: string; mode: 'insensitive' }
      OR?: Array<{
        name?: { contains: string; mode: 'insensitive' }
        description?: { contains: string; mode: 'insensitive' }
        tags?: { has: string }
      }>
    }

    const where: WhereClause = { isPublished: true }
    if (featuredOnly) where.isFeatured = true
    if (freeOnly) where.priceUsdc = 0
    if (category) where.category = { equals: category, mode: 'insensitive' }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { has: search.toLowerCase() } },
      ]
    }

    // --- Build orderBy ---
    type OrderBy =
      | { totalPurchases: 'desc' }
      | { createdAt: 'desc' }
      | { avgRating: 'desc' }
      | { priceUsdc: 'asc' }
      | { priceUsdc: 'desc' }

    const orderByMap: Record<string, OrderBy> = {
      popular: { totalPurchases: 'desc' },
      newest: { createdAt: 'desc' },
      rating: { avgRating: 'desc' },
      price_asc: { priceUsdc: 'asc' },
      price_desc: { priceUsdc: 'desc' },
      free: { priceUsdc: 'asc' },
    }
    const orderBy: OrderBy = orderByMap[sort] ?? { totalPurchases: 'desc' }

    const [skills, total] = await Promise.all([
      prisma.skill.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          tags: true,
          priceUsdc: true,
          isPro: true,
          isFeatured: true,
          creatorAddress: true,
          creatorName: true,
          creatorAvatar: true,
          totalPurchases: true,
          totalInstalls: true,
          avgRating: true,
          reviewCount: true,
          royaltyPercent: true,
          createdAt: true,
        },
      }),
      prisma.skill.count({ where }),
    ])

    // --- Aggregate categories for filter UI ---
    const categories = await prisma.skill.groupBy({
      by: ['category'],
      where: { isPublished: true },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    })

    return NextResponse.json({
      skills,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      meta: {
        categories: categories.map((c) => ({ name: c.category, count: c._count.id })),
      },
    })
  } catch (err) {
    console.error('[GET /api/skills]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
