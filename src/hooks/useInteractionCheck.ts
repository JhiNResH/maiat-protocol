/**
 * useInteractionCheck
 *
 * Checks on-chain whether `wallet` has ever interacted with `target` (Base).
 * Used to gate review submission — users can only review contracts they've used.
 *
 * Status flow:
 *   idle      → not yet triggered
 *   loading   → Alchemy query in flight
 *   verified  → has interacted ✅
 *   blocked   → no interaction found ❌
 *   error     → network/API failure (fail-open: treated as verified)
 */

import { useState, useCallback } from 'react'

export type InteractionStatus = 'idle' | 'loading' | 'verified' | 'blocked' | 'error'

export interface InteractionProof {
  hasInteracted: boolean
  txCount: number
  firstTxDate: string | null
  lastTxDate: string | null
  warning?: string
}

export interface UseInteractionCheckResult {
  status: InteractionStatus
  proof: InteractionProof | null
  check: () => Promise<void>
  reset: () => void
}

export function useInteractionCheck(
  wallet: string | undefined,
  target: string | undefined
): UseInteractionCheckResult {
  const [status, setStatus] = useState<InteractionStatus>('idle')
  const [proof, setProof] = useState<InteractionProof | null>(null)

  const check = useCallback(async () => {
    if (!wallet || !target) return

    setStatus('loading')
    setProof(null)

    try {
      const res = await fetch(
        `/api/v1/wallet/${encodeURIComponent(wallet)}/check-interaction?target=${encodeURIComponent(target)}`
      )

      if (!res.ok) {
        // Treat non-200 as fail-open (let backend gate catch it)
        setStatus('error')
        return
      }

      const data: InteractionProof & { wallet: string; target: string } = await res.json()

      setProof({
        hasInteracted: data.hasInteracted,
        txCount: data.txCount,
        firstTxDate: data.firstTxDate,
        lastTxDate: data.lastTxDate,
        warning: data.warning,
      })

      setStatus(data.hasInteracted ? 'verified' : 'blocked')
    } catch (err) {
      console.error('[useInteractionCheck] fetch failed:', err)
      // Fail open — network errors shouldn't silently block users
      setStatus('error')
    }
  }, [wallet, target])

  const reset = useCallback(() => {
    setStatus('idle')
    setProof(null)
  }, [])

  return { status, proof, check, reset }
}
