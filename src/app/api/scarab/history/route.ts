import { NextRequest, NextResponse } from 'next/server'
import { getTransactionHistory } from '@/lib/scarab'

/**
 * GET /api/scarab/history?address=0x...&limit=20&offset=0
 * 
 * Returns Scarab transaction history
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const address = searchParams.get('address')
  const limit = parseInt(searchParams.get('limit') ?? '20')
  const offset = parseInt(searchParams.get('offset') ?? '0')

  if (!address) {
    return NextResponse.json({ error: 'address is required' }, { status: 400 })
  }

  try {
    const history = await getTransactionHistory(address, limit, offset)

    return NextResponse.json({
      address: address.toLowerCase(),
      ...history,
    })
  } catch (error) {
    console.error('Error fetching history:', error)
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
  }
}
