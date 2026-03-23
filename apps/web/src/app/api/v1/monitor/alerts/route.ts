import { NextResponse } from 'next/server'
import { getAlerts, getRiskSummary } from '@/lib/wadjet-client'

export const dynamic = 'force-dynamic'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Maiat-Client',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET() {
  try {
    const [alerts, summary] = await Promise.all([
      getAlerts(),
      getRiskSummary(),
    ])

    return NextResponse.json({ alerts, stats: summary }, { headers: CORS })
  } catch (err) {
    console.error('[Alerts API → Wadjet]', err)
    return NextResponse.json(
      { error: 'Wadjet service unavailable', alerts: [], stats: {} },
      { status: 502, headers: CORS }
    )
  }
}
