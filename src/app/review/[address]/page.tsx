'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import { ReviewForm } from '@/components/ReviewForm'
import { Header } from '@/components/Header'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentBreakdown {
  completionRate: number
  paymentRate: number
  expireRate: number
  totalJobs: number
  ageWeeks: number
  name?: string
}

interface AgentData {
  address: string
  name?: string | null
  profilePic?: string | null
  category?: string | null
  description?: string | null
  trustScore: number
  verdict: 'proceed' | 'caution' | 'avoid' | 'unknown'
  breakdown: AgentBreakdown
  dataSource: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function trunc(addr: string) {
  if (!addr || addr.length < 12) return addr
  return addr.slice(0, 6) + '...' + addr.slice(-4)
}

function verdictStyle(verdict: string) {
  switch (verdict) {
    case 'proceed': return 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/30'
    case 'caution': return 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30'
    case 'avoid':   return 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30'
    default:        return 'bg-[#666]/10 text-[#666] border-[#666]/30'
  }
}

function verdictLabel(verdict: string) {
  switch (verdict) {
    case 'proceed': return 'PROCEED'
    case 'caution': return 'CAUTION'
    case 'avoid':   return 'AVOID'
    default:        return 'UNKNOWN'
  }
}

function scoreColor(score: number | null) {
  if (score === null) return 'text-[#666]'
  if (score >= 80) return 'text-[#22C55E]'
  if (score >= 60) return 'text-[#F59E0B]'
  return 'text-[#EF4444]'
}

function pct(rate: number | undefined): string {
  if (rate === undefined || rate === null) return '—'
  return `${(rate * 100).toFixed(0)}%`
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ReviewPage() {
  const params = useParams()
  const address = (params?.address as string)?.toLowerCase()
  const { authenticated, login } = usePrivy()

  const [agent, setAgent] = useState<AgentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [reviewed, setReviewed] = useState(false)

  useEffect(() => {
    if (!address) return
    setLoading(true)

    fetch(`/api/v1/agent/${address}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return null }
        return r.json()
      })
      .then(data => {
        if (!data) return
        setAgent(data)
        setLoading(false)
      })
      .catch(() => {
        setNotFound(true)
        setLoading(false)
      })
  }, [address])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[#EF4444] border-t-transparent rounded-full animate-spin" />
            <p className="font-mono text-gray-500 text-xs">Loading agent...</p>
          </div>
        </div>
      </div>
    )
  }

  if (notFound || !agent) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <div className="w-16 h-16 rounded-xl bg-[#111] border border-[#222] flex items-center justify-center">
            <span className="text-2xl text-gray-600">?</span>
          </div>
          <p className="font-mono text-gray-400 text-sm">Agent not found</p>
          <p className="font-mono text-gray-600 text-xs text-center">
            {address} is not in the ACP ecosystem yet.
          </p>
          <Link href="/explore" className="text-xs font-mono text-[#EF4444] hover:underline">
            ← Browse all agents
          </Link>
        </div>
      </div>
    )
  }

  const name = agent.name || agent.breakdown?.name || trunc(agent.address)
  const bd = agent.breakdown

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col">
      <Header />

      <main className="flex-1 flex flex-col items-center pt-6 px-4 pb-16">
        <div className="w-full max-w-lg space-y-4">

          {/* Agent Card */}
          <div className="bg-[#111] border border-[#222] rounded-xl p-5">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              {agent.profilePic ? (
                <img
                  src={agent.profilePic}
                  alt={name}
                  className="w-14 h-14 rounded-xl object-cover shrink-0 border border-[#333]"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 flex items-center justify-center text-xl font-bold text-[#EF4444] shrink-0">
                  {name.charAt(0).toUpperCase()}
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h1 className="text-white font-mono font-bold text-lg truncate">{name}</h1>
                  <span className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded border ${verdictStyle(agent.verdict)}`}>
                    {verdictLabel(agent.verdict)}
                  </span>
                </div>

                {agent.category && (
                  <span className="text-[10px] font-mono text-gray-500 bg-[#1a1a1a] border border-[#222] px-2 py-0.5 rounded inline-block mb-2">
                    {agent.category}
                  </span>
                )}

                {agent.description && (
                  <p className="text-gray-500 font-mono text-xs leading-relaxed line-clamp-2 mb-2">
                    {agent.description}
                  </p>
                )}

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-gray-600">{trunc(agent.address)}</span>
                  <span className="text-gray-700">·</span>
                  <span className="text-[10px] font-mono text-gray-600">Base</span>
                </div>
              </div>

              {/* Trust Score */}
              <div className="shrink-0 text-center">
                <div className={`text-3xl font-black font-mono ${scoreColor(agent.trustScore)}`}>
                  {agent.trustScore}
                </div>
                <div className="text-[9px] font-mono text-gray-600 uppercase">Trust</div>
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-[#1a1a1a]">
              <div className="text-center">
                <div className="text-xs font-mono font-bold text-white">{bd?.totalJobs ?? '—'}</div>
                <div className="text-[9px] font-mono text-gray-600">Jobs</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-mono font-bold text-white">{bd?.ageWeeks ?? '—'}w</div>
                <div className="text-[9px] font-mono text-gray-600">Age</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-mono font-bold text-[#22C55E]">{pct(bd?.completionRate)}</div>
                <div className="text-[9px] font-mono text-gray-600">Complete</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-mono font-bold text-[#22C55E]">{pct(bd?.paymentRate)}</div>
                <div className="text-[9px] font-mono text-gray-600">Paid</div>
              </div>
            </div>
          </div>

          {/* Review Section */}
          {reviewed ? (
            <div className="bg-[#0a1a0a] border border-[#22C55E]/30 rounded-xl p-6 text-center">
              <p className="text-[#22C55E] font-mono font-bold mb-1">Review submitted</p>
              <p className="text-gray-500 font-mono text-xs mb-4">Thank you for contributing to the trust network.</p>
              <div className="flex gap-3 justify-center">
                <Link
                  href="/explore"
                  className="text-xs font-mono text-[#EF4444] border border-[#EF4444]/30 hover:bg-[#EF4444]/10 px-4 py-2 rounded-lg transition-colors"
                >
                  Browse agents
                </Link>
                <Link
                  href={`/agent/${agent.address}`}
                  className="text-xs font-mono text-gray-400 border border-[#333] hover:border-gray-500 px-4 py-2 rounded-lg transition-colors"
                >
                  View agent
                </Link>
              </div>
            </div>
          ) : !authenticated ? (
            <div className="bg-[#111] border border-[#222] rounded-xl p-6 text-center">
              <div className="mb-5">
                <p className="text-white font-mono font-bold text-sm mb-2">
                  Connect wallet to review
                </p>
                <p className="text-gray-500 font-mono text-xs leading-relaxed">
                  Only wallets with on-chain interaction history<br />
                  with this agent can submit reviews.
                </p>
              </div>
              <button
                onClick={login}
                className="w-full bg-[#EF4444] hover:bg-[#DC2626] text-white font-mono font-bold text-sm py-3 rounded-lg transition-colors"
              >
                Connect Wallet
              </button>
            </div>
          ) : (
            <ReviewForm
              projectId={agent.address}
              projectName={name}
              onSuccess={() => setReviewed(true)}
            />
          )}

          {/* Footer */}
          <p className="text-center text-gray-700 font-mono text-[10px]">
            Reviews weighted by on-chain depth · -2 Scarab per review
          </p>
        </div>
      </main>
    </div>
  )
}
