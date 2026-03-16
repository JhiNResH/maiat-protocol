import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { predictRug } from '@/lib/rug-prediction'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params
  const WADJET_API_URL = process.env.WADJET_API_URL

  // ─── Try FastAPI first ────────────────────────────────────────────────────
  if (WADJET_API_URL) {
    try {
      const res = await fetch(`${WADJET_API_URL}/wadjet/${address}`, {
        signal: AbortSignal.timeout(3000),
        headers: { 'Content-Type': 'application/json' },
      })
      if (res.ok) {
        const data = await res.json()
        return NextResponse.json({ ...data, source: 'ml' }, { headers: CORS })
      }
    } catch {
      // fall through to rule-based
    }
  }

  // ─── Fallback: rule-based ─────────────────────────────────────────────────
  try {
    let agent = await prisma.agentScore.findFirst({
      where: { walletAddress: { equals: address.toLowerCase(), mode: 'insensitive' } },
      select: {
        walletAddress: true, trustScore: true, completionRate: true,
        totalJobs: true, tokenAddress: true, tokenSymbol: true, rawMetrics: true,
      },
    })

    if (!agent) {
      agent = await prisma.agentScore.findFirst({
        where: { tokenAddress: { equals: address.toLowerCase(), mode: 'insensitive' } },
        select: {
          walletAddress: true, trustScore: true, completionRate: true,
          totalJobs: true, tokenAddress: true, tokenSymbol: true, rawMetrics: true,
        },
      })
    }

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found', fallback: true },
        { status: 404, headers: CORS }
      )
    }

    const raw = (agent.rawMetrics ?? {}) as Record<string, unknown>
    const prediction = predictRug({
      trustScore: agent.trustScore,
      completionRate: agent.completionRate,
      totalJobs: agent.totalJobs,
      rawMetrics: raw,
    })

    return NextResponse.json(
      {
        address: agent.walletAddress,
        name: typeof raw.name === 'string' ? raw.name : null,
        tokenAddress: agent.tokenAddress,
        tokenSymbol: agent.tokenSymbol,
        prediction,
        cascadeDependencies: [],
        clusterInfo: null,
        source: 'rule-based',
        fallbackNote: WADJET_API_URL
          ? 'Wadjet ML service is offline. Showing rule-based predictions.'
          : 'Wadjet ML service not configured. Showing rule-based predictions.',
      },
      { status: 200, headers: CORS }
    )
  } catch (err) {
    console.error('[Wadjet API]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS })
  }
}
