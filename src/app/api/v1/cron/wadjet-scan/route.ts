import { NextRequest, NextResponse } from 'next/server'
import { runWadjetScan } from '@/lib/wadjet-scan'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 min max for Vercel

const CRON_SECRET = process.env.CRON_SECRET

export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel Cron or manual trigger)
  const auth = req.headers.get('authorization')
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runWadjetScan(true)

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[Wadjet Scan Cron]', err)
    return NextResponse.json(
      { error: 'Scan failed', message: (err as Error).message },
      { status: 500 }
    )
  }
}
