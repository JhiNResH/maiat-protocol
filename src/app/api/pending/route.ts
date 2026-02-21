/**
 * GET /api/reviews/pending
 *
 * Returns pending (unverified) reviews for Chainlink CRE workflow consumption.
 * The CRE trust-score-oracle workflow calls this endpoint every 5 minutes
 * to fetch reviews that need AI verification.
 *
 * Used by: Chainlink CRE & AI track (Convergence hackathon)
 */

import { NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export async function GET() {
  try {
    // Pending = reviews without on-chain verification (no txHash)
    const reviews = await prisma.review.findMany({
      where: {
        txHash: null,
      },
      orderBy: {
        createdAt: "asc",
      },
      take: 50,
      select: {
        id: true,
        projectId: true,
        content: true,
        rating: true,
        createdAt: true,
      },
    })

    const formattedReviews = reviews.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      content: r.content,
      rating: r.rating,
      authorAddress: null,
      createdAt: r.createdAt,
    }))

    return NextResponse.json({
      reviews: formattedReviews,
      count: formattedReviews.length,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error("Pending reviews API error:", err)
    return NextResponse.json({ reviews: [], count: 0 })
  }
}
