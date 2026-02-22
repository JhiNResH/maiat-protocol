'use client'

import { useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { X, Zap } from 'lucide-react'

interface ScarabPurchasePanelProps {
  onClose: () => void
  onSuccess?: () => void
}

const TIERS = [
  { id: 'small', usdc: 1, scarab: 50, label: 'Starter', badge: '🪲' },
  { id: 'medium', usdc: 5, scarab: 300, label: 'Power User', badge: '🪲🪲' },
  { id: 'large', usdc: 20, scarab: 1500, label: 'Whale', badge: '🪲🪲🪲' },
]

export function ScarabPurchasePanel({ onClose, onSuccess }: ScarabPurchasePanelProps) {
  const { authenticated, user, login } = usePrivy()
  const [selectedTier, setSelectedTier] = useState<string | null>(null)
  const [purchasing, setPurchasing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const address = user?.wallet?.address

  const handlePurchase = async () => {
    if (!address || !selectedTier) return

    setPurchasing(true)
    setError(null)

    try {
      const res = await fetch('/api/scarab/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, tier: selectedTier }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Purchase failed')

      alert(`✅ Purchase successful! +${data.scarabAmount} Scarab added`)
      if (onSuccess) onSuccess()
      onClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setPurchasing(false)
    }
  }

  if (!authenticated) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-8 max-w-md w-full text-center">
          <h2 className="text-2xl font-bold mb-4">Sign In Required</h2>
          <p className="text-zinc-400 mb-6">Sign in to purchase Scarab</p>
          <div className="flex gap-3">
            <button
              onClick={login}
              className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  const selected = TIERS.find((t) => t.id === selectedTier)

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-2xl w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-zinc-800 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Purchase Scarab 🪲</h2>
            <p className="text-sm text-zinc-400 mt-1">
              Fuel your trust-staking with USDC
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tiers */}
        <div className="p-6 space-y-3">
          {TIERS.map((tier) => (
            <button
              key={tier.id}
              onClick={() => setSelectedTier(tier.id)}
              className={`
                w-full text-left p-4 rounded-xl border-2 transition-all
                ${
                  selectedTier === tier.id
                    ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/20'
                    : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                }
              `}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{tier.badge}</span>
                    <span className="font-bold text-lg">{tier.label}</span>
                  </div>
                  <div className="text-sm text-zinc-400">
                    ${tier.usdc} USDC → <span className="text-amber-400 font-semibold">{tier.scarab} Scarab</span>
                  </div>
                </div>
                {selectedTier === tier.id && (
                  <Zap className="w-6 h-6 text-amber-400" />
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Info */}
        <div className="px-6 pb-6">
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg px-4 py-3 text-sm text-blue-300 mb-4">
            ℹ️ Purchases are processed via USDC on Base. Scarab is added instantly to your balance.
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400 mb-4">
              ❌ {error}
            </div>
          )}

          {/* Summary */}
          {selected && (
            <div className="bg-zinc-800 rounded-lg p-4 mb-4">
              <div className="text-sm text-zinc-400 mb-2">Purchase Summary</div>
              <div className="flex items-center justify-between text-lg">
                <span className="text-white font-semibold">${selected.usdc} USDC</span>
                <span className="text-zinc-500">→</span>
                <span className="text-amber-400 font-bold">{selected.scarab} 🪲</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handlePurchase}
              disabled={!selectedTier || purchasing}
              className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-all shadow-lg"
            >
              {purchasing ? '⏳ Processing...' : selected ? `Purchase ${selected.scarab} 🪲` : 'Select a tier'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
