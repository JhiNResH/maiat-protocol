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

/**
 * Generic IP-based rate limiter factory
 * Creates an Upstash-backed limiter or null (graceful degradation when Redis is not configured)
 *
 * @param prefix  - Redis key prefix, e.g. "api:score"
 * @param requests - Max requests per window
 * @param windowSeconds - Window size in seconds
 */
export function createRateLimiter(
  prefix: string,
  requests: number,
  windowSeconds: number
): Ratelimit | null {
  if (!redis) return null
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, `${windowSeconds} s`),
    prefix: `rl:${prefix}`,
    analytics: true,
  })
}

/**
 * Check IP-based rate limit for a Next.js request
 * Uses x-forwarded-for → x-real-ip → "unknown" as identifier
 *
 * Returns { success, remaining, reset (ms), limit }
 * When Redis is not configured, always returns success=true (degraded mode)
 */
export async function checkIpRateLimit(
  req: { headers: { get: (name: string) => string | null } },
  limiter: Ratelimit | null
): Promise<{ success: boolean; remaining: number; reset: number; limit: number }> {
  if (!limiter) {
    return { success: true, remaining: 999, reset: 0, limit: 0 }
  }
  const ip = (
    req.headers.get('x-forwarded-for')?.split(',')[0] ??
    req.headers.get('x-real-ip') ??
    'unknown'
  ).trim()

  const result = await limiter.limit(ip)
  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
    limit: result.limit,
  }
}
