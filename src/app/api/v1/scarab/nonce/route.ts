import { NextRequest, NextResponse } from 'next/server'
import { getAddress } from 'viem'
import { issueNonce } from '@/lib/claim-nonce'

/**
 * GET /api/v1/scarab/nonce?address=0x...
 *
 * Issues a short-lived, single-use nonce for the daily Scarab claim flow.
 * The client must embed the returned nonce and expiresAt in the EIP-191 message
 * before signing, then pass them to POST /api/v1/scarab/claim.
 */
export async function GET(req: NextRequest) {
  try {
    const raw = req.nextUrl.searchParams.get('address')
    if (!raw) {
      return NextResponse.json({ error: 'Missing address' }, { status: 400 })
    }

    let address: string
    try {
      address = getAddress(raw) // validates + checksums
    } catch {
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
    }

    const issued = await issueNonce(address)
    return NextResponse.json(issued)
  } catch (err) {
    console.error('[GET /api/v1/scarab/nonce]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
