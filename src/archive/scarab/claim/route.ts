import { NextRequest, NextResponse } from 'next/server'
import { claimDaily } from '@/lib/scarab'

/**
 * POST /api/scarab/claim
 * Body: { address: string, boost?: boolean }
 * 
 * Claim daily Scarab. First claim gives 20, subsequent daily claims give 5+streak.
 * Boost=true doubles the amount (first-week promo).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { address, boost } = body

    if (!address || typeof address !== 'string') {
      return NextResponse.json({ error: 'address is required' }, { status: 400 })
    }

    const result = await claimDaily(address, boost ?? false)

    return NextResponse.json({
      success: true,
      ...result,
      message: result.isFirstClaim
        ? `Welcome! You received ${result.amount} Scarab 🪲`
        : `Claimed ${result.amount} Scarab 🪲 (streak: ${result.streak} days)`,
    })
  } catch (error: any) {
    if (error.message === 'Already claimed today') {
      return NextResponse.json({ error: 'Already claimed today. Come back tomorrow! 🪲' }, { status: 429 })
    }
    console.error('Error claiming Scarab:', error)
    return NextResponse.json({ error: 'Failed to claim Scarab' }, { status: 500 })
  }
}
