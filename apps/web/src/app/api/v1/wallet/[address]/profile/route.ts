import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyMessage, getAddress, type Address } from 'viem'

/**
 * POST /api/v1/wallet/[address]/profile
 * 
 * Update user profile details (displayName).
 * Requires signature from the wallet owner.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    const address = params.address
    const { displayName, signature, nonce, expiresAt } = await req.json()

    if (!address || !displayName || !signature) {
      return NextResponse.json(
        { error: 'Missing required fields (address, displayName, signature)' },
        { status: 400 }
      )
    }

    // Checksum the address
    let checksumAddress: Address
    try {
      checksumAddress = getAddress(address)
    } catch {
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
    }

    // Optional: Verify nonce if we want to prevent replay
    // For now, let's keep it simple with just signature verification on the intent
    const message = `Update my Maiat profile name to: ${displayName}`
    
    let isValid = false
    try {
      isValid = await verifyMessage({ address: checksumAddress, message, signature })
    } catch {
      isValid = false
    }

    if (!isValid) {
      // Try with a version that includes nonce if provided (to be consistent with Scarab flow)
      if (nonce && expiresAt) {
        const fullMessage = [
          `Update my Maiat profile name to: ${displayName}`,
          `Nonce: ${nonce}`,
          `Expiration: ${expiresAt}`,
        ].join('\n')
        isValid = await verifyMessage({ address: checksumAddress, message: fullMessage, signature })
      }
    }

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // Update DB
    const user = await prisma.user.upsert({
      where: { address: checksumAddress.toLowerCase() },
      create: { 
        address: checksumAddress.toLowerCase(), 
        displayName 
      },
      update: { displayName }
    })

    return NextResponse.json({ success: true, user })
  } catch (error: any) {
    console.error('[POST /api/v1/wallet/profile]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
