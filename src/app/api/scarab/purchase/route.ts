import { NextRequest, NextResponse } from 'next/server'
import { createPurchase, confirmPurchase, SCARAB_CONFIG } from '@/lib/scarab'

/**
 * POST /api/scarab/purchase
 * Body: { address: string, tier: "small" | "medium" | "large" }
 * 
 * Create a pending purchase. Client pays USDC on-chain, then confirms.
 * Tiers: $1=50 | $5=300 | $20=1500
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { address, tier } = body

    if (!address || typeof address !== 'string') {
      return NextResponse.json({ error: 'address is required' }, { status: 400 })
    }

    if (!tier || !['small', 'medium', 'large'].includes(tier)) {
      return NextResponse.json({
        error: 'tier must be "small", "medium", or "large"',
        tiers: SCARAB_CONFIG.PURCHASE_TIERS,
      }, { status: 400 })
    }

    const purchase = await createPurchase(address, tier as 'small' | 'medium' | 'large')

    return NextResponse.json({
      success: true,
      purchaseId: purchase.id,
      tier: purchase.tier,
      usdcAmount: purchase.usdcAmount,
      scarabAmount: purchase.scarabAmount,
      status: purchase.status,
      message: `Pay $${purchase.usdcAmount} USDC to receive ${purchase.scarabAmount} Scarab 🪲`,
    })
  } catch (error) {
    console.error('Error creating purchase:', error)
    return NextResponse.json({ error: 'Failed to create purchase' }, { status: 500 })
  }
}

/**
 * PATCH /api/scarab/purchase
 * Body: { purchaseId: string, txHash: string }
 * 
 * Confirm a purchase after USDC payment is on-chain.
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { purchaseId, txHash } = body

    if (!purchaseId || !txHash) {
      return NextResponse.json({ error: 'purchaseId and txHash required' }, { status: 400 })
    }

    const result = await confirmPurchase(purchaseId, txHash)

    return NextResponse.json({
      success: true,
      ...result,
      message: `${result.scarabAmount} Scarab credited! New balance: ${result.balance} 🪲`,
    })
  } catch (error: any) {
    if (error.message?.includes('not found') || error.message?.includes('already')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Error confirming purchase:', error)
    return NextResponse.json({ error: 'Failed to confirm purchase' }, { status: 500 })
  }
}
