/**
 * Agent JWT Auth utilities for Maiat Protocol
 *
 * Used by:
 *   - POST /api/v1/auth/agent  — issues JWT from EIP-712 signature
 *   - POST /api/v1/review      — verifies JWT to auto-identify agent reviewer
 */

import { SignJWT, jwtVerify } from 'jose'

// ─── EIP-712 Constants ────────────────────────────────────────────────────────

export const EIP712_DOMAIN = {
  name: 'Maiat Protocol',
  version: '1',
  chainId: Number(process.env.CHAIN_ID ?? 84532),
} as const

export const EIP712_TYPES = {
  Auth: [
    { name: 'wallet', type: 'address' },
    { name: 'timestamp', type: 'uint256' },
    { name: 'statement', type: 'string' },
  ],
} as const

export const EIP712_STATEMENT = 'Sign in to Maiat Protocol'

// ─── JWT Secret ───────────────────────────────────────────────────────────────

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET env var is required. Do not reuse MAIAT_ADMIN_PRIVATE_KEY.')
  }
  return new TextEncoder().encode(secret)
}

// ─── JWT Helpers ──────────────────────────────────────────────────────────────

export interface AgentJWTPayload {
  address: string
  type: 'agent'
}

/**
 * Verify an agent JWT token.
 * Returns { address, type } or throws on invalid/expired token.
 */
export async function verifyAgentJWT(token: string): Promise<AgentJWTPayload> {
  const secret = getJwtSecret()
  const { payload } = await jwtVerify(token, secret, {
    algorithms: ['HS256'],
  })

  const address = payload.sub
  const type = (payload as any).type

  if (!address || typeof address !== 'string') {
    throw new Error('Invalid JWT: missing sub (address)')
  }
  if (!type || typeof type !== 'string') {
    throw new Error('Invalid JWT: missing type')
  }
  if (type !== 'agent') {
    throw new Error(`Invalid JWT type: expected 'agent', got '${type}'`)
  }

  return { address, type: 'agent' }
}

/**
 * Issue a new agent JWT token for a wallet address.
 * Expires in 24 hours.
 */
export async function issueAgentJWT(address: string): Promise<string> {
  const secret = getJwtSecret()
  const token = await new SignJWT({ sub: address, type: 'agent' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret)
  return token
}
