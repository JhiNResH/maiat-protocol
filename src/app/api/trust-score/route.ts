import { NextRequest, NextResponse } from 'next/server'
import { calculateTrustScore } from '@/lib/trust-score'

// In-memory rate limiting (simple implementation)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 30 // requests per window
const RATE_WINDOW = 60 * 1000 // 1 minute in ms

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const record = rateLimitMap.get(ip)
  
  if (!record || now > record.resetAt) {
    // New window
    const resetAt = now + RATE_WINDOW
    rateLimitMap.set(ip, { count: 1, resetAt })
    return { allowed: true, remaining: RATE_LIMIT - 1, resetAt }
  }
  
  if (record.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt }
  }
  
  record.count++
  return { allowed: true, remaining: RATE_LIMIT - record.count, resetAt: record.resetAt }
}

export async function GET(request: NextRequest) {
  // Get client IP for rate limiting
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
             request.headers.get('x-real-ip') || 
             'unknown'
  
  // Check rate limit
  const rateLimit = checkRateLimit(ip)
  
  if (!rateLimit.allowed) {
    const retryAfter = Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
    return NextResponse.json(
      { 
        error: 'Rate limit exceeded',
        message: `Too many requests. Please try again in ${retryAfter} seconds.`,
        retryAfter
      },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': RATE_LIMIT.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimit.resetAt.toString(),
          'Retry-After': retryAfter.toString()
        }
      }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const slug = searchParams.get('slug')
    
    const identifier = token || slug
    
    if (!identifier) {
      return NextResponse.json(
        { 
          error: 'Missing parameter',
          message: 'Please provide either ?token=0x... or ?slug=project-name'
        },
        { 
          status: 400,
          headers: {
            'X-RateLimit-Limit': RATE_LIMIT.toString(),
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.resetAt.toString()
          }
        }
      )
    }

    // Calculate trust score
    const result = await calculateTrustScore(identifier)

    return NextResponse.json(
      {
        success: true,
        data: result
      },
      {
        status: 200,
        headers: {
          'X-RateLimit-Limit': RATE_LIMIT.toString(),
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetAt.toString(),
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
        }
      }
    )
  } catch (error: any) {
    console.error('Trust score API error:', error)
    
    // Project not found
    if (error.message?.includes('not found')) {
      return NextResponse.json(
        { 
          error: 'Project not found',
          message: error.message
        },
        { 
          status: 404,
          headers: {
            'X-RateLimit-Limit': RATE_LIMIT.toString(),
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.resetAt.toString()
          }
        }
      )
    }

    // Internal server error
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to calculate trust score',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { 
        status: 500,
        headers: {
          'X-RateLimit-Limit': RATE_LIMIT.toString(),
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetAt.toString()
        }
      }
    )
  }
}
