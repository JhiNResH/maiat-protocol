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

/** Simulate survival under stress scenarios using rule-based heuristics. */
function generateScenarios(rugScore: number, trustScore: number, completionRate: number) {
  const resilience = Math.max(0, 100 - rugScore)
  const base = resilience / 100

  return [
    {
      name: 'Flash Crash -50%',
      description: 'Token price drops 50% in under 1 hour',
      survivalRate: Math.round(Math.max(5, base * 0.6 * 100)),
    },
    {
      name: 'LP Drain Attack',
      description: 'Coordinated liquidity removal attempt',
      survivalRate: Math.round(Math.max(5, base * 0.55 * 100)),
    },
    {
      name: 'Creator Wallet Dump',
      description: 'Deployer wallet sells entire position',
      survivalRate: Math.round(Math.max(5, base * 0.65 * 100)),
    },
    {
      name: 'Completion Collapse',
      description: 'Job completion rate drops below 10%',
      survivalRate: Math.round(Math.max(5, completionRate * 0.8 * 100)),
    },
    {
      name: 'Trust Score Cliff',
      description: 'Trust score drops to critical threshold (<20)',
      survivalRate: Math.round(Math.max(5, (trustScore / 100) * 0.7 * 100)),
    },
    {
      name: 'Cascade Contagion',
      description: 'Connected agents in cluster default simultaneously',
      survivalRate: Math.round(Math.max(5, base * 0.45 * 100)),
    },
    {
      name: 'Regulatory Sweep',
      description: 'Exchange delistings + regulatory pressure',
      survivalRate: Math.round(Math.max(5, base * 0.75 * 100)),
    },
  ]
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
      const res = await fetch(`${WADJET_API_URL}/wadjet/${address}/scenarios`, {
        signal: AbortSignal.timeout(3000),
      })
      if (res.ok) {
        const data = await res.json()
        return NextResponse.json({ ...data, source: 'ml' }, { headers: CORS })
      }
    } catch {
      // fall through
    }
  }

  // ─── Fallback: generate from rule-based prediction ────────────────────────
  try {
    let agent = await prisma.agentScore.findFirst({
      where: { walletAddress: { equals: address.toLowerCase(), mode: 'insensitive' } },
      select: { trustScore: true, completionRate: true, totalJobs: true, rawMetrics: true },
    })

    if (!agent) {
      agent = await prisma.agentScore.findFirst({
        where: { tokenAddress: { equals: address.toLowerCase(), mode: 'insensitive' } },
        select: { trustScore: true, completionRate: true, totalJobs: true, rawMetrics: true },
      })
    }

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404, headers: CORS })
    }

    const raw = (agent.rawMetrics ?? {}) as Record<string, unknown>
    const prediction = predictRug({
      trustScore: agent.trustScore,
      completionRate: agent.completionRate,
      totalJobs: agent.totalJobs,
      rawMetrics: raw,
    })

    const scenarios = generateScenarios(
      prediction.rugScore,
      agent.trustScore,
      agent.completionRate
    )

    return NextResponse.json(
      { scenarios, source: 'rule-based' },
      { status: 200, headers: CORS }
    )
  } catch (err) {
    console.error('[Wadjet Scenarios API]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS })
  }
}
