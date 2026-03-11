import { NextRequest, NextResponse } from 'next/server'
import { fetchDexScreenerData, predictTokenRug } from '@/lib/rug-prediction'

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
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json(
      { error: 'Valid token address required (0x...)' },
      { status: 400, headers: CORS }
    )
  }

  try {
    const pairs = await fetchDexScreenerData(address)
    const prediction = predictTokenRug(pairs)

    // Extract token info from primary pair
    const primary = pairs.length > 0
      ? pairs.reduce((best, p) => (p.liquidity?.usd ?? 0) > (best.liquidity?.usd ?? 0) ? p : best, pairs[0])
      : null

    return NextResponse.json(
      {
        address,
        name: primary?.baseToken?.name ?? null,
        symbol: primary?.baseToken?.symbol ?? null,
        priceUsd: primary?.priceUsd ?? null,
        marketCap: primary?.marketCap ?? primary?.fdv ?? null,
        liquidity: pairs.reduce((sum, p) => sum + (p.liquidity?.usd ?? 0), 0),
        volume24h: pairs.reduce((sum, p) => sum + (p.volume?.h24 ?? 0), 0),
        pairsFound: pairs.length,
        prediction,
        meta: {
          model: 'wadjet-dex-v1',
          dataSource: 'DexScreener Real-Time (Base)',
          note: 'Real-time token analysis using DEX trading data. No DB dependency — works for any token on Base.',
        },
      },
      { status: 200, headers: CORS }
    )
  } catch (err) {
    console.error('[Token Rug Prediction API]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: CORS }
    )
  }
}
