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
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '100')
  const offset = parseInt(req.nextUrl.searchParams.get('offset') ?? '0')

  // ─── Try FastAPI ML first ──────────────────────────────────────────────────
  if (WADJET_API_URL) {
    try {
      const res = await fetch(
        `${WADJET_API_URL}/wadjet/agents?limit=${limit}&offset=${offset}`,
        { signal: AbortSignal.timeout(3000) }
      )
      if (res.ok) {
        const data = await res.json()
        return NextResponse.json(
          { ...data, source: 'ml' },
          { headers: CORS }
        )
      }
    } catch {
      // fall through to DB
    }
  }

  // ─── Fallback: all agents from DB ──────────────────────────────────────────
  try {
    const agents = await prisma.agentScore.findMany({
      skip: offset,
      take: limit,
      orderBy: { trustScore: 'desc' },
      select: {
        walletAddress: true,
        trustScore: true,
        completionRate: true,
        totalJobs: true,
        tokenSymbol: true,
        rawMetrics: true,
        updatedAt: true,
      },
    })

    const total = await prisma.agentScore.count()

    const formattedAgents = agents.map(a => {
      const metrics = (a.rawMetrics as Record<string, unknown>) || {}
      return {
        address: a.walletAddress,
        name: (metrics.name as string) || a.tokenSymbol || a.walletAddress.slice(0, 8),
        trustScore: a.trustScore,
        completionRate: a.completionRate,
        totalJobs: a.totalJobs,
        updated_at: a.updatedAt?.toISOString() || new Date().toISOString(),
        // Mock risk predictions for UI (would come from ML model)
        riskPrediction: {
          '7_days': Math.max(0, a.trustScore - Math.random() * 5),
          '30_days': Math.max(0, a.trustScore - Math.random() * 10),
          '90_days': Math.max(0, a.trustScore - Math.random() * 15),
          confidence: 0.92,
        },
        categories: {
          smart_contract: Math.random() * 100,
          market_volatility: Math.random() * 100,
          operational: Math.random() * 100,
          regulatory: Math.random() * 100,
        },
      }
    })

    return NextResponse.json(
      {
        agents: formattedAgents,
        total,
        limit,
        offset,
        source: 'db',
      },
      { status: 200, headers: CORS }
    )
  } catch (err) {
    console.error('[Wadjet Agents API]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: CORS }
    )
  }
}
