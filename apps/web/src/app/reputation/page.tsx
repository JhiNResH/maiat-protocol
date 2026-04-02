'use client'

import { useState, useEffect } from 'react'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { motion } from 'framer-motion'
import { createPublicClient, http, defineChain } from 'viem'
import { Search, Shield, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import {
  CONTRACTS, REPUTATION_ENGINE_ABI, SKILL_REGISTRY_ABI, SKILL_ICONS,
} from '@/lib/xlayer-contracts'

const xlayerTestnet = defineChain({
  id: 1952,
  name: 'X Layer Testnet',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: { default: { http: ['https://testrpc.xlayer.tech/terigon'] } },
  blockExplorers: { default: { name: 'OKX Explorer', url: 'https://www.okx.com/web3/explorer/xlayer-test' } },
})

const publicClient = createPublicClient({ chain: xlayerTestnet, transport: http() })

interface SkillRep {
  skillId: number
  skillName: string
  score: number
  ratingCount: number
}

function getScoreColor(score: number): string {
  if (score >= 90) return 'text-green-400'
  if (score >= 70) return 'text-blue-400'
  if (score >= 50) return 'text-yellow-400'
  if (score >= 30) return 'text-orange-400'
  return 'text-red-400'
}

function getBarColor(score: number): string {
  if (score >= 90) return 'bg-green-500'
  if (score >= 70) return 'bg-blue-500'
  if (score >= 50) return 'bg-yellow-500'
  if (score >= 30) return 'bg-orange-500'
  return 'bg-red-500'
}

function getFeeLabel(feeBps: number, baseBps: number): { text: string; color: string; icon: typeof TrendingUp } {
  const pct = Math.round((feeBps / baseBps) * 100)
  if (pct <= 50) return { text: `${pct}% of base (Elite reward)`, color: 'text-green-400', icon: TrendingDown }
  if (pct <= 75) return { text: `${pct}% of base (Good discount)`, color: 'text-blue-400', icon: TrendingDown }
  if (pct <= 100) return { text: `${pct}% of base (Neutral)`, color: 'text-yellow-400', icon: Minus }
  if (pct <= 150) return { text: `${pct}% of base (Penalty)`, color: 'text-orange-400', icon: TrendingUp }
  return { text: `${pct}% of base (High penalty)`, color: 'text-red-400', icon: TrendingUp }
}

export default function ReputationPage() {
  const { authenticated } = usePrivy()
  const { wallets } = useWallets()
  const wallet = wallets?.[0]

  const [searchAddr, setSearchAddr] = useState('')
  const [targetAddr, setTargetAddr] = useState('')
  const [globalRep, setGlobalRep] = useState<number | null>(null)
  const [skillReps, setSkillReps] = useState<SkillRep[]>([])
  const [adjustedFee, setAdjustedFee] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const loadReputation = async (address: string) => {
    if (!address) return
    setLoading(true)
    setTargetAddr(address)
    try {
      // Global reputation
      const global = await publicClient.readContract({
        address: CONTRACTS.reputationEngine as `0x${string}`,
        abi: REPUTATION_ENGINE_ABI,
        functionName: 'getGlobalReputation',
        args: [address as `0x${string}`],
      }) as bigint
      setGlobalRep(Number(global))

      // Fee calculation
      const fee = await publicClient.readContract({
        address: CONTRACTS.reputationEngine as `0x${string}`,
        abi: REPUTATION_ENGINE_ABI,
        functionName: 'calculateFee',
        args: [address as `0x${string}`, BigInt(500)],
      }) as bigint
      setAdjustedFee(Number(fee))

      // Per-skill reputation
      const ratedSkills = await publicClient.readContract({
        address: CONTRACTS.reputationEngine as `0x${string}`,
        abi: REPUTATION_ENGINE_ABI,
        functionName: 'getRatedSkills',
        args: [address as `0x${string}`],
      }) as bigint[]

      const reps: SkillRep[] = []
      for (const sid of ratedSkills) {
        const score = await publicClient.readContract({
          address: CONTRACTS.reputationEngine as `0x${string}`,
          abi: REPUTATION_ENGINE_ABI,
          functionName: 'getReputation',
          args: [address as `0x${string}`, sid],
        }) as bigint

        const count = await publicClient.readContract({
          address: CONTRACTS.reputationEngine as `0x${string}`,
          abi: REPUTATION_ENGINE_ABI,
          functionName: 'getRatingCount',
          args: [address as `0x${string}`, sid],
        }) as bigint

        let skillName = `Skill #${sid}`
        try {
          const sk = await publicClient.readContract({
            address: CONTRACTS.skillRegistry as `0x${string}`,
            abi: SKILL_REGISTRY_ABI,
            functionName: 'getSkill',
            args: [sid],
          }) as [string, string, string, bigint, number, bigint]
          skillName = sk[1]
        } catch { /* skip */ }

        reps.push({
          skillId: Number(sid),
          skillName,
          score: Number(score),
          ratingCount: Number(count),
        })
      }
      setSkillReps(reps)
    } catch (err) {
      console.error('Failed to load reputation:', err)
    } finally {
      setLoading(false)
    }
  }

  // Auto-load connected wallet
  useEffect(() => {
    if (wallet?.address && !targetAddr && CONTRACTS.reputationEngine !== '0x0000000000000000000000000000000000000000') {
      loadReputation(wallet.address)
    }
  }, [wallet?.address]) // eslint-disable-line react-hooks/exhaustive-deps

  const baseFee = 500
  const feeInfo = adjustedFee ? getFeeLabel(adjustedFee, baseFee) : null

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
          📊 Reputation Dashboard
        </h1>
        <p className="text-white/60 text-lg">
          Per-skill reputation scores with dynamic fee adjustment (ERC-8183)
        </p>
      </motion.div>

      {/* Search */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-10">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
            <input
              type="text"
              value={searchAddr}
              onChange={e => setSearchAddr(e.target.value)}
              placeholder="Enter agent address (0x...)"
              className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:border-purple-500/50 outline-none"
            />
          </div>
          <button
            onClick={() => loadReputation(searchAddr)}
            disabled={!searchAddr || loading}
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl font-medium disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Search'}
          </button>
        </div>
        {wallet?.address && (
          <button
            onClick={() => { setSearchAddr(wallet.address!); loadReputation(wallet.address!) }}
            className="mt-2 text-sm text-purple-400 hover:text-purple-300"
          >
            Use my wallet: {wallet.address.slice(0, 8)}...
          </button>
        )}
      </motion.div>

      {/* Results */}
      {targetAddr && !loading && (
        <div className="space-y-8">
          {/* Global Score */}
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
            <p className="text-white/40 text-sm mb-2">Global Reputation</p>
            <p className="text-xs text-white/30 mb-4">{targetAddr.slice(0, 10)}...{targetAddr.slice(-8)}</p>
            <div className={`text-7xl font-bold ${getScoreColor(globalRep || 50)}`}>
              {globalRep ?? 50}
            </div>
            <p className="text-white/40 text-sm mt-2">/ 100</p>

            {/* Fee Info */}
            {feeInfo && (
              <div className="mt-6 flex items-center justify-center gap-3">
                <Shield className="w-5 h-5 text-purple-400" />
                <div className="text-sm">
                  <span className="text-white/50">Base fee: {baseFee} bps → Adjusted: </span>
                  <span className={`font-bold ${feeInfo.color}`}>{adjustedFee} bps</span>
                  <span className={`ml-2 ${feeInfo.color}`}>({feeInfo.text})</span>
                </div>
              </div>
            )}
          </motion.div>

          {/* Per-Skill Bars */}
          {skillReps.length > 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="text-xl font-semibold mb-6">Per-Skill Reputation</h2>
              <div className="space-y-5">
                {skillReps.map((sr, idx) => (
                  <motion.div
                    key={sr.skillId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{SKILL_ICONS[sr.skillId] || '🔮'}</span>
                        <span className="text-white/80 font-medium">{sr.skillName}</span>
                        <span className="text-white/30 text-xs">({sr.ratingCount} ratings)</span>
                      </div>
                      <span className={`font-bold text-lg ${getScoreColor(sr.score)}`}>{sr.score}</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${sr.score}%` }}
                        transition={{ duration: 0.8, delay: idx * 0.1 }}
                        className={`h-full rounded-full ${getBarColor(sr.score)}`}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center text-white/40">
              <p>No skill-specific ratings yet.</p>
              <p className="text-sm mt-1">Complete jobs to build per-skill reputation.</p>
            </div>
          )}

          {/* Fee Scale Legend */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4">📐 Fee Scale (ERC-8183)</h2>
            <div className="grid grid-cols-5 gap-2 text-center text-sm">
              {[
                { range: '90-100', label: '50% fee', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
                { range: '70-89', label: '75% fee', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
                { range: '50-69', label: '100% fee', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
                { range: '30-49', label: '150% fee', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
                { range: '0-29', label: '200% fee', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
              ].map(tier => (
                <div key={tier.range} className={`border rounded-xl p-3 ${tier.color}`}>
                  <div className="font-bold">{tier.range}</div>
                  <div className="text-xs opacity-70">{tier.label}</div>
                </div>
              ))}
            </div>
            <p className="text-white/30 text-xs mt-3 text-center">
              Higher reputation = Lower fees = More competitive in the job market
            </p>
          </motion.div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-white/40">Loading reputation data...</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-center gap-4 mt-12">
        <a href="/dojo" className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-white/70 hover:text-white">
          ← Skill Marketplace
        </a>
        <a href="/jobs" className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-white/70 hover:text-white">
          ← Job Board
        </a>
      </div>
    </div>
  )
}
