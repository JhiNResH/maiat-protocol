/**
 * POST /api/v1/deep-insight
 * 
 * Deep analysis of a project/agent — AI-powered report.
 * Premium endpoint (x402 or API key required).
 * 
 * Returns: detailed trust analysis, risk factors, on-chain data, review summary.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { analyzeProject } from '@/app/actions/analyze'
import { checkRateLimit, reviewSubmitLimiter } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, projectName } = body

    if (!projectId && !projectName) {
      return NextResponse.json({
        error: 'Provide projectId or projectName',
        docs: 'https://docs.maiat.xyz/api/deep-insight'
      }, { status: 400 })
    }

    // Rate limit (stricter for deep insight — 10/day free)
    const apiKey = request.headers.get('x-api-key')
    const identifier = `deep:${apiKey || request.headers.get('x-forwarded-for') || 'anonymous'}`
    
    const { success } = await checkRateLimit(reviewSubmitLimiter, identifier)
    if (!success) {
      return NextResponse.json({
        error: 'Rate limit exceeded for deep insight. Upgrade to x402 payment.',
        retryAfter: 3600
      }, { status: 429 })
    }

    // Find project
    let project
    if (projectId) {
      project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { reviews: { where: { status: 'active' }, orderBy: { createdAt: 'desc' } } }
      })
    } else {
      project = await prisma.project.findFirst({
        where: { name: { contains: projectName, mode: 'insensitive' } },
        include: { reviews: { where: { status: 'active' }, orderBy: { createdAt: 'desc' } } }
      })
    }

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Run AI analysis
    const analysis = await analyzeProject(project.name)

    // Build review summary
    const reviewSummary = {
      total: project.reviews.length,
      verified: project.reviews.filter((r: any) => r.verified).length,
      avgRating: project.avgRating,
      ratingDistribution: getRatingDistribution(project.reviews),
      recentReviews: project.reviews.slice(0, 3).map((r: any) => ({
        rating: r.rating,
        content: r.content?.substring(0, 200),
        verified: r.verified,
        createdAt: r.createdAt,
      }))
    }

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        category: project.category,
        address: project.address,
      },
      analysis: {
        score: analysis.score,
        status: analysis.status,
        summary: analysis.summary,
        features: analysis.features,
        warnings: analysis.warnings,
        chain: analysis.chain,
      },
      reviews: reviewSummary,
      recommendation: getDetailedRecommendation(analysis, reviewSummary),
      timestamp: new Date().toISOString(),
      attestation: {
        chain: 'base-sepolia',
        oracle: '0x115Ab8cEdb7A362e3a7Da03582108d6AF990F21F',
      }
    })

  } catch (error: any) {
    console.error('[DeepInsight API] Error:', error.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function getRatingDistribution(reviews: any[]) {
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  reviews.forEach(r => { if (r.rating >= 1 && r.rating <= 5) dist[r.rating]++ })
  return dist
}

function getDetailedRecommendation(analysis: any, reviews: any) {
  const signals = []
  
  if (analysis.score >= 80) signals.push('HIGH_AI_SCORE')
  else if (analysis.score >= 50) signals.push('MODERATE_AI_SCORE')
  else signals.push('LOW_AI_SCORE')
  
  if (reviews.total >= 10 && reviews.avgRating >= 4) signals.push('STRONG_COMMUNITY')
  else if (reviews.total < 3) signals.push('LOW_REVIEW_COUNT')
  
  if (reviews.verified > reviews.total * 0.5) signals.push('MOSTLY_VERIFIED')
  
  if (analysis.warnings?.length > 2) signals.push('MULTIPLE_WARNINGS')

  return {
    signals,
    verdict: analysis.score >= 70 && reviews.avgRating >= 3.5 ? 'LIKELY_SAFE' :
             analysis.score >= 40 ? 'PROCEED_WITH_CAUTION' : 'HIGH_RISK',
    confidence: reviews.total >= 5 ? 'HIGH' : reviews.total >= 2 ? 'MEDIUM' : 'LOW'
  }
}
