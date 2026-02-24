import { NextRequest, NextResponse } from 'next/server'
import { getBalance, getTransactionHistory } from '@/lib/scarab'

/**
 * GET /api/scarab/balance?address=0x...&history=true&limit=20
 * 
 * Returns Scarab balance + optional transaction history
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const address = searchParams.get('address')
  const includeHistory = searchParams.get('history') === 'true'
  const limit = parseInt(searchParams.get('limit') ?? '20')

  if (!address) {
    return NextResponse.json({ error: 'address is required' }, { status: 400 })
  }

  try {
    const balance = await getBalance(address)
    
    let history = undefined
    if (includeHistory) {
      history = await getTransactionHistory(address, limit)
    }

    return NextResponse.json({
      address: address.toLowerCase(),
      balance: balance.balance,
      totalEarned: balance.totalEarned,
      totalSpent: balance.totalSpent,
      totalPurchased: balance.totalPurchased,
      lastClaimAt: balance.lastClaimAt,
      streak: balance.streak,
      ...(history && { history }),
    })
  } catch (error) {
    console.error('Error fetching balance:', error)
    return NextResponse.json({ error: 'Failed to fetch balance' }, { status: 500 })
  }
}
