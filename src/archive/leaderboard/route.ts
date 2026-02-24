import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const limit = parseInt(searchParams.get('limit') || '10')
  const category = searchParams.get('category') // optional: filter by category

  try {
    const projects = await prisma.project.findMany({
      where: {
        status: 'approved',
        ...(category && { category }),
      },
      orderBy: [
        { avgRating: 'desc' },
        { reviewCount: 'desc' },
      ],
      take: limit,
      select: {
        id: true,
        name: true,
        category: true,
        avgRating: true,
        reviewCount: true,
        image: true,
      },
    })

    return NextResponse.json({ projects })
  } catch (error) {
    console.error('Failed to fetch leaderboard:', error)
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 })
  }
}
