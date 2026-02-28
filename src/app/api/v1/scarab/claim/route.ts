import { NextRequest, NextResponse } from 'next/server'
import { claimDaily } from '@/lib/scarab'
import { verifyAndConsumeNonce } from '@/lib/claim-nonce'
import { verifyMessage, getAddress } from 'viem'

export async function POST(req: NextRequest) {
  try {
    const { address, signature, nonce, expiresAt } = await req.json()

    if (!address || !signature || !nonce || !expiresAt) {
      return NextResponse.json(
        { error: 'Missing address, signature, nonce, or expiresAt' },
        { status: 400 },
      )
    }

    // Checksum the address — rejects invalid hex
    let checksumAddress: string
    try {
      checksumAddress = getAddress(address)
    } catch {
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
    }

    // Verify nonce is fresh, not expired, and single-use
    try {
      await verifyAndConsumeNonce(checksumAddress, nonce, expiresAt)
    } catch (err: any) {
      return NextResponse.json({ error: err.message ?? 'Invalid nonce' }, { status: 401 })
    }

    // Reconstruct the exact message the client signed
    const message = [
      `Claim daily Scarab for ${checksumAddress}`,
      `Nonce: ${nonce}`,
      `Expiration: ${expiresAt}`,
    ].join('\n')

    // Verify EIP-191 signature — recovered signer must equal checksumAddress
    let isValid = false
    try {
      isValid = await verifyMessage({ address: checksumAddress, message, signature })
    } catch {
      isValid = false
    }

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const claimResult: any = await claimDaily(checksumAddress, false)
    return NextResponse.json(claimResult, { status: 200 })
  } catch (error: any) {
    console.error('[POST /api/v1/scarab/claim]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
