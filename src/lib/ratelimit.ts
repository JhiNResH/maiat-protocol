/**
 * Rate limiting for API endpoints using Upstash Redis
 * Protects against DoS attacks and gas relayer abuse
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Initialize Redis client (serverless-friendly)
const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null

/**
 * Rate limiter for review submission
 * 5 reviews per hour per address
 */
export const reviewSubmitLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '1 h'),
      prefix: 'ratelimit:review:submit',
      analytics: true,
    })
  : null

/**
 * Rate limiter for on-chain verification
 * 3 verifications per hour per review (prevents gas drain attack)
 */
export const verifyLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, '1 h'),
      prefix: 'ratelimit:review:verify',
      analytics: true,
    })
  : null

/**
 * Check rate limit for an identifier
 * Returns { success: boolean, limit: number, remaining: number, reset: Date }
 */
export async function checkRateLimit(
  limiter: typeof reviewSubmitLimiter,
  identifier: string
): Promise<{ success: boolean; limit: number; remaining: number; reset: Date }> {
  if (!limiter) {
    // If Redis not configured, allow (degraded mode)
    return { success: true, limit: 0, remaining: 0, reset: new Date() }
  }

  const result = await limiter.limit(identifier)
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: new Date(result.reset), // Convert Unix timestamp (ms) to Date
  }
}
