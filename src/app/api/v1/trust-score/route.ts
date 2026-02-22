/**
 * POST /api/v1/trust-score
 * 
 * Open API — any agent or app can query trust scores.
 * No SDK required. Just HTTP.
 * 
 * Free tier: 100 req/day per API key
 * x402 tier: pay-per-query with USDC
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, reviewSubmitLimiter } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, projectName, agentAddress } = body

    if (!projectId && !projectName && !agentAddress) {
      return NextResponse.json({
        error: 'Provide projectId, projectName, or agentAddress',
        docs: 'https://docs.maiat.xyz/api/trust-score'
      }, { status: 400 })
    }

    // Rate limit by API key or IP
    const apiKey = request.headers.get('x-api-key')
    const identifier = apiKey || request.headers.get('x-forwarded-for') || 'anonymous'
    
    const { success } = await checkRateLimit(reviewSubmitLimiter, identifier)
    if (!success) {
      return NextResponse.json({
        error: 'Rate limit exceeded. Get an API key at https://maiat.xyz or use x402 payment.',
        retryAfter: 60
      }, { status: 429 })
    }

    // Find project
    let project
    if (projectId) {
      project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { reviews: { where: { status: 'active' }, take: 5, orderBy: { createdAt: 'desc' } } }
      })
    } else if (projectName) {
      project = await prisma.project.findFirst({
        where: { name: { contains: projectName, mode: 'insensitive' } },
        include: { reviews: { where: { status: 'active' }, take: 5, orderBy: { createdAt: 'desc' } } }
      })
    } else if (agentAddress) {
      project = await prisma.project.findFirst({
        where: { address: agentAddress.toLowerCase() },
        include: { reviews: { where: { status: 'active' }, take: 5, orderBy: { createdAt: 'desc' } } }
      })
    }

    if (!project) {
      return NextResponse.json({
        found: false,
        trustScore: null,
        message: 'No trust data found. Submit this project at https://maiat.xyz'
      }, { status: 404 })
    }

    // Calculate trust breakdown
    const verifiedReviews = project.reviews.filter((r: any) => r.verified)
    
    return NextResponse.json({
      found: true,
      project: {
        id: project.id,
        name: project.name,
        category: project.category,
      },
      trustScore: {
        overall: project.avgRating ? Math.round(project.avgRating * 20) : null,
        reviewCount: project.reviewCount || 0,
        verifiedCount: verifiedReviews.length,
        avgRating: project.avgRating,
      },
      recommendation: getRecommendation(project.avgRating, project.reviewCount || 0),
      timestamp: new Date().toISOString(),
      attestation: {
        chain: 'base-sepolia',
        oracle: '0x115Ab8cEdb7A362e3a7Da03582108d6AF990F21F',
      }
    })

  } catch (error: any) {
    console.error('[TrustScore API] Error:', error.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function getRecommendation(avgRating: number | null, reviewCount: number): string {
  if (!avgRating || reviewCount < 3) return 'INSUFFICIENT_DATA'
  if (avgRating >= 4.0) return 'TRUSTED'
  if (avgRating >= 3.0) return 'NEUTRAL'
  if (avgRating >= 2.0) return 'CAUTION'
  return 'HIGH_RISK'
}
