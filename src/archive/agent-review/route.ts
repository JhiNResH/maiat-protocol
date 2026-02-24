/**
 * POST /api/agent-review
 * 
 * AI Agent submits a review for a project.
 * Uses Privy server wallet for signing.
 * Reviews are tagged with 🤖 agent badge.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAgentWallet, agentSign } from '@/lib/agent-wallet'
import { analyzeProject } from '@/app/actions/analyze'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, projectName } = body

    if (!projectId && !projectName) {
      return NextResponse.json({ error: 'projectId or projectName required' }, { status: 400 })
    }

    // 1. Find the project
    let project
    if (projectId) {
      project = await prisma.project.findUnique({ where: { id: projectId } })
    } else {
      project = await prisma.project.findFirst({ 
        where: { name: { contains: projectName } } 
      })
    }

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // 2. Get agent wallet
    const wallet = await getAgentWallet()

    // 3. AI analysis via Gemini
    const analysis = await analyzeProject(project.name)

    // 4. Generate review content from analysis
    const rating = Math.min(5, Math.max(1, Math.round(analysis.score / 20)))
    const content = generateAgentReviewContent(analysis)

    // 5. Sign the review
    const contentHash = `${project.address}:${rating}:${content}`
    const signature = await agentSign(contentHash)

    // 6. Get or create agent user
    let agentUser = await prisma.user.findUnique({ 
      where: { address: wallet.address.toLowerCase() } 
    })
    if (!agentUser) {
      agentUser = await prisma.user.create({
        data: {
          address: wallet.address.toLowerCase(),
          displayName: '🤖 Maiat Agent',
          reputationScore: 1000,
        }
      })
    }

    // 7. Create the review
    const review = await prisma.review.create({
      data: {
        rating,
        content,
        status: 'active',
        reviewerId: agentUser.id,
        projectId: project.id,
      }
    })

    // 8. Update project stats
    const reviews = await prisma.review.findMany({ where: { projectId: project.id } })
    const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    await prisma.project.update({
      where: { id: project.id },
      data: { avgRating: Math.round(avg * 10) / 10, reviewCount: reviews.length }
    })

    return NextResponse.json({
      success: true,
      review: {
        id: review.id,
        rating,
        content,
        agentAddress: wallet.address,
        signature,
        analysis: {
          score: analysis.score,
          status: analysis.status,
          features: analysis.features,
          warnings: analysis.warnings,
        }
      }
    })

  } catch (error: any) {
    console.error('[AgentReview] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function generateAgentReviewContent(analysis: any): string {
  const parts = []
  
  parts.push(`**Agent Analysis: ${analysis.name}** (Score: ${analysis.score}/100, Status: ${analysis.status})`)
  parts.push('')
  parts.push(analysis.summary)
  
  if (analysis.features?.length > 0) {
    parts.push('')
    parts.push(`**Strengths:** ${analysis.features.slice(0, 3).join(', ')}`)
  }
  
  if (analysis.warnings?.length > 0) {
    parts.push('')
    parts.push(`**Risks:** ${analysis.warnings.slice(0, 3).join(', ')}`)
  }
  
  parts.push('')
  parts.push(`_Verified via ${analysis.chain?.join(', ') || 'multi-chain'} data. Powered by Maiat AI._`)
  
  return parts.join('\n')
}
