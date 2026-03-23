/**
 * POST /api/v1/ens/verify
 *
 * Verify ENSIP-25 association between an ENS name and an ERC-8004 agentId.
 * On success, marks the agent's passport as ENS-verified and applies trust score bonus.
 *
 * Body: { ensName: string, agentId?: number, walletAddress?: string }
 *
 * - If agentId is not provided, we look it up from walletAddress via erc8004.
 * - If ensName is a maiat.eth subdomain, reads via NameStone.
 * - If ensName is external ENS, reads via on-chain resolver.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyEnsip25, buildEnsip25Key } from '@/lib/ensip25'
import { getAgentId } from '@/lib/erc8004'
import { checkIpRateLimit, createRateLimiter } from '@/lib/ratelimit'

export const maxDuration = 30

const rateLimiter = createRateLimiter('ens:verify', 10, 60)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// Trust score bonus for ENSIP-25 verification
const ENS_VERIFIED_BONUS = 10

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(req: NextRequest) {
  const { success: ok } = await checkIpRateLimit(req, rateLimiter)
  if (!ok) {
    return NextResponse.json({ error: 'Rate limited. Retry after 1 minute.' }, { status: 429, headers: CORS })
  }

  try {
    const body = await req.json()
    const { ensName, agentId: rawAgentId, walletAddress } = body

    if (!ensName || typeof ensName !== 'string') {
      return NextResponse.json({ error: 'ensName is required' }, { status: 400, headers: CORS })
    }

    if (!walletAddress && rawAgentId == null) {
      return NextResponse.json(
        { error: 'Either walletAddress or agentId is required' },
        { status: 400, headers: CORS }
      )
    }

    // Resolve agentId
    let agentId: number | bigint | null = rawAgentId ?? null

    if (agentId == null && walletAddress) {
      const onChainId = await getAgentId(walletAddress)
      if (!onChainId) {
        return NextResponse.json(
          { error: 'No ERC-8004 registration found for this wallet address' },
          { status: 404, headers: CORS }
        )
      }
      agentId = onChainId
    }

    // Run ENSIP-25 verification
    const result = await verifyEnsip25(ensName, agentId!)

    if (!result.verified) {
      return NextResponse.json(
        {
          verified: false,
          ensName: result.ensName,
          agentId: result.agentId,
          textRecordKey: result.textRecordKey,
          reason: result.reason,
          instructions: {
            step1: 'Go to https://app.ens.domains',
            step2: `Navigate to your ENS name: ${result.ensName}`,
            step3: 'Click "Edit Records" → "Add record"',
            step4: `Key: ${result.textRecordKey}`,
            step5: 'Value: 1',
            step6: `Call POST /api/v1/ens/verify again to confirm`,
          },
        },
        { status: 200, headers: CORS }
      )
    }

    // Verified — update DB
    const normalizedAddress = walletAddress?.toLowerCase()

    // Find agent in DB
    const agentScore = normalizedAddress
      ? await prisma.agentScore.findFirst({ where: { walletAddress: normalizedAddress } })
      : null

    let previouslyVerified = false

    if (agentScore) {
      // @ts-ignore — ensVerified field added via migration
      previouslyVerified = agentScore.ensVerified === true

      if (!previouslyVerified) {
        await prisma.agentScore.update({
          where: { id: agentScore.id },
          data: {
            // @ts-ignore
            ensVerified: true,
            trustScore: Math.min(100, (agentScore.trustScore ?? 50) + ENS_VERIFIED_BONUS),
          },
        })
      }
    }

    // Also update user record if exists
    if (normalizedAddress) {
      const user = await prisma.user.findUnique({ where: { address: normalizedAddress } })
      if (user) {
        await prisma.user.update({
          where: { address: normalizedAddress },
          // @ts-ignore
          data: { ensVerified: true },
        })
      }
    }

    return NextResponse.json(
      {
        verified: true,
        ensName: result.ensName,
        agentId: result.agentId,
        textRecordKey: result.textRecordKey,
        ensVerifiedBonusApplied: !previouslyVerified,
        trustScoreBonus: previouslyVerified ? 0 : ENS_VERIFIED_BONUS,
        message: previouslyVerified
          ? 'Already ENS verified'
          : `ENS verification successful. Trust score +${ENS_VERIFIED_BONUS}`,
      },
      { status: 200, headers: CORS }
    )
  } catch (err: any) {
    console.error('[ens/verify]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS })
  }
}
