import { NextResponse } from 'next/server'
import { syncOracleScores } from '@/lib/oracle-updater'

/**
 * POST /api/v1/oracle/sync
 *
 * Manually trigger oracle score sync. Protected by x-internal-token header.
 * Returns { synced: number, txHashes: string[] }
 */
export async function POST(request: Request) {
  const token = request.headers.get('x-internal-token')
  const expected = process.env.INTERNAL_API_TOKEN

  if (!expected || token !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await syncOracleScores()
    return NextResponse.json({
      synced: result.synced,
      txHashes: result.txHashes,
      ...(result.errors.length > 0 && { errors: result.errors }),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[oracle/sync] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
