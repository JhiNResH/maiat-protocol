import { NextRequest, NextResponse } from 'next/server'
import { getRecentAlerts, getAlertStats } from '@/lib/wadjet-scan'

export const dynamic = 'force-dynamic'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Maiat-Client',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20'), 100)
    const all = url.searchParams.get('all') === 'true'

    const [alerts, stats] = await Promise.all([
      getRecentAlerts(limit, !all),
      getAlertStats(),
    ])

    return NextResponse.json({ alerts, stats }, { headers: CORS })
  } catch (err) {
    console.error('[Wadjet Alerts API]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: CORS }
    )
  }
}
