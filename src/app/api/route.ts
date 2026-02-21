import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyUsage } from '@/lib/usage-proof'

export const dynamic = 'force-dynamic'

// POST /api/reviews — Submit a new review
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, projectSlug, address, rating, content, skipProof } = body

    if ((!projectId && !projectSlug) || !address || !rating) {
      return NextResponse.json({ error: 'projectId/projectSlug, address, and rating are required' }, { status: 400 })
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be 1-5' }, { status: 400 })
    }

    // Get or create user
    const lowerAddress = address.toLowerCase()
    let user = await prisma.user.findUnique({ where: { address: lowerAddress } })
    if (!user) {
      user = await prisma.user.create({
        data: { address: lowerAddress, displayName: `${lowerAddress.slice(0, 6)}...${lowerAddress.slice(-4)}` }
      })
    }

    // Check project exists (support both id and slug)
    const project = projectId
      ? await prisma.project.findUnique({ where: { id: projectId } })
      : await prisma.project.findFirst({ where: { OR: [{ slug: projectSlug }, { name: { equals: projectSlug, mode: 'insensitive' } }] } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Verify on-chain usage proof (skip in dev/demo mode)
    if (!skipProof && process.env.REQUIRE_USAGE_PROOF !== 'false') {
      const proof = await verifyUsage(lowerAddress, project.address, project.category)
      if (!proof.verified) {
        return NextResponse.json({
          error: 'Usage proof required',
          message: 'You must have on-chain interaction with this project to write a review',
          details: proof.details,
          hint: `No transactions found between ${lowerAddress} and ${project.address}`,
        }, { status: 403 })
      }
    }

    // Deduct Scarab (optional — skip if no balance record)
    const scarabCost = 2
    const balance = await prisma.scarabBalance.findUnique({ where: { address: lowerAddress } })
    if (balance && balance.balance >= scarabCost) {
      await prisma.scarabBalance.update({
        where: { address: lowerAddress },
        data: { 
          balance: { decrement: scarabCost },
          totalSpent: { increment: scarabCost },
        }
      })
      await prisma.scarabTransaction.create({
        data: {
          address: lowerAddress,
          amount: -scarabCost,
          type: 'review_spend',
          description: `Review on ${project.name}`,
          balanceAfter: balance.balance - scarabCost,
        }
      })
    }

    // Create review (use project.id from lookup to handle both projectId and projectSlug cases)
    const review = await prisma.review.create({
      data: {
        rating,
        content: content || '',
        status: 'active',
        reviewerId: user.id,
        projectId: project.id,
      },
      include: {
        reviewer: { select: { address: true, displayName: true } },
        project: { select: { name: true } },
      }
    })

    // Update project stats
    const allProjectReviews = await prisma.review.findMany({ where: { projectId: project.id } })
    const avg = allProjectReviews.reduce((sum, r) => sum + r.rating, 0) / allProjectReviews.length
    await prisma.project.update({
      where: { id: project.id },
      data: { avgRating: Math.round(avg * 10) / 10, reviewCount: allProjectReviews.length }
    })

    // Update user stats
    await prisma.user.update({
      where: { id: user.id },
      data: { totalReviews: { increment: 1 } }
    })

    return NextResponse.json({ success: true, review })
  } catch (error: any) {
    console.error('Failed to create review:', error)
    return NextResponse.json({ error: error.message || 'Failed to create review' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const sort = searchParams.get('sort') || 'hot'
  const limit = parseInt(searchParams.get('limit') || '20')

  try {
    let reviews

    switch (sort) {
      case 'new':
        reviews = await prisma.review.findMany({
          where: { status: 'active' },
          orderBy: { createdAt: 'desc' },
          take: limit,
          include: {
            reviewer: {
              select: {
                id: true,
                address: true,
                displayName: true,
                avatarUrl: true,
              },
            },
            project: {
              select: {
                id: true,
                name: true,
                image: true,
                category: true,
              },
            },
          },
        })
        break

      case 'top':
        reviews = await prisma.review.findMany({
          where: { status: 'active' },
          orderBy: { upvotes: 'desc' },
          take: limit,
          include: {
            reviewer: {
              select: {
                id: true,
                address: true,
                displayName: true,
                avatarUrl: true,
              },
            },
            project: {
              select: {
                id: true,
                name: true,
                image: true,
                category: true,
              },
            },
          },
        })
        break

      case 'hot':
      default:
        // Hot = upvotes - downvotes, with recent bias
        const allReviews = await prisma.review.findMany({
          where: { status: 'active' },
          include: {
            reviewer: {
              select: {
                id: true,
                address: true,
                displayName: true,
                avatarUrl: true,
              },
            },
            project: {
              select: {
                id: true,
                name: true,
                image: true,
                category: true,
              },
            },
          },
        })

        // Calculate hot score: (upvotes - downvotes) / (days_old + 1)
        reviews = allReviews
          .map((r) => {
            const daysOld = (Date.now() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24)
            const netVotes = r.upvotes - r.downvotes
            const hotScore = netVotes / (daysOld + 1)
            return { ...r, hotScore }
          })
          .sort((a, b) => b.hotScore - a.hotScore)
          .slice(0, limit)
        break
    }

    return NextResponse.json({ reviews })
  } catch (error) {
    console.error('Failed to fetch reviews:', error)
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 })
  }
}
