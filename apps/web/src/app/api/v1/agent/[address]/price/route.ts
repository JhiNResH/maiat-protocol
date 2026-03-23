import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
    const agent = await prisma.agentScore.findFirst({
      where: {
        walletAddress: { equals: address.toLowerCase(), mode: 'insensitive' },
      },
      select: {
        walletAddress: true,
        tokenAddress: true,
        tokenSymbol: true,
        rawMetrics: true,
      },
    })

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404, headers: CORS })
    }

    const raw = (agent.rawMetrics ?? {}) as Record<string, unknown>
    const priceData = raw.priceData as Record<string, unknown> | undefined
    const name = typeof raw.name === 'string' ? raw.name : null

    if (!priceData) {
      return NextResponse.json(
        {
          address: agent.walletAddress,
          name,
          tokenAddress: agent.tokenAddress,
          tokenSymbol: agent.tokenSymbol,
          price: null,
          message: 'No price data available — agent may not have a token or data is being indexed',
        },
        { status: 200, headers: CORS }
      )
    }

    return NextResponse.json(
      {
        address: agent.walletAddress,
        name,
        tokenAddress: agent.tokenAddress,
        tokenSymbol: agent.tokenSymbol,
        price: {
          usd: priceData.priceUsd ?? null,
          change1h: priceData.priceChange1h ?? null,
          change6h: priceData.priceChange6h ?? null,
          change24h: priceData.priceChange24h ?? null,
          volume24h: priceData.volume24h ?? null,
          liquidity: priceData.liquidity ?? null,
          fdv: priceData.fdv ?? null,
          fetchedAt: priceData.fetchedAt ?? null,
        },
        alert:
          typeof priceData.priceChange24h === 'number' && priceData.priceChange24h <= -30
            ? { level: 'crash', message: `Token dropped ${priceData.priceChange24h}% in 24h` }
            : null,
      },
      { status: 200, headers: CORS }
    )
  } catch (err) {
    console.error('[Price API]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: CORS }
    )
  }
}
