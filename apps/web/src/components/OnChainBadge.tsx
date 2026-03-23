'use client'

import { useState } from 'react'

interface OnChainBadgeProps {
  reviewId: string
  txHash?: string | null
  showVerifyButton?: boolean
}

export function OnChainBadge({ reviewId, txHash, showVerifyButton = false }: OnChainBadgeProps) {
  const [verifying, setVerifying] = useState(false)
  const [localTxHash, setLocalTxHash] = useState(txHash)
  const [error, setError] = useState<string | null>(null)

  const handleVerify = async () => {
    setVerifying(true)
    setError(null)
    try {
      const res = await fetch(`/api/reviews/${reviewId}/verify`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setLocalTxHash(data.txHash)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setVerifying(false)
    }
  }

  if (localTxHash) {
    return (
      <a
        href={`https://testnet.bscscan.com/tx/${localTxHash}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 bg-blue-50 text-blue-600 rounded border border-blue-200 hover:bg-blue-100 transition-colors"
      >
        ⛓️ On-chain ↗
      </a>
    )
  }

  if (showVerifyButton) {
    return (
      <div className="inline-flex items-center gap-2">
        <button
          onClick={handleVerify}
          disabled={verifying}
          className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 bg-gray-50 text-gray-500 rounded border border-gray-200 hover:border-slate-300 hover:text-slate-600 transition-colors disabled:opacity-50"
        >
          {verifying ? '⏳ Verifying...' : '🔗 Verify On-Chain'}
        </button>
        {error && <span className="text-xs font-mono text-slate-500">❌ {error}</span>}
      </div>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs font-mono text-gray-400">
      🔗 Off-chain
    </span>
  )
}
