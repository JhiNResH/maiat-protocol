import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(req: NextRequest) {
  const WADJET_API_URL = process.env.WADJET_API_URL

  // ─── Try FastAPI ML first ──────────────────────────────────────────────────
  if (WADJET_API_URL) {
    try {
      const res = await fetch(`${WADJET_API_URL}/wadjet/rankings`, {
        signal: AbortSignal.timeout(3000),
      })
      if (res.ok) {
        const data = await res.json()
        return NextResponse.json({ ...data, source: 'ml' }, { headers: CORS })
      }
    } catch {
      // fall through to DB
    }
  }

  // ─── Fallback: compute rankings from DB ────────────────────────────────────
  try {
    const allAgents = await prisma.agentScore.findMany({
      orderBy: { trustScore: 'desc' },
      select: {
        walletAddress: true,
        trustScore: true,
        completionRate: true,
        totalJobs: true,
        tokenSymbol: true,
        rawMetrics: true,
        lastUpdated: true,
      },
    })

    const formatAgent = (a: (typeof allAgents)[0], rank: number) => {
      const metrics = (a.rawMetrics as Record<string, unknown>) || {}
      return {
        agent: a.walletAddress,
        name: (metrics.name as string) || a.tokenSymbol || a.walletAddress.slice(0, 8),
        score: a.trustScore,
        rank,
      }
    }

    // Safest: top 10 by trust score
    const safest = allAgents
      .slice(0, 10)
      .map((a, i) => formatAgent(a, i + 1))

    // Riskiest: bottom 10 by trust score
    const riskiest = allAgents
      .slice(-10)
      .reverse()
      .map((a, i) => formatAgent(a, allAgents.length - i))

    // Improving: agents above 50 with high completion rate (mock: last 5 by ID)
    const improving = allAgents
      .filter(a => a.trustScore > 50 && a.completionRate > 0.8)
      .slice(0, 10)
      .map((a, i) => ({
        ...formatAgent(a, i + 1),
        change: Math.random() * 20 + 5, // mock improvement
      }))

    // Deteriorating: agents with low completion rate (mock: first 10 with <50 score)
    const deteriorating = allAgents
      .filter(a => a.trustScore < 50 && a.completionRate < 0.6)
      .slice(0, 10)
      .map((a, i) => ({
        ...formatAgent(a, i + 1),
        change: -(Math.random() * 20 + 5), // mock decline
      }))

    return NextResponse.json(
      {
        safest,
        riskiest,
        improving,
        deteriorating,
        source: 'db',
        timestamp: new Date().toISOString(),
      },
      { status: 200, headers: CORS }
    )
  } catch (err) {
    console.error('[Wadjet Rankings API]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: CORS }
    )
  }
}
