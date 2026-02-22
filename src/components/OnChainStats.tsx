'use client'

import { useEffect, useState } from 'react'
import { Link2, Shield, Activity, ExternalLink } from 'lucide-react'

interface Stats {
  enabled: boolean
  contractAddress: string | null
  network: string
  totalReviews: number
  verifiedReviews: number
  onChainCount: number
  verificationRate: string
}

export function OnChainStats() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    fetch('/api/onchain/stats')
      .then(r => r.json())
      .then(setStats)
      .catch(() => {})
  }, [])

  if (!stats) return null

  return (
    <section className="max-w-5xl mx-auto px-4 pb-16">
      <div className="bg-gradient-to-r from-emerald-500/5 to-cyan-500/5 border border-emerald-500/20 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <Link2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">On-Chain Verification</h2>
            <p className="text-sm text-zinc-500">
              Every review is hashed and stored on {stats.network}
            </p>
          </div>
          {stats.contractAddress && (
            <a
              href={`https://testnet.bscscan.com/address/${stats.contractAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-full"
            >
              View Contract <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-zinc-900/60 rounded-xl p-4 text-center">
            <Shield className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{stats.verifiedReviews}</div>
            <div className="text-xs text-zinc-500">Verified On-Chain</div>
          </div>
          <div className="bg-zinc-900/60 rounded-xl p-4 text-center">
            <Activity className="w-5 h-5 text-cyan-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{stats.verificationRate}%</div>
            <div className="text-xs text-zinc-500">Verification Rate</div>
          </div>
          <div className="bg-zinc-900/60 rounded-xl p-4 text-center">
            <div className="text-2xl mb-2">🪲</div>
            <div className="text-2xl font-bold text-white">{stats.totalReviews * 2}</div>
            <div className="text-xs text-zinc-500">Scarab Staked</div>
          </div>
          <div className="bg-zinc-900/60 rounded-xl p-4 text-center">
            <div className="text-2xl mb-2">⛓️</div>
            <div className="text-2xl font-bold text-white">
              {stats.enabled ? 'Live' : 'Pending'}
            </div>
            <div className="text-xs text-zinc-500">{stats.network}</div>
          </div>
        </div>

        {/* Visual chain animation */}
        <div className="mt-5 flex items-center justify-center gap-2 text-xs text-zinc-600">
          <span className="bg-purple-500/20 text-purple-300 px-2 py-1 rounded">Review</span>
          <span>→</span>
          <span className="bg-amber-500/20 text-amber-300 px-2 py-1 rounded">Gemini AI Check</span>
          <span>→</span>
          <span className="bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded">BSC On-Chain ✓</span>
          <span>→</span>
          <span className="bg-cyan-500/20 text-cyan-300 px-2 py-1 rounded">Trust Score</span>
        </div>
      </div>
    </section>
  )
}
