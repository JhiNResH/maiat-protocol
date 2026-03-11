import { NextRequest, NextResponse } from 'next/server'
import { predictAgent } from '@/lib/wadjet-client'

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
    const result = await predictAgent(address)

    return NextResponse.json(
      {
        address: result.address,
        name: result.name ?? null,
        prediction: {
          rugScore: Math.round(result.rug_probability * 100),
          riskLevel: result.risk_level,
          confidence: result.confidence,
          signals: result.features ? Object.entries(result.features).map(([k, v]) => ({
            name: k,
            weight: 0,
            value: String(v),
            severity: 'info' as const,
          })) : [],
          summary: `Risk level: ${result.risk_level}. Rug probability: ${(result.rug_probability * 100).toFixed(1)}%.`,
          predictedAt: new Date().toISOString(),
        },
        meta: {
          model: 'wadjet-xgboost-v2',
          dataSource: 'Wadjet Service (ACP_BEHAVIORAL + DexScreener + Chain Data)',
          serviceUrl: 'wadjet-production.up.railway.app',
        },
      },
      { status: 200, headers: CORS }
    )
  } catch (err) {
    console.error('[Agent Rug Prediction API → Wadjet]', err)
    return NextResponse.json(
      { error: 'Wadjet service unavailable', detail: (err as Error).message },
      { status: 502, headers: CORS }
    )
  }
}
