import { NextRequest, NextResponse } from 'next/server'
import { getAddress } from 'viem'
import { getBalance } from '@/lib/scarab'

/**
 * GET /api/v1/scarab/status?address=0x...
 *
 * Returns whether the user has already claimed today (no auth required).
 * Used by the frontend to skip the signature prompt when not needed.
 */
export async function GET(req: NextRequest) {
  try {
    const raw = req.nextUrl.searchParams.get('address')
    if (!raw) {
      return NextResponse.json({ error: 'Missing address' }, { status: 400 })
    }

    let address: string
    try {
      address = getAddress(raw)
    } catch {
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
    }

    const bal = await getBalance(address)

    const now = new Date()
    const lastClaim = bal.lastClaimAt ? new Date(bal.lastClaimAt) : null
    const claimedToday = lastClaim
      ? lastClaim.getUTCFullYear() === now.getUTCFullYear() &&
        lastClaim.getUTCMonth() === now.getUTCMonth() &&
        lastClaim.getUTCDate() === now.getUTCDate()
      : false

    return NextResponse.json({
      claimedToday,
      balance: bal.balance,
      streak: bal.streak,
    })
  } catch (err) {
    console.error('[GET /api/v1/scarab/status]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
