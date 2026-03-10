import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { predictRug } from '@/lib/rug-prediction'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Maiat-Client, X-Maiat-Key',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params
  if (!address) {
    return NextResponse.json({ error: 'Address required' }, { status: 400, headers: CORS })
  }

  try {
    // Try wallet address first, then fall back to token address lookup
    let agent = await prisma.agentScore.findFirst({
      where: {
        walletAddress: { equals: address.toLowerCase(), mode: 'insensitive' },
      },
      select: {
        walletAddress: true,
        trustScore: true,
        completionRate: true,
        totalJobs: true,
        tokenAddress: true,
        tokenSymbol: true,
        rawMetrics: true,
      },
    })

    // Reverse lookup: if not found by wallet, try by token address
    if (!agent) {
      agent = await prisma.agentScore.findFirst({
        where: {
          tokenAddress: { equals: address.toLowerCase(), mode: 'insensitive' },
        },
        select: {
          walletAddress: true,
          trustScore: true,
          completionRate: true,
          totalJobs: true,
          tokenAddress: true,
          tokenSymbol: true,
          rawMetrics: true,
        },
      })
    }

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404, headers: CORS })
    }

    const raw = (agent.rawMetrics ?? {}) as Record<string, unknown>
    const name = typeof raw.name === 'string' ? raw.name : null

    const prediction = predictRug({
      trustScore: agent.trustScore,
      completionRate: agent.completionRate,
      totalJobs: agent.totalJobs,
      rawMetrics: raw,
    })

    return NextResponse.json(
      {
        address: agent.walletAddress,
        name,
        tokenAddress: agent.tokenAddress,
        tokenSymbol: agent.tokenSymbol,
        prediction,
        meta: {
          model: 'wadjet-rules-v1',  // will upgrade to wadjet-xgboost-v1 later
          dataSource: 'ACP_BEHAVIORAL + DexScreener + Wadjet Health Signals',
          note: 'Rule-based prediction. ML model upgrade planned.',
        },
      },
      { status: 200, headers: CORS }
    )
  } catch (err) {
    console.error('[Rug Prediction API]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: CORS }
    )
  }
}
