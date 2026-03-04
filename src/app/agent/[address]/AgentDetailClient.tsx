'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import { Header } from '@/components/Header'
import {
  Copy, ExternalLink, Shield, Activity,
  CheckCircle, MessageSquare, Trophy, Flame, ArrowLeft, TrendingUp,
} from 'lucide-react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentBreakdown {
  completionRate: number
  paymentRate: number
  expireRate: number
  totalJobs: number
  ageWeeks: number
  uniqueBuyerCount?: number | null
  successRate?: number | null
  name?: string
}

interface AgentScore {
  address: string
  name?: string | null
  profilePic?: string | null
  category?: string | null
  description?: string | null
  analysis?: string | null
  trustScore: number
  dataSource: string
  breakdown: AgentBreakdown
  verdict: 'proceed' | 'caution' | 'avoid' | 'unknown'
  lastUpdated: string
}

interface Review {
  id: string
  reviewer: string
  rating: number
  comment: string
  weight: number
  timestamp: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function trunc(addr: string) {
  if (!addr || addr.length < 12) return addr
  return addr.slice(0, 6) + '...' + addr.slice(-4)
}

function verdictColor(verdict: string): string {
  if (verdict === 'proceed') return '#10b981'
  if (verdict === 'caution') return '#f59e0b'
  if (verdict === 'avoid')   return '#ef4444'
  return '#475569'
}

function verdictBg(verdict: string): string {
  if (verdict === 'proceed') return 'bg-[#10b981]/10 border-[#10b981]/30 text-[#10b981]'
  if (verdict === 'caution') return 'bg-[#f59e0b]/10 border-[#f59e0b]/30 text-[#f59e0b]'
  if (verdict === 'avoid')   return 'bg-[#ef4444]/10 border-[#ef4444]/30 text-[#ef4444]'
  return 'bg-slate-500/10 border-slate-500/30 text-slate-400'
}

function verdictLabel(verdict: string): string {
  if (verdict === 'proceed') return '✅ PROCEED'
  if (verdict === 'caution') return '⚠️ CAUTION'
  if (verdict === 'avoid')   return '🚫 AVOID'
  return '❓ UNKNOWN'
}

function scoreColor(s: number): string {
  if (s >= 80) return '#10b981'
  if (s >= 60) return '#f59e0b'
  return '#ef4444'
}

function pct(rate: number | undefined): string {
  if (rate === undefined || rate === null) return '—'
  return `${(rate * 100).toFixed(1)}%`
}

function StarRow({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={i <= Math.round(rating) ? 'text-[#d4a017]' : 'text-[#2a2d45]'}>★</span>
      ))}
    </span>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[#13141f] rounded-xl p-4 border border-[#1e2035] flex flex-col gap-1">
      <div className="text-[9px] text-[#475569] font-mono uppercase tracking-wider">{label}</div>
      <div className="text-lg font-black text-[#f1f5f9]">{value}</div>
      {sub && <div className="text-[10px] text-[#475569] font-mono">{sub}</div>}
    </div>
  )
}

// ─── Rate Bar ─────────────────────────────────────────────────────────────────

