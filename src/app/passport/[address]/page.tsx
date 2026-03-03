'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReviewableProject {
  name: string | null
  address: string
  category: string | null
  txCount: number
  trustScore: number | null
  hasReviewed: boolean
}

interface ReviewableAgent {
  address: string
  name: string
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
        <span key={i} className={i <= rating ? 'text-yellow-400' : 'text-gray-700'}>★</span>
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
  const router = useRouter()
  const address = (params?.address as string)?.toLowerCase()
  const { user } = usePrivy()

  const [data, setData] = useState<PassportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [reviewable, setReviewable] = useState<ReviewableProject[]>([])
  const [reviewableLoading, setReviewableLoading] = useState(false)
  const [reviewableAgents, setReviewableAgents] = useState<ReviewableAgent[]>([])
  const [agentsLoading, setAgentsLoading] = useState(false)

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

  // Fetch projects this wallet can review (on-chain interaction verified)
  useEffect(() => {
    if (!address || !/^0x[a-f0-9]{40}$/.test(address)) return
    setReviewableLoading(true)
    fetch(`/api/v1/wallet/${address}/interactions`)
      .then(r => r.json())
      .then(async (d) => {
        const interacted = d.interacted ?? []
        if (interacted.length > 0) {
          setReviewable(interacted)
        } else {
          // Fallback: show top agents so new users can review
          const res = await fetch('/api/v1/agents?sort=jobs&limit=10')
          const data = await res.json()
          setReviewable((data.agents ?? []).map((a: any) => ({
            name: a.name || null,
            address: a.id,
            category: a.category || null,
            txCount: 0,
            trustScore: a.trust?.score ?? null,
            hasReviewed: false,
          })))
        }
      })
      .catch(console.error)
      .finally(() => setReviewableLoading(false))
  }, [address])

