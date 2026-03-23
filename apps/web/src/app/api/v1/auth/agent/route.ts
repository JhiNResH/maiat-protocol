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
import { isAddress, getAddress, verifyTypedData, keccak256, toBytes } from 'viem'
import { prisma } from '@/lib/prisma'
import { createRateLimiter, checkIpRateLimit } from '@/lib/ratelimit'
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

const FIVE_MINUTES_SECS = 300

// Rate limit: 10 auth attempts per IP per minute
const rateLimiter = createRateLimiter('auth:agent', 10, 60)

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest) {
  // --- Rate limit ---
  const rateLimitResult = await checkIpRateLimit(req, rateLimiter)
  if (rateLimitResult) return new NextResponse(rateLimitResult.body, rateLimitResult)

  try {
    const body = await req.json() as {
      address?: string
      signature?: string
      timestamp?: number
      kyaCode?: string
    }

    const { address, signature, timestamp, kyaCode } = body

    // ─── Path A: KYA-based auth (for headless agents / Privy wallets) ────
    if (kyaCode && typeof kyaCode === 'string') {
      const kyaRecord = await prisma.kyaCode.findUnique({
        where: { code: kyaCode },
      })

      if (!kyaRecord || !kyaRecord.agentAddress) {
        return NextResponse.json(
          { error: 'Invalid KYA code. Register at POST /api/v1/passport/register first.' },
          { status: 401, headers: CORS_HEADERS }
        )
      }

      const agentAddress = getAddress(kyaRecord.agentAddress)
      const token = await issueAgentJWT(agentAddress)

      return NextResponse.json(
        { token, expiresIn: 86400, address: agentAddress },
        { status: 200, headers: CORS_HEADERS }
      )
    }

    // ─── Path B: EIP-712 signature auth (for self-custodial wallets) ─────

    // 1. Validate address format
    if (!address || !isAddress(address)) {
      return NextResponse.json(
        { error: 'Invalid or missing address. Provide {address, signature, timestamp} for EIP-712 auth, or {kyaCode} for KYA-based auth.' },
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
    if (diff > FIVE_MINUTES_SECS) {
      return NextResponse.json(
        { error: 'Timestamp expired or too far in the future. Must be within 5 minutes.' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    // 3. Replay protection — check if this exact signature was already used
    const sigHash = keccak256(toBytes(signature))
    const existingUse = await prisma.usedAuthSignature.findUnique({
      where: { sigHash },
    })
    if (existingUse) {
      return NextResponse.json(
        { error: 'Signature already used. Sign a new message with a fresh timestamp.' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    // 4. Verify EIP-712 typed data signature
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

    // 5. Check that address has a passport (User exists in DB)
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

    // 6. Record used signature (expires after 5 min, pruned by cron)
    const expiresAt = new Date((timestamp + FIVE_MINUTES_SECS) * 1000)
    await prisma.usedAuthSignature.create({
      data: { sigHash, address: checksummedAddress.toLowerCase(), expiresAt },
    })

    // 7. Issue JWT
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
