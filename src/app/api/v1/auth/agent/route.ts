/**
 * POST /api/v1/auth/agent
 *
 * EIP-712 signature → JWT authentication for Maiat agents.
 *
 * Request body:
 *   { address: string, signature: string, timestamp: number }
 *
 * Response:
 *   { token: string, expiresIn: 86400 }
 */

import { NextRequest, NextResponse } from 'next/server'
import { isAddress, getAddress, verifyTypedData } from 'viem'
import { prisma } from '@/lib/prisma'
import {
  EIP712_DOMAIN,
  EIP712_TYPES,
  EIP712_STATEMENT,
  issueAgentJWT,
} from '@/lib/auth'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const FIVE_MINUTES_MS = 5 * 60 * 1000

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      address?: string
      signature?: string
      timestamp?: number
    }

    const { address, signature, timestamp } = body

    // 1. Validate address format
    if (!address || !isAddress(address)) {
      return NextResponse.json(
        { error: 'Invalid or missing address' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    if (!signature || typeof signature !== 'string') {
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    if (typeof timestamp !== 'number') {
      return NextResponse.json(
        { error: 'Missing or invalid timestamp' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    const checksummedAddress = getAddress(address)

    // 2. Verify timestamp is within 5 minutes
    const now = Math.floor(Date.now() / 1000)
    const diff = Math.abs(now - timestamp)
    if (diff > 300) {
      return NextResponse.json(
        { error: 'Timestamp expired or too far in the future. Must be within 5 minutes.' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    // 3. Verify EIP-712 typed data signature
    let isValid = false
    try {
      isValid = await verifyTypedData({
        address: checksummedAddress as `0x${string}`,
        domain: EIP712_DOMAIN,
        types: EIP712_TYPES,
        primaryType: 'Auth',
        message: {
          wallet: checksummedAddress as `0x${string}`,
          timestamp: BigInt(timestamp),
          statement: EIP712_STATEMENT,
        },
        signature: signature as `0x${string}`,
      })
    } catch (e: any) {
      console.warn('[auth/agent] verifyTypedData error:', e.message)
      return NextResponse.json(
        { error: 'Signature verification failed', detail: e.message },
        { status: 401, headers: CORS_HEADERS }
      )
    }

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid EIP-712 signature' },
        { status: 401, headers: CORS_HEADERS }
      )
    }

    // 4. Check that address has a passport (User exists in DB)
    const user = await prisma.user.findUnique({
      where: { address: checksummedAddress.toLowerCase() },
    })

    if (!user) {
      return NextResponse.json(
        {
          error: 'No passport found for this address. Register at POST /api/v1/passport/register first.',
        },
        { status: 403, headers: CORS_HEADERS }
      )
    }

    // 5. Issue JWT
    const token = await issueAgentJWT(checksummedAddress)

    return NextResponse.json(
      { token, expiresIn: 86400 },
      { status: 200, headers: CORS_HEADERS }
    )
  } catch (err: any) {
    console.error('[auth/agent] Error:', err.message)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