  // Fetch reviewable agents: first try ACP interactions, fallback to top agents
  useEffect(() => {
    if (!address || !/^0x[a-f0-9]{40}$/.test(address)) return
    setAgentsLoading(true)
    fetch(`/api/v1/passport/${address}/reviewable`)
      .then(r => r.json())
      .then(async (d) => {
        const agents = d.agents ?? []
        if (agents.length > 0) {
          setReviewableAgents(agents)
        } else {
          // Fallback: show top agents by jobs so new users have something to review
          const res = await fetch('/api/v1/agents?sort=jobs&limit=20')
          const data = await res.json()
          setReviewableAgents((data.agents ?? []).map((a: any) => ({
            address: a.id,
            name: a.name || a.id.slice(0, 10),
            score: a.trust?.score ?? null,
            lastInteraction: '',
            reviewed: false,
          })))
        }
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
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <p className="font-mono text-gray-500 text-xs animate-pulse">// LOADING PASSPORT…</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center gap-3">
        <p className="font-mono text-red-400 text-sm">// INVALID ADDRESS</p>
        <Link href="/explore" className="font-mono text-[#0052FF] text-xs hover:underline">← back to explore</Link>
      </div>
    )
  }

  const trust = TRUST_CONFIG[data.passport.trustLevel] ?? TRUST_CONFIG.new
  const perks = TRUST_PERKS[data.passport.trustLevel] ?? TRUST_PERKS.new

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col">
      {/* Header */}
      <header className="border-b border-[#1a1a1a] px-6 py-4 flex items-center justify-between">
        <Link href="/explore" className="flex items-center gap-2 group">
          <span className="text-[#0052FF] font-mono font-bold text-sm tracking-wider">MAIAT</span>
          <span className="text-gray-600 font-mono text-xs group-hover:text-gray-400 transition-colors">← explore</span>
        </Link>
        <div className="flex items-center gap-3">
          {isOwn && (
            <span className="text-xs font-mono px-2 py-0.5 rounded border border-[#0052FF]/40 text-[#0052FF]">
              YOUR PASSPORT
            </span>
          )}
          <button
            onClick={handleCopy}
            className="text-xs font-mono text-gray-500 hover:text-gray-300 border border-[#333] hover:border-[#555] px-3 py-1.5 rounded transition-colors"
          >
            {copied ? '✓ Copied' : '⎘ Share'}
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center pt-10 px-4 pb-16">
        <div className="w-full max-w-md space-y-4">

          {/* ── Passport card ─────────────────────────────────────────────── */}
          <div
            className="rounded-xl p-6 border relative overflow-hidden"
            style={{ background: trust.bg, borderColor: trust.border }}
          >
            {/* Watermark */}
            <div
              className="absolute right-4 top-1/2 -translate-y-1/2 text-8xl font-black opacity-5 font-mono pointer-events-none select-none"
              style={{ color: trust.color }}
            >
              {trust.label}
            </div>

            {/* Trust badge */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-gray-500 font-mono text-xs mb-1">// TRUST PASSPORT</p>
                <p className="text-white font-mono text-sm font-bold">{fmt(data.address)}</p>
              </div>
              <span
                className="text-xs font-bold font-mono px-3 py-1.5 rounded-lg border"
                style={{ color: trust.color, borderColor: trust.border, backgroundColor: `${trust.color}18` }}
              >
                {trust.label}
              </span>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-black/20 rounded-lg p-3 text-center">
                <p className="text-xs font-mono text-gray-500 mb-1">REP</p>
                <p className="text-lg font-bold font-mono" style={{ color: trust.color }}>
                  {data.passport.reputationScore}
                </p>
              </div>
              <div className="bg-black/20 rounded-lg p-3 text-center">
                <p className="text-xs font-mono text-gray-500 mb-1">REVIEWS</p>
                <p className="text-lg font-bold font-mono text-white">
                  {data.passport.totalReviews}
                </p>
              </div>
              <div className="bg-black/20 rounded-lg p-3 text-center">
                <p className="text-xs font-mono text-gray-500 mb-1">🪲 SCARAB</p>
                <p className="text-lg font-bold font-mono text-white">
                  {data.scarab.balance}
                </p>
              </div>
            </div>

            {/* Rep bar */}
            <div className="mb-2">
              <div className="flex justify-between mb-1.5">
                <span className="text-xs font-mono text-gray-500">Reputation progress</span>
                <span className="text-xs font-mono" style={{ color: trust.color }}>{data.passport.reputationScore} pts</span>
              </div>
              <RepBar score={data.passport.reputationScore} />
            </div>

            {/* Fee tier — hidden until TrustGateHook is live on mainnet */}
          </div>

          {/* ── Projects to Review ────────────────────────────────────────── */}
          <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-500 font-mono text-xs">// PROJECTS YOU CAN REVIEW</p>
              {reviewable.length > 0 && (
                <span className="text-xs font-mono text-gray-600">
                  {reviewable.filter(p => !p.hasReviewed).length} pending · {reviewable.filter(p => p.hasReviewed).length} done
                </span>
              )}
            </div>

            {reviewableLoading ? (
              <p className="text-gray-600 font-mono text-xs animate-pulse py-2">// scanning on-chain interactions…</p>
            ) : reviewable.length === 0 ? (
              <div className="text-center py-4 space-y-2">
                <p className="text-gray-600 font-mono text-xs">No known protocols detected in wallet history.</p>
                <Link href="/explore" className="inline-block text-xs font-mono text-[#0052FF] hover:underline">
                  Browse projects to interact with →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {reviewable.map(p => {
                  const score = p.trustScore != null ? (p.trustScore / 10).toFixed(1) : '—'
                  const scoreColor = p.trustScore == null ? 'text-gray-500' :
                    p.trustScore >= 70 ? 'text-[#22C55E]' :
                    p.trustScore >= 40 ? 'text-[#F59E0B]' : 'text-[#EF4444]'
                  const catColor = p.category === 'm/ai-agents' ? '#0052FF' :
                    p.category === 'm/memecoin' ? '#F59E0B' : '#7C3AED'

                  return (
                    <div key={p.address} className="flex items-center justify-between border border-[#1e1e1e] rounded-lg px-3 py-2.5 hover:border-[#333] transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                          style={{ background: catColor + '22', color: catColor, border: `1px solid ${catColor}44` }}>
                          {(p.name ?? p.address).charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-mono text-xs font-semibold truncate">
                            {p.name ?? `${p.address.slice(0,6)}…${p.address.slice(-4)}`}
                          </p>
                          <p className="text-gray-600 font-mono text-[10px]">{p.txCount} tx · score <span className={scoreColor}>{score}</span></p>
                        </div>
                      </div>
                      {p.hasReviewed ? (
                        <span className="text-[10px] font-mono text-[#22C55E] border border-[#22C55E]/30 px-2 py-1 rounded shrink-0">
                          ✓ Reviewed
                        </span>
                      ) : (
                        <Link
                          href={`/review/${p.address}`}
                          className="text-[10px] font-mono font-bold text-white bg-[#0052FF] hover:bg-[#0040CC] px-3 py-1.5 rounded transition-colors shrink-0"
                        >
                          Review →
                        </Link>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Review Agents (ACP interactions) ────────────────────────── */}
          <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-500 font-mono text-xs">// REVIEW AGENTS</p>
              {reviewableAgents.length > 0 && (
                <span className="text-xs font-mono text-gray-600">
                  {reviewableAgents.filter(a => !a.reviewed).length} pending
                </span>
              )}
            </div>

            {agentsLoading ? (
              <p className="text-gray-600 font-mono text-xs animate-pulse py-2">// scanning ACP query history…</p>
            ) : reviewableAgents.filter(a => !a.reviewed).length === 0 ? (
              <div className="text-center py-4 space-y-2">
                <p className="text-gray-600 font-mono text-xs">No unreviewed agents from ACP interactions.</p>
                <Link href="/explore" className="inline-block text-xs font-mono text-[#0052FF] hover:underline">
                  Explore agents →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {reviewableAgents.filter(a => !a.reviewed).map(agent => {
                  const score = agent.score != null ? (agent.score / 10).toFixed(1) : '—'
                  const scoreColor = agent.score == null ? 'text-gray-500' :
                    agent.score >= 70 ? 'text-[#22C55E]' :
                    agent.score >= 40 ? 'text-[#F59E0B]' : 'text-[#EF4444]'

                  return (
                    <div key={agent.address} className="flex items-center justify-between border border-[#1e1e1e] rounded-lg px-3 py-2.5 hover:border-[#333] transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                          style={{ background: '#0052FF22', color: '#0052FF', border: '1px solid #0052FF44' }}>
                          {agent.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-mono text-xs font-semibold truncate">{agent.name}</p>
                          <p className="text-gray-600 font-mono text-[10px]">
                            score <span className={scoreColor}>{score}</span> · {new Date(agent.lastInteraction).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Link
                        href={`/review/${agent.address}`}
                        className="text-[10px] font-mono font-bold text-white bg-[#0052FF] hover:bg-[#0040CC] px-3 py-1.5 rounded transition-colors shrink-0"
                      >
                        Write Review →
                      </Link>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Perks ─────────────────────────────────────────────────────── */}
          <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-5">
            <p className="text-gray-500 font-mono text-xs mb-3">// LEVEL PERKS</p>
            <ul className="space-y-2">
              {perks.map((p, i) => (
                <li key={i} className="flex items-center gap-2 text-xs font-mono text-gray-300">
                  <span style={{ color: trust.color }}>✓</span> {p}
                </li>
              ))}
            </ul>
            {data.passport.trustLevel !== 'guardian' && (
              <p className="mt-3 text-xs font-mono text-gray-600">
                Submit more reviews to level up →{' '}
                <Link href="/explore" className="text-[#0052FF] hover:underline">browse projects</Link>
              </p>
            )}
          </div>

          {/* ── Review history ─────────────────────────────────────────────── */}
          <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-500 font-mono text-xs">// REVIEW HISTORY</p>
              {data.reviews.count > 0 && (
                <span className="text-xs font-mono text-gray-600">{data.reviews.count} total</span>
              )}
            </div>

            {data.reviews.recent.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-600 font-mono text-xs">No reviews yet.</p>
                {isOwn && (
                  <Link
                    href="/review"
                    className="inline-block mt-2 text-xs font-mono text-[#0052FF] hover:underline"
                  >
                    Leave your first review →
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {data.reviews.recent.map(r => (
                  <div key={r.id} className="border border-[#1e1e1e] rounded-lg px-3 py-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <Link
                        href={`/review/${r.address}`}
                        className="text-xs font-mono text-gray-400 hover:text-white transition-colors"
                      >
                        {r.name || fmt(r.address)}
                      </Link>
                      <div className="flex items-center gap-2">
                        <StarRating rating={r.rating} />
                        <span className="text-gray-600 font-mono text-xs">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    {r.comment && (
                      <p className="text-gray-500 font-mono text-xs leading-relaxed">
                        &ldquo;{r.comment.slice(0, 100)}{r.comment.length > 100 ? '…' : ''}&rdquo;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── CTA ───────────────────────────────────────────────────────── */}
          {!isOwn && (
            <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-5 text-center">
              <p className="text-gray-500 font-mono text-xs mb-3">
                View your own trust passport
              </p>
              <Link
                href="/passport"
                className="inline-block bg-[#0052FF] hover:bg-[#0040CC] text-white font-mono font-bold text-sm px-6 py-2.5 rounded-lg transition-colors"
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
