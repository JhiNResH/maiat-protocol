'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import Link from 'next/link'
import { Header } from '@/components/Header'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReviewableAgent {
  address: string
  name: string
  logo: string | null
  score: number | null
  lastInteraction: string
  reviewed: boolean
}

interface PassportData {
  address: string
  passport: {
    trustLevel: string
    reputationScore: number
    totalReviews: number
    totalUpvotes: number
    feeTier: number
    feeDiscount: string
  }
  scarab: { balance: number }
  reviews: {
    recent: Array<{ id: string; rating: number; comment: string; address: string; name?: string | null; createdAt: string }>
    count: number
    averageRating: number
  }
}

// ── Trust level config ────────────────────────────────────────────────────────

const TRUST_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; rank: number }> = {
  new:      { label: 'NEW',      color: '#9CA3AF', bg: '#1a1a1a',   border: '#333',    rank: 0 },
  basic:    { label: 'BASIC',    color: '#60A5FA', bg: '#0f1b2d',   border: '#1e40af', rank: 1 },
  trusted:  { label: 'TRUSTED',  color: '#34D399', bg: '#0a1f14',   border: '#065f46', rank: 2 },
  verified: { label: 'VERIFIED', color: '#FBBF24', bg: '#1c1206',   border: '#92400e', rank: 3 },
  guardian: { label: 'GUARDIAN', color: '#A78BFA', bg: '#130f21',   border: '#4c1d95', rank: 4 },
}

const TRUST_PERKS: Record<string, string[]> = {
  new:      ['Read-only access', 'No review privileges'],
  basic:    ['1x review weight'],
  trusted:  ['2x review weight', 'Claim Scarab daily'],
  verified: ['3x review weight', 'Early access features'],
  guardian: ['5x review weight', 'Governance voting', 'Guardian badge'],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(addr: string) {
  return addr.slice(0, 6) + '…' + addr.slice(-4)
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="text-xs font-mono">
      {[1,2,3,4,5].map(i => (
        <span key={i} className={i <= rating ? 'text-cyan-400' : 'text-gray-700'}>★</span>
      ))}
    </span>
  )
}

