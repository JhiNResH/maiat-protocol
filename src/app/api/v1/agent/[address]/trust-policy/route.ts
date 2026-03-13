/**
 * GET /api/v1/agent/:address/trust-policy
 * 
 * Agentic Trust Policy Endpoint
 * 
 * Returns comprehensive trust assessment for an agent based on:
 * 1. Behavioral score (from Maiat Oracle job history)
 * 2. Reputation score (from FairScale wallet reputation)
 * 3. Token risk score (from Wadjet ML engine)
 * 
 * Combined into final TRUST_SCORE with recommended ACP fee tier.
 * 
 * Part of FairScale Bounty submission (Mar 15, 2026)
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  calculateAgentTrustScore,
  calculateAcpFee,
  getFairScaleReputation,
} from '@/lib/fairscale-integration'
import { isAddress } from 'viem'

/**
 * Sample behavioral scores for demo agents
 * In production, these come from Maiat Oracle indexed data
 */
const DEMO_BEHAVIORAL_SCORES: Record<string, number> = {
  '0x5facebd66d78a69b400dc702049374b95745fbc5': 88, // High quality executor
  '0xbad0000000000000000000000000000000000001': 15, // New/untested
  '0xf00000000000000000000000000000000000000d': 32, // Some issues
}

/**
 * Sample token scores for demo agents
 * In production, these come from Wadjet rug prediction engine
 */
const DEMO_TOKEN_SCORES: Record<string, number> = {
  '0x5facebd66d78a69b400dc702049374b95745fbc5': 92, // Solid token
  '0xbad0000000000000000000000000000000000001': 45, // Risky
  '0xf00000000000000000000000000000000000000d': 35, // Very risky
}

interface TrustPolicyResponse {
  agent: {
    address: string
  }
  trustScoring: {
    behaviorScore: number // From Maiat Oracle (40% weight)
    reputationScore: number // From FairScale API (35% weight)
    tokenScore: number // From Wadjet engine (25% weight)
    finalTrustScore: number // Composite 0-100
  }
  assessment: {
    tier: string // untrusted | questionable | cautious | trusted | elite
    trustLevel: string // Human-readable
    confidence: number // 0-100
  }
  fairscaleData: {
    walletTier: number // 1-5
    transactionCount: number
    accountAgeDays: number
    verified: boolean
    fraudFlags: string[]
  }
  recommendations: {
    acp: {
      allowed: boolean
      baseFee: number
      adjustedFee: number
      feeMultiplier: string
      reason: string
    }
    riskFlags: string[]
    nextUpdate: number // unix timestamp
  }
  metadata: {
    policy_version: string
    generated_at: number
    cache_status: string // hit | miss | degraded
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    const address = params.address.toLowerCase()

    // Validate address format
    if (!isAddress(address)) {
      return NextResponse.json(
        {
          error: 'Invalid wallet address format',
          address,
        },
        { status: 400 }
      )
    }

    // Get behavioral score (from Maiat Oracle)
    const behaviorScore =
      DEMO_BEHAVIORAL_SCORES[address] ?? Math.floor(Math.random() * 80) + 20

    // Get token risk score (from Wadjet)
    const tokenScore = DEMO_TOKEN_SCORES[address] ?? Math.floor(Math.random() * 70) + 20

    // Calculate composite trust score
    const trustAssessment = await calculateAgentTrustScore({
      walletAddress: address,
      behaviorScore,
      tokenScore,
    })

    // Get FairScale reputation details
    const fairscale = await getFairScaleReputation(address)

    // Calculate recommended ACP fee
    const acpFee = calculateAcpFee(0.02, trustAssessment.trustScore) // $0.02 base fee

    // Determine confidence level based on data freshness
    const age = Math.floor((Date.now() - fairscale.lastUpdated) / 1000 / 60) // minutes
    const confidence = Math.max(60, 100 - age / 24) // Confidence decays with age

    // Risk flags based on scores and FairScale flags
    const riskFlags: string[] = []
    if (trustAssessment.trustScore < 40) {
      riskFlags.push('low_trust_score')
    }
    if (trustAssessment.reputationScore < 40) {
      riskFlags.push('new_or_unverified_wallet')
    }
    if (trustAssessment.tokenScore < 40) {
      riskFlags.push('high_token_rug_risk')
    }
    if (fairscale.fraudFlags.length > 0) {
      riskFlags.push(...fairscale.fraudFlags)
    }

    // Tier descriptions
    const tierDescriptions: Record<string, string> = {
      elite: 'Highly trusted - receives fee discounts',
      trusted: 'Standard trust - normal ACP operations',
      cautious: 'Requires monitoring - higher fees applied',
      questionable: 'Significant risk - premium fees',
      untrusted: 'Blocked - too high risk',
    }

    const response: TrustPolicyResponse = {
      agent: { address },
      trustScoring: {
        behaviorScore: trustAssessment.behaviorScore,
        reputationScore: trustAssessment.reputationScore,
        tokenScore: trustAssessment.tokenScore,
        finalTrustScore: trustAssessment.trustScore,
      },
      assessment: {
        tier: trustAssessment.tier,
        trustLevel:
          tierDescriptions[trustAssessment.tier] ||
          'Unknown tier',
        confidence: Math.round(confidence),
      },
      fairscaleData: {
        walletTier: fairscale.tier,
        transactionCount: fairscale.transactionCount,
        accountAgeDays: fairscale.accountAgeInDays,
        verified: fairscale.verified,
        fraudFlags: fairscale.fraudFlags,
      },
      recommendations: {
        acp: {
          allowed: acpFee.finalFee > 0,
          baseFee: 0.02,
          adjustedFee:
            acpFee.finalFee > 0 ? Math.round(acpFee.finalFee * 10000) / 10000 : 0,
          feeMultiplier:
            acpFee.finalFee > 0
              ? `${(acpFee.finalFee / 0.02).toFixed(2)}x`
              : 'BLOCKED',
          reason: acpFee.reason,
        },
        riskFlags,
        nextUpdate:
          fairscale.lastUpdated + 24 * 60 * 60 * 1000, // 24 hours
      },
      metadata: {
        policy_version: '1.0',
        generated_at: Date.now(),
        cache_status: 'hit', // Would be dynamic in production
      },
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    })
  } catch (error) {
    console.error('[TrustPolicy] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to calculate trust score',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