function RateBar({ label, value, good = true }: { label: string; value: number | undefined; good?: boolean }) {
  const v = value ?? 0
  const pctNum = Math.min(100, v * 100)
  const color = good
    ? pctNum >= 80 ? '#3b82f6' : pctNum >= 50 ? '#06b6d4' : '#64748b'
    : pctNum <= 5  ? '#3b82f6' : pctNum <= 20 ? '#06b6d4' : '#64748b'
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#94a3b8] font-mono uppercase tracking-wider">{label}</span>
        <span className="font-bold font-mono" style={{ color }}>{pct(value)}</span>
      </div>
      <div className="h-1.5 bg-[#1e2035] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pctNum}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

// ─── Review Form ──────────────────────────────────────────────────────────────

function ReviewFormInline({
  agentAddress,
  agentName,
  scarabBalance,
  onSuccess,
}: {
  agentAddress: string
  agentName: string
  scarabBalance: number | null
  onSuccess: () => void
}) {
  const { authenticated, user, login } = usePrivy()
  const [rating, setRating]         = useState(5)
  const [comment, setComment]       = useState('')
  const [easReceiptId, setEasId]    = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult]         = useState<{ earned?: number; msg?: string; error?: string } | null>(null)

  const walletAddress = user?.wallet?.address
  const canAfford = scarabBalance === null || scarabBalance >= 2

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!walletAddress || !canAfford) return
    setSubmitting(true); setResult(null)
    try {
      const res = await fetch('/api/v1/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: agentAddress,
          reviewer: walletAddress,
          rating,
          comment: comment.trim() || undefined,
          easReceiptId: easReceiptId.trim() || undefined,
          source: 'human',
        }),
      })
      const data = await res.json()
      if (!res.ok) { setResult({ error: data.error || 'Failed' }); return }
      setResult({ earned: data.scarabEarned, msg: 'Review submitted!' })
      setComment(''); setRating(5); setEasId('')
      onSuccess()
    } catch { setResult({ error: 'Network error' }) }
    finally { setSubmitting(false) }
  }

  // ── Inline wallet gate (NOT full-page) ────────────────────────────────────
  if (!authenticated) return (
    <div className="bg-[#0d0e17] border border-[#1e2035] rounded-xl p-6 text-center">
      <div className="text-2xl mb-2">🪲</div>
      <p className="text-[#94a3b8] text-sm mb-1">Connect wallet to review and earn Scarab</p>
      <p className="text-[#475569] text-xs mb-4 font-mono">Reviews cost 2 🪲 · Quality reviews earn up to +10 🪲</p>
      <button
        onClick={login}
        className="px-6 py-2 bg-[#3b82f6] hover:bg-[#DC2626] text-white font-semibold text-sm rounded-xl transition-colors"
      >
        Connect Wallet
      </button>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="bg-[#0d0e17] border border-[#1e2035] rounded-xl p-6 flex flex-col gap-4">
      {/* Weight info banner */}
      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-2 text-xs text-indigo-300 font-mono">
        <span className="font-semibold">Review weight:</span> 1× base · <span className="text-blue-400">3× with on-chain interaction proof</span> · <span className="text-cyan-300">5× with EAS receipt</span>
      </div>

      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-[#475569]">
          Costs <span className="text-[#d4a017]">2 🪲</span> · Earn up to <span className="text-[#d4a017]">+10 🪲</span>
        </span>
        {scarabBalance !== null && (
          <span className="text-[#475569]">
            Balance: <span className={canAfford ? 'text-[#d4a017]' : 'text-slate-400'}>🪲 {scarabBalance}</span>
          </span>
        )}
      </div>

      {!canAfford && (
        <div className="bg-slate-500/10 border border-slate-500/20 rounded-lg px-3 py-2 text-xs text-slate-400 font-mono">
          Insufficient Scarab. Claim daily 🪲 from sidebar.
        </div>
      )}

      <div>
        <label className="text-xs text-[#475569] font-mono uppercase tracking-wider block mb-2">Rating</label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(s => (
            <button
              type="button"
              key={s}
              onClick={() => setRating(s)}
              className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-all border ${
                s <= rating
                  ? 'text-[#d4a017] bg-[#d4a017]/10 border-[#d4a017]/30'
                  : 'text-[#1e2035] bg-[#13141f] border-[#1e2035] hover:border-[#2a2d45]'
              }`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-[#475569] font-mono uppercase tracking-wider block mb-2">
          Analysis <span className="normal-case text-[#2a2d45]">(optional)</span>
        </label>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder={`Share your experience with ${agentName}...`}
          rows={3}
          className="w-full bg-[#13141f] border border-[#1e2035] focus:border-[#3b82f6]/40 rounded-xl px-4 py-3 text-sm text-[#f1f5f9] placeholder-[#2a2d45] focus:outline-none resize-none transition-all"
        />
      </div>

      <div>
        <label className="text-xs text-[#475569] font-mono uppercase tracking-wider block mb-2">
          EAS Receipt <span className="normal-case text-[#2a2d45]">(optional — 5× weight boost)</span>
        </label>
        <input
          value={easReceiptId}
          onChange={e => setEasId(e.target.value)}
          placeholder="0x attestation hash..."
          className="w-full bg-[#13141f] border border-[#1e2035] focus:border-[#3b82f6]/40 rounded-xl px-4 py-2 text-sm text-[#f1f5f9] placeholder-[#2a2d45] focus:outline-none transition-all font-mono"
        />
      </div>

      {result?.error && <p className="text-xs text-slate-400 font-mono">{result.error}</p>}
      {result?.msg && (
        <p className="text-xs text-blue-400 font-mono">✓ {result.msg} {result.earned ? `+${result.earned} 🪲` : ''}</p>
      )}

      <button
        type="submit"
        disabled={submitting || !canAfford}
        className="w-full py-2.5 bg-[#3b82f6] hover:bg-[#DC2626] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition-colors"
      >
        {submitting ? 'Submitting...' : 'Submit Review (−2 🪲)'}
      </button>
    </form>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function AgentDetailClient() {
  return (
    <>
      <Header />
      <Suspense
        fallback={
          <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center pt-16">
            <div className="w-7 h-7 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        <AgentDetail />
      </Suspense>
    </>
  )
}

// ─── Core Detail Page ─────────────────────────────────────────────────────────

function AgentDetail() {
  const params    = useParams()
  const slug      = params.address as string
  const { user }  = usePrivy()
  const walletAddress = user?.wallet?.address

  const [agent,     setAgent]     = useState<AgentScore | null>(null)
  const [reviews,   setReviews]   = useState<Review[]>([])
  const [scarabBal, setScarabBal] = useState<number | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [copied,    setCopied]    = useState(false)
  const [reviewKey, setReviewKey] = useState(0)

  // ── Detect wallet address ───────────────────────────────────────────────
  const isWalletAddr = /^0x[0-9a-fA-F]{40}$/.test(slug)

  // ── Load agent score ────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      if (!slug) return
      setLoading(true)
      setError(null)
      try {
        if (isWalletAddr) {
          // Fetch from ACP behavioral data
          const res = await fetch(`/api/v1/agent/${slug}`)
          if (!res.ok) {
            setError('Agent not found')
            return
          }
          const data: AgentScore = await res.json()
          setAgent(data)
        } else {
          setError('Invalid address — must be a 0x wallet address')
        }
      } catch {
        setError('Failed to load agent data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [slug, isWalletAddr])

  // ── Load reviews ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!slug) return
    fetch(`/api/v1/review?address=${slug}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setReviews(d.reviews || []))
  }, [slug, reviewKey])

  // ── Load scarab balance (wallet-optional) ───────────────────────────────
  useEffect(() => {
    if (!walletAddress) return
    fetch(`/api/v1/scarab?address=${walletAddress}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setScarabBal(d.balance))
  }, [walletAddress, reviewKey])

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center pt-16">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
        <span className="text-[#475569] font-mono text-xs uppercase tracking-widest">Loading agent data…</span>
      </div>
    </div>
  )

  // ── Error state ──────────────────────────────────────────────────────────
  if (error || !agent) return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center pt-16">
      <div className="text-center">
        <Shield className="w-12 h-12 text-[#1e2035] mx-auto mb-4" />
        <p className="text-[#f1f5f9] font-semibold mb-2">{error || 'Agent not found'}</p>
        <Link href="/explore" className="text-[#3b82f6] text-sm hover:underline">← Back to Explore</Link>
      </div>
    </div>
  )

  const bd      = agent.breakdown
  const score   = agent.trustScore
  const verdict = agent.verdict
  const name    = agent.name || bd?.name || trunc(agent.address)
  const col     = verdictColor(verdict)
  const avgRating = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length / 2
    : 0

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#f1f5f9] pt-16">
      <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-5">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[#475569]">
          <Link href="/explore" className="flex items-center gap-1 hover:text-[#3b82f6] transition-colors">
            <ArrowLeft className="w-3 h-3" /> Explore
          </Link>
          <span>/</span>
          <span className="text-[#94a3b8] font-mono">{trunc(agent.address)}</span>
        </div>

        {/* ── Hero ── */}
        <div className="bg-[#0d0e17] border border-[#1e2035] rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            {/* Avatar */}
            {agent.profilePic ? (
              <img
                src={agent.profilePic}
                alt={name}
                className="w-14 h-14 rounded-xl object-cover shrink-0 border"
                style={{ borderColor: col + '44' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            ) : (
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-black text-white shrink-0"
                style={{ backgroundColor: col + '22', color: col, border: `1.5px solid ${col}44` }}
              >
                {name.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h1 className="text-xl font-bold">{name}</h1>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${verdictBg(verdict)}`}>
                  {verdictLabel(verdict)}
                </span>
                {agent.category && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-[#1e2035] text-[#64748b] bg-[#13141f]">
                    {agent.category}
                  </span>
                )}
              </div>

              {/* Description */}
              {agent.description && (
                <p className="text-sm text-[#94a3b8] mb-2 line-clamp-2">{agent.description}</p>
              )}

              {/* Wallet address row */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-[#475569] font-mono">{trunc(agent.address)}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(agent.address)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1500)
                  }}
                  className="text-[#475569] hover:text-[#3b82f6] transition-colors"
                  title="Copy address"
                >
                  <Copy className="w-3 h-3" />
                </button>
                {copied && <span className="text-[10px] text-blue-400 font-mono">Copied!</span>}
                <a
                  href={`https://basescan.org/address/${agent.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#475569] hover:text-[#3b82f6] transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="text-xs text-[#475569] font-mono">
                Source: <span className="text-[#94a3b8]">{agent.dataSource}</span>
                {agent.lastUpdated && (
                  <> · Updated {new Date(agent.lastUpdated).toLocaleDateString()}</>
                )}
              </div>
            </div>

            {/* Trust Score Badge */}
            <div className="shrink-0 flex flex-col items-center justify-center bg-[#13141f] border border-[#1e2035] rounded-xl px-5 py-4 min-w-[96px]">
              <span
                className="text-4xl font-black leading-none"
                style={{ color: scoreColor(score) }}
              >
                {score}
              </span>
              <span className="text-[9px] text-[#475569] font-mono uppercase tracking-widest mt-1">Trust Score</span>
              <span className="text-[9px] text-[#475569] font-mono mt-1">/ 100</span>
            </div>
          </div>
        </div>

        {/* ── ACP Breakdown ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Total Jobs"
            value={bd?.totalJobs?.toString() ?? '—'}
            sub="ACP missions"
          />
          <StatCard
            label="Age"
            value={bd?.ageWeeks !== undefined ? `${bd.ageWeeks}w` : '—'}
            sub="weeks active"
          />
          <StatCard
            label="Completion"
            value={pct(bd?.completionRate)}
            sub="jobs completed"
          />
          <StatCard
            label="Payment"
            value={pct(bd?.paymentRate)}
            sub="payments received"
          />
          {bd?.uniqueBuyerCount != null && (
            <StatCard
              label="Unique Buyers"
              value={bd.uniqueBuyerCount.toString()}
              sub="distinct clients"
            />
          )}
        </div>

        {/* ── Rate Bars ── */}
        <div className="bg-[#0d0e17] border border-[#1e2035] rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-[#3b82f6]" />
            <span className="text-xs font-medium font-mono uppercase tracking-widest text-[#475569]">Behavioral Breakdown</span>
          </div>
          <RateBar label="Completion Rate" value={bd?.completionRate} good={true} />
          <RateBar label="Payment Rate"    value={bd?.paymentRate}    good={true} />
          <RateBar label="Expire Rate"     value={bd?.expireRate}     good={false} />
        </div>

        {/* ── Verdict Banner ── */}
        <div
          className={`rounded-2xl p-5 flex items-center gap-4 border ${verdictBg(verdict)}`}
        >
          <div className="text-3xl">
            {verdict === 'proceed' ? '✅' : verdict === 'caution' ? '⚠️' : verdict === 'avoid' ? '🚫' : '❓'}
          </div>
          <div>
            <div className="font-bold text-sm uppercase tracking-wide">{verdict.toUpperCase()}</div>
            <div className="text-xs opacity-80 mt-0.5">
              {verdict === 'proceed' && 'This agent has a strong track record. Safe to engage.'}
              {verdict === 'caution' && 'Mixed signals — review on-chain history before engaging.'}
              {verdict === 'avoid'   && 'High failure/expire rate. Engage with caution or avoid.'}
              {verdict === 'unknown' && 'Not enough data to determine reliability.'}
            </div>
          </div>
          <div className="ml-auto shrink-0 text-right">
            <div className="text-2xl font-black" style={{ color: scoreColor(score) }}>{score}</div>
            <div className="text-[9px] opacity-60 font-mono uppercase">trust score</div>
          </div>
        </div>

        {/* ── Analysis ── */}
        {agent.analysis && (
          <div className="bg-[#0d0e17] border border-[#1e2035] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-3.5 h-3.5 text-[#3b82f6]" />
              <span className="text-xs font-medium font-mono uppercase tracking-widest text-[#475569]">Trust Analysis</span>
            </div>
            <p className="text-sm text-[#94a3b8] leading-relaxed">{agent.analysis}</p>
          </div>
        )}

        {/* ── Scarab Banner ── */}
        <div className="bg-[#d4a017]/6 border border-[#d4a017]/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="text-xl">🪲</span>
            <div>
              <div className="font-semibold text-[#d4a017] text-sm">Earn Scarab by Reviewing</div>
              <div className="text-xs text-[#64748b] mt-0.5">
                Costs <strong className="text-[#f1f5f9]">2 🪲</strong> · Quality reviews earn up to{' '}
                <strong className="text-[#f1f5f9]">+10 🪲</strong> · EAS gets{' '}
                <strong className="text-[#f1f5f9]">5× weight</strong>
              </div>
            </div>
          </div>
          {scarabBal !== null && (
            <div className="text-center shrink-0">
              <div className="text-lg font-black text-[#d4a017]">🪲 {scarabBal}</div>
              <div className="text-[9px] text-[#475569] font-mono">your balance</div>
            </div>
          )}
        </div>

        {/* ── Community Reviews ── */}
        <div className="bg-[#0d0e17] border border-[#1e2035] rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-[#3b82f6]" />
              <span className="text-xs font-medium font-mono uppercase tracking-widest text-[#475569]">Reviews</span>
              {reviews.length > 0 && (
                <span className="text-[10px] bg-[#13141f] border border-[#1e2035] text-[#475569] px-2 py-0.5 rounded-full font-mono">
                  {reviews.length}
                </span>
              )}
            </div>
            {reviews.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-[#475569]">
                <StarRow rating={avgRating} />
                <span className="font-mono ml-1">{avgRating.toFixed(1)}</span>
              </div>
            )}
          </div>

          {reviews.length === 0 ? (
            <div className="text-center py-10">
              <MessageSquare className="w-7 h-7 text-[#1e2035] mx-auto mb-2" />
              <p className="text-sm text-[#2a2d45] font-mono">No reviews yet. Be the first.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {reviews.map(r => (
                <div key={r.id} className="bg-[#13141f] border border-[#1e2035] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-[#475569]">{trunc(r.reviewer)}</span>
                      {r.weight > 1.5 && (
                        <span className="text-[9px] bg-[#d4a017]/8 text-[#d4a017] border border-[#d4a017]/20 px-1.5 py-0.5 rounded font-mono uppercase">
                          EAS ×{r.weight}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <StarRow rating={r.rating / 2} />
                      <span className="text-[9px] text-[#475569] font-mono">
                        {new Date(r.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {r.comment && <p className="text-sm text-[#64748b] leading-relaxed">{r.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Write a Review ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-3.5 h-3.5 text-[#d4a017]" />
            <span className="text-xs font-medium font-mono uppercase tracking-widest text-[#475569]">Write a Review</span>
          </div>
          <ReviewFormInline
            agentAddress={agent.address}
            agentName={name}
            scarabBalance={scarabBal}
            onSuccess={() => setReviewKey(k => k + 1)}
          />
        </div>

        {/* ── ACP API Snippet ── */}
        <div className="bg-[#0d0e17] border border-[#1e2035] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-3.5 h-3.5 text-[#3b82f6]" />
            <span className="text-xs font-medium font-mono uppercase tracking-widest text-[#475569]">ACP Agent Query</span>
          </div>
          <pre className="text-xs font-mono text-[#64748b] leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
{`GET /api/v1/agent/${agent.address}

→ { "trustScore": ${score}, "verdict": "${verdict}", "dataSource": "${agent.dataSource}" }`}
          </pre>
        </div>

        {/* ── Footer spacer ── */}
        <div className="flex items-center gap-2">
          <Shield className="w-3 h-3 text-[#1e2035]" />
          <span className="text-[10px] text-[#2a2d45] font-mono">
            Powered by Maiat Protocol · ACP Behavioral Intelligence
          </span>
          <Flame className="w-3 h-3 text-[#1e2035]" />
        </div>
      </div>
    </div>
  )
}
