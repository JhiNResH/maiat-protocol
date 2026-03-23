import { NextRequest, NextResponse } from 'next/server'
import { calculateTrustScore } from '@/lib/trust-score'
import { createRateLimiter, checkIpRateLimit } from '@/lib/ratelimit'

const RATE_LIMIT = 30
const rateLimiter = createRateLimiter('trust-score', RATE_LIMIT, 60)

export async function GET(request: NextRequest) {
  const rl = await checkIpRateLimit(request, rateLimiter)

  if (!rl.success) {
    const retryAfter = rl.reset ? Math.ceil((rl.reset - Date.now()) / 1000) : 60
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        message: `Too many requests. Please try again in ${retryAfter} seconds.`,
        retryAfter,
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': RATE_LIMIT.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rl.reset.toString(),
          'Retry-After': retryAfter.toString(),
        },
      }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const slug = searchParams.get('slug')

    // We already do a contains search in calculateTrustScore, so just pass whatever they give us.
    const identifier = token || slug

    if (!identifier) {
      return NextResponse.json(
        {
          error: 'Missing parameter',
          message: 'Please provide either ?token=0x... or ?slug=project-name',
        },
        {
          status: 400,
          headers: {
            'X-RateLimit-Limit': RATE_LIMIT.toString(),
            'X-RateLimit-Remaining': rl.remaining.toString(),
            'X-RateLimit-Reset': rl.reset.toString(),
          },
        }
      )
    }

    // Calculate trust score
    const result = await calculateTrustScore(identifier)

    return NextResponse.json(
      { success: true, data: result },
      {
        status: 200,
        headers: {
          'X-RateLimit-Limit': RATE_LIMIT.toString(),
          'X-RateLimit-Remaining': rl.remaining.toString(),
          'X-RateLimit-Reset': rl.reset.toString(),
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    )
  } catch (error: any) {
    console.error('Trust score API error:', error)

    if (error.message?.includes('not found')) {
      return NextResponse.json(
        { error: 'Project not found', message: error.message },
        {
          status: 404,
          headers: {
            'X-RateLimit-Limit': RATE_LIMIT.toString(),
            'X-RateLimit-Remaining': rl.remaining.toString(),
            'X-RateLimit-Reset': rl.reset.toString(),
          },
        }
      )
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to calculate trust score',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      {
        status: 500,
        headers: {
          'X-RateLimit-Limit': RATE_LIMIT.toString(),
          'X-RateLimit-Remaining': rl.remaining.toString(),
          'X-RateLimit-Reset': rl.reset.toString(),
        },
      }
    )
  }
}