function RepBar({ score }: { score: number }) {
  const pct = Math.min(100, score)
  const color = pct >= 70 ? '#A78BFA' : pct >= 40 ? '#FBBF24' : pct >= 15 ? '#34D399' : '#9CA3AF'
  return (
    <div className="w-full bg-[#1a1a1a] rounded-full h-1.5 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PassportPage() {
  const params = useParams()
  const address = (params?.address as string)?.toLowerCase()
  const { user } = usePrivy()

  const [data, setData] = useState<PassportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  // reviewable projects removed — only agents matter now
  const [reviewableAgents, setReviewableAgents] = useState<ReviewableAgent[]>([])
  const [agentsLoading, setAgentsLoading] = useState(false)
  const [showAllAgents, setShowAllAgents] = useState(false)

  const isOwn = user?.wallet?.address?.toLowerCase() === address

  useEffect(() => {
    if (!address || !/^0x[a-f0-9]{40}$/.test(address)) return
    setLoading(true)
    fetch(`/api/v1/wallet/${address}/passport`)
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [address])

    // Projects section removed — only ACP agents are reviewable now

  // Fetch reviewable agents: first try ACP interactions, fallback to top agents
  useEffect(() => {
    if (!address || !/^0x[a-f0-9]{40}$/.test(address)) return
    setAgentsLoading(true)
    fetch(`/api/v1/passport/${address}/reviewable`)
      .then(r => r.json())
      .then((d) => {
        setReviewableAgents(d.agents ?? [])
      })
      .catch(console.error)
      .finally(() => setAgentsLoading(false))
  }, [address])

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center">
        <Header />
        <p className="font-mono text-gray-500 text-xs animate-pulse m-auto">// LOADING PASSPORT…</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center gap-3">
        <Header />
        <div className="m-auto flex flex-col items-center gap-3">
          <p className="font-mono text-slate-400 text-sm">// INVALID ADDRESS</p>
          <Link href="/explore" className="font-mono text-[#3b82f6] text-xs hover:underline">← back to explore</Link>
        </div>
      </div>
    )
  }

  const trust = TRUST_CONFIG[data.passport.trustLevel] ?? TRUST_CONFIG.new
  const perks = TRUST_PERKS[data.passport.trustLevel] ?? TRUST_PERKS.new
  const unreviewedAgents = reviewableAgents.filter(a => !a.reviewed)
  const visibleAgents = showAllAgents ? unreviewedAgents : unreviewedAgents.slice(0, 10)

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col">
      <Header />

      <main className="flex-1 flex flex-col items-center pt-6 px-4 pb-12">
        {/* Share / own badge bar */}
        <div className="w-full max-w-md flex items-center justify-end gap-2 mb-3">
          {isOwn && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-[#3b82f6]/40 text-[#3b82f6]">
              YOUR PASSPORT
            </span>
          )}
          <button
            onClick={handleCopy}
            className="text-[10px] font-mono text-gray-500 hover:text-gray-300 border border-[#333] hover:border-[#555] px-2 py-1 rounded transition-colors"
          >
            {copied ? '✓ Copied' : '⎘ Share'}
          </button>
        </div>

        <div className="w-full max-w-md space-y-3">

          {/* ── Passport card ─────────────────────────────────────────────── */}
          <div
            className="rounded-xl p-4 border relative overflow-hidden"
            style={{ background: trust.bg, borderColor: trust.border }}
          >
            <div
              className="absolute right-3 top-1/2 -translate-y-1/2 text-7xl font-black opacity-5 font-mono pointer-events-none select-none"
              style={{ color: trust.color }}
            >
              {trust.label}
            </div>

            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-gray-500 font-mono text-[10px] mb-0.5">// TRUST PASSPORT</p>
                <p className="text-white font-mono text-sm font-bold">{fmt(data.address)}</p>
              </div>
              <span
                className="text-[10px] font-bold font-mono px-2 py-1 rounded-lg border"
                style={{ color: trust.color, borderColor: trust.border, backgroundColor: `${trust.color}18` }}
              >
                {trust.label}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-black/20 rounded-lg p-2 text-center">
                <p className="text-[10px] font-mono text-gray-500">REP</p>
                <p className="text-base font-bold font-mono" style={{ color: trust.color }}>
                  {data.passport.reputationScore}
                </p>
              </div>
              <div className="bg-black/20 rounded-lg p-2 text-center">
                <p className="text-[10px] font-mono text-gray-500">REVIEWS</p>
                <p className="text-base font-bold font-mono text-white">
                  {data.passport.totalReviews}
                </p>
              </div>
              <div className="bg-black/20 rounded-lg p-2 text-center">
                <p className="text-[10px] font-mono text-gray-500">🪲 SCARAB</p>
                <p className="text-base font-bold font-mono text-white">
                  {data.scarab.balance}
                </p>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-[10px] font-mono text-gray-500">Reputation</span>
                <span className="text-[10px] font-mono" style={{ color: trust.color }}>{data.passport.reputationScore} pts</span>
              </div>
              <RepBar score={data.passport.reputationScore} />
            </div>
          </div>

          {/* ── Review Agents (2-col grid, max 10) ────────────────────── */}
          <div className="bg-[#111] border border-[#1e1e1e] rounded-xl px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-500 font-mono text-[10px]">// AGENTS YOU CAN REVIEW</p>
              {unreviewedAgents.length > 0 && (
                <span className="text-[10px] font-mono text-gray-600">{unreviewedAgents.length} pending</span>
              )}
            </div>

            {agentsLoading ? (
              <p className="text-gray-600 font-mono text-[10px] animate-pulse py-1">// scanning ACP history…</p>
            ) : unreviewedAgents.length === 0 ? (
              <div className="text-center py-2">
                <p className="text-gray-600 font-mono text-[10px]">No unreviewed agents.</p>
                <Link href="/explore" className="text-[10px] font-mono text-[#3b82f6] hover:underline">Explore agents →</Link>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-1.5">
                  {visibleAgents.map(agent => {
                    const score = agent.score != null ? (agent.score / 10).toFixed(1) : '—'
                    const scoreColor = agent.score == null ? 'text-gray-500' :
                      agent.score >= 70 ? 'text-[#3b82f6]' :
                      agent.score >= 40 ? 'text-[#06b6d4]' : 'text-[#3b82f6]'

                    return (
                      <Link
                        key={agent.address}
                        href={`/review/${agent.address}`}
                        className="flex items-center gap-2 border border-[#1e1e1e] rounded-lg px-2 py-1.5 hover:border-[#333] transition-colors"
                      >
                        {agent.logo ? (
                          <img src={agent.logo} alt={agent.name} className="w-6 h-6 rounded object-cover shrink-0" />
                        ) : (
                          <div className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold shrink-0"
                            style={{ background: '#3b82f622', color: '#3b82f6', border: '1px solid #3b82f644' }}>
                            {agent.name.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-white font-mono text-[10px] font-semibold truncate">{agent.name}</p>
                          <p className="text-gray-600 font-mono text-[9px]"><span className={scoreColor}>{score}</span></p>
                        </div>
                      </Link>
                    )
                  })}
                </div>
                {unreviewedAgents.length > 10 && !showAllAgents && (
                  <button
                    onClick={() => setShowAllAgents(true)}
                    className="mt-2 w-full text-[10px] font-mono text-[#3b82f6] hover:underline"
                  >
                    Show {unreviewedAgents.length - 10} more →
                  </button>
                )}
              </>
            )}
          </div>

          {/* ── Level Perks (inline pills) ────────────────────────────── */}
          <div className="bg-[#111] border border-[#1e1e1e] rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-gray-500 font-mono text-[10px] shrink-0">PERKS</span>
              {perks.map((p, i) => (
                <span
                  key={i}
                  className="text-[10px] font-mono px-2 py-0.5 rounded-full border"
                  style={{ color: trust.color, borderColor: trust.border, backgroundColor: `${trust.color}10` }}
                >
                  ✓ {p}
                </span>
              ))}
            </div>
            {data.passport.trustLevel !== 'guardian' && (
              <p className="mt-1.5 text-[10px] font-mono text-gray-600">
                Review more to level up → <Link href="/explore" className="text-[#3b82f6] hover:underline">browse</Link>
              </p>
            )}
          </div>

          {/* ── Review history ─────────────────────────────────────────────── */}
          <div className="bg-[#111] border border-[#1e1e1e] rounded-xl px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-500 font-mono text-[10px]">// REVIEW HISTORY</p>
              {data.reviews.count > 0 && (
                <span className="text-[10px] font-mono text-gray-600">{data.reviews.count} total</span>
              )}
            </div>

            {data.reviews.recent.length === 0 ? (
              <div className="text-center py-2">
                <p className="text-gray-600 font-mono text-[10px]">No reviews yet.</p>
                {isOwn && (
                  <Link href="/review" className="text-[10px] font-mono text-[#3b82f6] hover:underline">
                    Leave your first review →
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                {data.reviews.recent.map(r => (
                  <div key={r.id} className="border border-[#1e1e1e] rounded-lg px-2.5 py-1.5">
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/review/${r.address}`}
                        className="text-[10px] font-mono text-gray-400 hover:text-white transition-colors"
                      >
                        {r.name || fmt(r.address)}
                      </Link>
                      <div className="flex items-center gap-1.5">
                        <StarRating rating={r.rating} />
                        <span className="text-gray-600 font-mono text-[10px]">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    {r.comment && (
                      <p className="text-gray-500 font-mono text-[10px] leading-snug mt-0.5">
                        &ldquo;{r.comment.slice(0, 80)}{r.comment.length > 80 ? '…' : ''}&rdquo;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── CTA ───────────────────────────────────────────────────────── */}
          {!isOwn && (
            <div className="bg-[#111] border border-[#1e1e1e] rounded-xl px-4 py-3 text-center">
              <p className="text-gray-500 font-mono text-[10px] mb-2">View your own trust passport</p>
              <Link
                href="/passport"
                className="inline-block bg-[#3b82f6] hover:bg-[#DC2626] text-white font-mono font-bold text-xs px-5 py-2 rounded-lg transition-colors"
              >
                Connect Wallet →
              </Link>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
