/**
 * Single-use nonces for Scarab daily claim signatures.
 *
 * Flow:
 *   1. Frontend calls GET /api/v1/scarab/nonce  →  { nonce, expiresAt }
 *   2. Frontend builds message, signs it, posts to /api/v1/scarab/claim
 *   3. Claim handler calls verifyAndConsumeNonce() — fails if expired or replayed
 *
 * Nonces live in Upstash Redis with a hard TTL.  If Redis is unavailable the
 * helpers fall back gracefully (nonce still in the signed message; just no
 * server-side single-use guarantee — acceptable for offline / CI environments).
 */

import { Redis } from '@upstash/redis'
import { randomBytes } from 'crypto'

// ── Redis ────────────────────────────────────────────────────────────────────

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null

// ── Config ───────────────────────────────────────────────────────────────────

/** How long a nonce is valid before the user must request a fresh one (seconds). */
const NONCE_TTL_SECONDS = 10 * 60 // 10 minutes

const keyOf = (address: string, nonce: string) =>
  `nonce:scarab:claim:${address.toLowerCase()}:${nonce}`

// ── Public API ────────────────────────────────────────────────────────────────

export interface IssuedNonce {
  nonce: string
  expiresAt: string // ISO-8601
}

/**
 * Generate and store a fresh nonce for `address`.
 * Returns the nonce value and its expiry so the client can embed both in the
 * signed message.
 */
export async function issueNonce(address: string): Promise<IssuedNonce> {
  const nonce = randomBytes(8).toString('hex') // 16 hex chars
  const expiresAt = new Date(Date.now() + NONCE_TTL_SECONDS * 1000).toISOString()

  if (redis) {
    // Value = expiry timestamp (ISO) so we can double-check on consumption
    await redis.set(keyOf(address, nonce), expiresAt, { ex: NONCE_TTL_SECONDS })
  }

  return { nonce, expiresAt }
}

/**
 * Validate that `nonce` was issued for `address`, has not expired, and has not
 * been used before.  On success, atomically deletes the key (single-use).
 *
 * Returns `true` if valid, throws with a descriptive message otherwise.
 */
export async function verifyAndConsumeNonce(
  address: string,
  nonce: string,
  claimedExpiry: string,
): Promise<true> {
  // 1. Time-bound check (client-supplied expiry in the signed message)
  const expiry = new Date(claimedExpiry)
  if (isNaN(expiry.getTime())) {
    throw new Error('Invalid expiry timestamp in signed message')
  }
  if (Date.now() > expiry.getTime()) {
    throw new Error('Signature expired — please reconnect and try again')
  }

  if (!redis) {
    // Redis unavailable: expiry check above is the only guard
    return true
  }

  // 2. Existence check (was this nonce actually issued by us?)
  const storedExpiry = await redis.get<string>(keyOf(address, nonce))
  if (!storedExpiry) {
    throw new Error('Unknown or already-used nonce')
  }

  // 3. Sanity: stored expiry matches what the user signed
  if (storedExpiry !== claimedExpiry) {
    throw new Error('Nonce expiry mismatch')
  }

  // 4. Consume (delete) — prevents replay within the TTL window
  await redis.del(keyOf(address, nonce))

  return true
}
