import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/reviews/[id]/vote
 * Vote on a review (upvote or downvote)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await request.json()
    const { voterAddress, direction } = body // direction: "up" | "down"
    
    if (!voterAddress || !['up', 'down'].includes(direction)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    
    const review = await prisma.review.findUnique({
      where: { id },
    })
    
    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { address: voterAddress.toLowerCase() },
    })
    if (!user) {
      user = await prisma.user.create({
        data: {
          address: voterAddress.toLowerCase(),
          displayName: voterAddress.substring(0, 10),
        },
      })
    }

    // Check if user already voted
    const existingVote = await prisma.vote.findUnique({
      where: {
        voterId_reviewId: {
          voterId: user.id,
          reviewId: id,
        },
      },
    })

    if (existingVote) {
      // If same direction, remove vote
      if (existingVote.direction === direction) {
        await prisma.vote.delete({
          where: { id: existingVote.id },
        })
        
        await prisma.review.update({
          where: { id },
          data: {
            upvotes: direction === 'up' ? { decrement: 1 } : undefined,
            downvotes: direction === 'down' ? { decrement: 1 } : undefined,
          },
        })
      } else {
        // Change vote direction
        await prisma.vote.update({
          where: { id: existingVote.id },
          data: { direction },
        })
        
        await prisma.review.update({
          where: { id },
          data: {
            upvotes: direction === 'up' ? { increment: 1 } : { decrement: 1 },
            downvotes: direction === 'down' ? { increment: 1 } : { decrement: 1 },
          },
        })
      }
    } else {
      // Create new vote
      await prisma.vote.create({
        data: {
          voterId: user.id,
          reviewId: id,
          direction,
        },
      })
      
      await prisma.review.update({
        where: { id },
        data: {
          upvotes: direction === 'up' ? { increment: 1 } : undefined,
          downvotes: direction === 'down' ? { increment: 1 } : undefined,
        },
      })
    }

    const updatedReview = await prisma.review.findUnique({
      where: { id },
    })
    
    return NextResponse.json({
      id: updatedReview!.id,
      upvotes: updatedReview!.upvotes,
      downvotes: updatedReview!.downvotes,
      netScore: updatedReview!.upvotes - updatedReview!.downvotes,
    })
  } catch (error) {
    console.error('Error updating vote:', error)
    return NextResponse.json({ error: 'Failed to update vote' }, { status: 500 })
  }
}
