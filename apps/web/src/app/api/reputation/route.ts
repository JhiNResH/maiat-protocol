import { NextRequest, NextResponse } from 'next/server'
import { getUserReputation } from '@/lib/reputation'

export const dynamic = 'force-dynamic'

/**
 * GET /api/reputation?address=0x...
 * Returns user reputation score, trust level, and fee tier
 */
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address')
  if (!address) {
    return NextResponse.json({ error: 'Missing address parameter' }, { status: 400 })
  }

  try {
    const rep = await getUserReputation(address)
    return NextResponse.json(rep)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
