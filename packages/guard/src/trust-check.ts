import type { MaiatCheckResult } from './errors.js'
import { Maiat } from "@jhinresh/maiat-sdk"

// Simple in-memory cache: address → { result, expiresAt }
const cache = new Map<string, { result: MaiatCheckResult; expiresAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

let sdkInstance: Maiat | null = null

function getSDK(apiKey?: string): Maiat {
  if (!sdkInstance) {
    sdkInstance = new Maiat({
      apiKey,
      framework: 'viem-guard',
      clientId: 'viem-guard-standard'
    })
  }
  return sdkInstance
}

export async function checkTrust(
  address: string,
  apiKey?: string
): Promise<MaiatCheckResult | null> {
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) return null

  const lowerAddr = address.toLowerCase()

  // Cache hit
  const cached = cache.get(lowerAddr)
  if (cached && Date.now() < cached.expiresAt) {
    return { ...cached.result, source: 'cache' }
  }

  try {
    const sdk = getSDK(apiKey)
    const res = await sdk.agentTrust(lowerAddr)

    const result: MaiatCheckResult = {
      address: lowerAddr,
      score: res.trustScore,
      riskLevel: res.verdict === 'proceed' ? 'Low' : (res.verdict === 'caution' ? 'Medium' : 'High'),
      verdict: res.verdict === 'avoid' ? 'block' : 'allow',
      source: 'api',
    }

    cache.set(lowerAddr, { result, expiresAt: Date.now() + CACHE_TTL_MS })
    return result
  } catch {
    // Timeout or network error → fail-open
    return null
  }
}
