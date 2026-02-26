'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import {
  Copy, ArrowLeft, ExternalLink, Shield, Activity, Star,
  CheckCircle, AlertTriangle, Bug, Zap, MessageSquare, Trophy, Flame
} from 'lucide-react'
import Link from 'next/link'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ScoreBreakdown {
  onchainHistory: number   // max 4.0
  contractAnalysis: number // max 3.0
  blacklist: number        // max 2.0
  activity: number         // max 1.0
}

interface Project {
  id: string
  name: string
  symbol?: string
  address: string
  chain: string
  description?: string
  website?: string
  category: string
  trustScore: number       // 0-100 (DB units)
  avgRating: number
  reviewCount: number
}

interface ScoreResult {
  score: number            // 0-10
  risk: string
  flags: string[]
  type: string
  details: {
    txCount: number
    balanceETH: string
    walletAge: string
    ageLabel: string
  }
  breakdown?: ScoreBreakdown
  summary?: string
}

interface Review {
  id: string
  reviewer: string
  rating: number
  comment: string
  weight: number
  timestamp: string
}

interface ScarabBalance {
  balance: number
  totalEarned: number
  streak: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function truncate(addr: string) {
  if (!addr || addr.length < 12) return addr
  return addr.slice(0, 6) + '...' + addr.slice(-4)
}

function chainColor(chain: string) {
  const c = chain?.toLowerCase()
  if (c === 'base') return '#0052FF'
  if (c === 'ethereum' || c === 'eth') return '#627EEA'
  if (c === 'bnb') return '#F3BA2F'
  return '#818384'
}

function riskColor(risk: string) {
  if (risk === 'LOW') return 'text-emerald-400'
  if (risk === 'MEDIUM') return 'text-yellow-400'
  if (risk === 'HIGH') return 'text-orange-400'
  return 'text-red-500'
}

function riskBg(risk: string) {
  if (risk === 'LOW') return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
  if (risk === 'MEDIUM') return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
  if (risk === 'HIGH') return 'bg-orange-500/10 border-orange-500/30 text-orange-400'
  return 'bg-red-500/10 border-red-500/30 text-red-400'
}

function scoreColor(s: number) {
  if (s >= 7) return '#10b981'
  if (s >= 4) return '#f59e0b'
  return '#ef4444'
}

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'text-xl' : 'text-sm'
  return (
    <span className={cls}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={i <= Math.round(rating) ? 'text-[#d4a017]' : 'text-[#343536]'}>★</span>
      ))}
    </span>
  )
}

// ─── Score Bar Component ──────────────────────────────────────────────────────

function ScoreBar({ label, value, max, icon }: { label: string; value: number; max: number; icon: React.ReactNode }) {
  const pct = Math.min(100, (value / max) * 100)
  const color = pct >= 66 ? '#10b981' : pct >= 33 ? '#f59e0b' : '#ef4444'
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-[#adadb0]">
          {icon}
          <span className="font-mono uppercase tracking-wider">{label}</span>
        </div>
        <span className="font-bold font-mono" style={{ color }}>{(value ?? 0).toFixed(1)} / {max}</span>
      </div>
      <div className="h-1.5 bg-[#1a1a1b] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

// ─── Scarab Badge ─────────────────────────────────────────────────────────────

function ScarabBadge({ count, dim = false }: { count: number; dim?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 font-bold font-mono ${dim ? 'text-[#818384]' : 'text-[#d4a017]'}`}>
      <span>🪲</span>{count}
    </span>
  )
}

// ─── Review Form ─────────────────────────────────────────────────────────────

function ReviewFormInline({
  projectAddress, projectName, scarabBalance, onSuccess
}: {
  projectAddress: string
  projectName: string
  scarabBalance: number | null
  onSuccess: () => void
}) {
  const { authenticated, user, login } = usePrivy()
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [easReceiptId, setEasReceiptId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ earned?: number; msg?: string; error?: string } | null>(null)

  const walletAddress = user?.wallet?.address
  const canAfford = scarabBalance === null || scarabBalance >= 2

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!walletAddress || !canAfford) return
    setSubmitting(true)
    setResult(null)
    try {
      const res = await fetch('/api/v1/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: projectAddress,
          reviewer: walletAddress,
          rating,
          comment: comment.trim() || undefined,
          easReceiptId: easReceiptId.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setResult({ error: data.error || 'Failed' }); return }
      setResult({ earned: data.scarabEarned, msg: 'Review submitted!' })
      setComment('')
      setRating(5)
      setEasReceiptId('')
      onSuccess()
    } catch {
      setResult({ error: 'Network error' })
    } finally { setSubmitting(false) }
  }

  if (!authenticated) {
    return (
      <div className="bg-[#1a1a1b] border border-[#343536] rounded-xl p-6 text-center">
        <div className="text-2xl mb-2">🪲</div>
        <p className="text-[#adadb0] text-sm mb-1">Sign in to review and earn Scarab</p>
        <p className="text-[#818384] text-xs mb-4 font-mono">Reviews cost 2 🪲 · Quality reviews earn up to +10 🪲</p>
        <button onClick={login} className="px-6 py-2 bg-[#d4a017] hover:bg-[#c49010] text-black font-bold text-sm rounded-lg transition-colors">
          Connect Wallet
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[#1a1a1b] border border-[#343536] rounded-xl p-6 flex flex-col gap-4">
      {/* Scarab cost/earn info */}
      <div className="flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-3">
          <span className="text-[#818384]">Costs</span>
          <ScarabBadge count={2} />
          <span className="text-[#818384]">·</span>
          <span className="text-[#818384]">Earn up to</span>
          <ScarabBadge count={10} />
          <span className="text-[#818384]">for quality</span>
        </div>
        {scarabBalance !== null && (
          <div className="text-[#818384]">
            Balance: <ScarabBadge count={scarabBalance} dim={!canAfford} />
          </div>
        )}
      </div>

      {!canAfford && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-xs text-red-400 font-mono">
          Insufficient Scarab balance. Claim daily 🪲 to continue.
        </div>
      )}

      {/* Rating */}
      <div>
        <label className="text-xs text-[#818384] font-mono uppercase tracking-wider block mb-2">Rating</label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(s => (
            <button type="button" key={s} onClick={() => setRating(s)}
              className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-all ${s <= rating ? 'text-[#d4a017] scale-105' : 'text-[#343536] hover:text-[#818384]'}`}>
              ★
            </button>
          ))}
        </div>
      </div>

      {/* Comment */}
      <div>
        <label className="text-xs text-[#818384] font-mono uppercase tracking-wider block mb-2">Opinion</label>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder={`Share your experience with ${projectName}...`}
          rows={3}
          className="w-full bg-[#111113] border border-[#343536] rounded-lg px-4 py-3 text-sm text-[#d7dadc] placeholder-[#818384] focus:outline-none focus:border-[#d4a017]/50 resize-none font-sans"
        />
      </div>

      {/* EAS Receipt (optional) */}
      <div>
        <label className="text-xs text-[#818384] font-mono uppercase tracking-wider block mb-2">
          EAS Receipt ID <span className="text-[#4a4a4e] normal-case">(optional — 5× weight boost)</span>
        </label>
        <input
          value={easReceiptId}
          onChange={e => setEasReceiptId(e.target.value)}
          placeholder="0x attestation hash..."
          className="w-full bg-[#111113] border border-[#343536] rounded-lg px-4 py-2 text-sm text-[#d7dadc] placeholder-[#818384] focus:outline-none focus:border-[#d4a017]/50 font-mono"
        />
      </div>

      {result?.error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-xs text-red-400 font-mono">{result.error}</div>
      )}
      {result?.msg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 text-xs text-emerald-400 font-mono">
          ✅ {result.msg} {result.earned ? `+${result.earned} 🪲 earned!` : ''}
        </div>
      )}

      <button type="submit" disabled={submitting || !canAfford}
        className="w-full py-2.5 bg-[#d4a017] hover:bg-[#c49010] disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold text-sm rounded-lg transition-colors font-mono uppercase tracking-wide">
        {submitting ? 'Submitting...' : `Submit Review (−2 🪲)`}
      </button>
    </form>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AgentDetailPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#030303] flex items-center justify-center text-[#d4a017] font-mono">Loading...</div>}>
      <AgentDetailPage />
    </Suspense>
  )
}

function AgentDetailPage() {
  const params = useParams()
  const slug = params.address as string
  const { user } = usePrivy()
  const walletAddress = user?.wallet?.address

  const [project, setProject] = useState<Project | null>(null)
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [scarab, setScarab] = useState<ScarabBalance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [reviewKey, setReviewKey] = useState(0)

  // Load project + score
  useEffect(() => {
    async function load() {
      if (!slug) return
      setLoading(true)
      try {
        // 1. DB lookup by slug or address
        const projRes = await fetch('/api/v1/project/' + slug)
        if (!projRes.ok) { setError('Project not found'); setLoading(false); return }
        const { project: dbP } = await projRes.json()
        setProject(dbP)

        // 2. On-chain score if EVM
        const isEVM = /^0x[0-9a-fA-F]{40}$/.test(dbP.address)
        if (isEVM) {
          const chain = dbP.chain?.toLowerCase() === 'bnb' ? 'bnb'
            : dbP.chain?.toLowerCase() === 'ethereum' ? 'eth' : 'base'
          const sRes = await fetch(`/api/v1/score/${dbP.address}?summary=true&chain=${chain}`)
          if (sRes.ok) {
            const sd = await sRes.json()
            setScoreResult(sd)
          }
        }
      } catch { setError('Failed to load') }
      finally { setLoading(false) }
    }
    load()
  }, [slug])

  // Load reviews
  useEffect(() => {
    if (!project?.address) return
    const isEVM = /^0x[0-9a-fA-F]{40}$/.test(project.address)
    if (!isEVM) return
    fetch(`/api/v1/review?address=${project.address}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setReviews(d.reviews || []))
  }, [project?.address, reviewKey])

  // Load scarab balance
  useEffect(() => {
    if (!walletAddress) return
    fetch(`/api/v1/scarab?address=${walletAddress}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setScarab(d))
  }, [walletAddress, reviewKey])

  function copy() {
    if (!project?.address) return
    navigator.clipboard.writeText(project.address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (loading) return (
    <div className="min-h-screen bg-[#030303] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-[#d4a017] border-t-transparent rounded-full animate-spin" />
        <span className="text-[#818384] font-mono text-sm uppercase tracking-widest">Loading Project...</span>
      </div>
    </div>
  )

  if (error || !project) return (
    <div className="min-h-screen bg-[#030303] flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">🪲</div>
        <p className="text-[#d7dadc] font-bold mb-2">{error || 'Project not found'}</p>
        <Link href="/explore" className="text-[#d4a017] text-sm font-mono hover:underline">← Back to Explorer</Link>
      </div>
    </div>
  )

  const score = scoreResult?.score ?? (project.trustScore ? project.trustScore / 10 : 0)
  const risk = scoreResult?.risk ?? (score >= 7 ? 'LOW' : score >= 4 ? 'MEDIUM' : 'HIGH')
  const breakdown = scoreResult?.breakdown

  // Estimate breakdown from total score if not available
  const estimatedBreakdown: ScoreBreakdown = {
    onchainHistory: breakdown?.onchainHistory ?? (score >= 7 ? 3.6 : score >= 4 ? 2.4 : 1.2),
    contractAnalysis: breakdown?.contractAnalysis ?? (score >= 7 ? 2.8 : score >= 4 ? 1.8 : 0.9),
    blacklist: breakdown?.blacklist ?? (score >= 7 ? 1.9 : score >= 4 ? 1.4 : 0.8),
    activity: breakdown?.activity ?? (score >= 7 ? 0.9 : score >= 4 ? 0.6 : 0.3),
  }

  const isEVM = /^0x[0-9a-fA-F]{40}$/.test(project.address)

  return (
    <div className="min-h-screen bg-[#030303] text-[#d7dadc]">
      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-5">

        {/* Breadcrumb */}
        <Link href="/explore" className="flex items-center gap-2 text-[#818384] hover:text-[#d4a017] text-xs font-mono uppercase tracking-widest transition-colors w-fit">
          <ArrowLeft className="w-3 h-3" />
          Explorer
        </Link>

        {/* ── Hero Card ── */}
        <div className="bg-[#1a1a1b] border border-[#343536] rounded-xl p-6">
          <div className="flex flex-col sm:flex-row items-start gap-6">

            {/* Avatar */}
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white shrink-0"
              style={{ backgroundColor: chainColor(project.chain) }}>
              {project.name.charAt(0)}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-2xl font-black">{project.name}</h1>
                {project.symbol && (
                  <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-[#272729] text-[#d4a017]">{project.symbol}</span>
                )}
                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded uppercase border"
                  style={{ color: chainColor(project.chain), borderColor: chainColor(project.chain) + '40', backgroundColor: chainColor(project.chain) + '10' }}>
                  {project.chain}
                </span>
                <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded uppercase border ${riskBg(risk)}`}>
                  {risk} RISK
                </span>
              </div>

              {/* Address */}
              {isEVM && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-[#818384] font-mono">{truncate(project.address)}</span>
                  <button onClick={copy} className="text-[#818384] hover:text-[#d4a017] transition-colors">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {copied && <span className="text-xs text-emerald-400 font-mono">Copied!</span>}
                  <a href={`https://basescan.org/address/${project.address}`} target="_blank" rel="noopener noreferrer"
                    className="text-[#818384] hover:text-[#d4a017] transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {project.description && (
                <p className="text-sm text-[#adadb0] leading-relaxed line-clamp-2">{project.description}</p>
              )}
            </div>

            {/* Score */}
            <div className="shrink-0 flex flex-col items-center justify-center bg-[#111113] border border-[#2a2a2e] rounded-xl px-6 py-4 min-w-[100px]">
              <span className="text-4xl font-black" style={{ color: scoreColor(score) }}>{score.toFixed(1)}</span>
              <span className="text-[10px] text-[#818384] font-mono uppercase tracking-widest mt-1">Trust Score</span>
              <div className="flex items-center gap-1 mt-2">
                <StarRating rating={project.avgRating} />
              </div>
              <span className="text-[10px] text-[#818384] mt-0.5">{reviews.length} reviews</span>
            </div>
          </div>
        </div>

        {/* ── Score Breakdown + Stats row ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Score breakdown */}
          <div className="bg-[#1a1a1b] border border-[#343536] rounded-xl p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-[#d4a017]" />
              <span className="text-xs font-bold font-mono uppercase tracking-widest text-[#adadb0]">Score Breakdown</span>
            </div>
            <ScoreBar label="On-Chain History" value={estimatedBreakdown.onchainHistory} max={4.0}
              icon={<Activity className="w-3 h-3" />} />
            <ScoreBar label="Contract Analysis" value={estimatedBreakdown.contractAnalysis} max={3.0}
              icon={<Bug className="w-3 h-3" />} />
            <ScoreBar label="Blacklist Check" value={estimatedBreakdown.blacklist} max={2.0}
              icon={<CheckCircle className="w-3 h-3" />} />
            <ScoreBar label="Activity" value={estimatedBreakdown.activity} max={1.0}
              icon={<Zap className="w-3 h-3" />} />
          </div>

          {/* On-chain stats */}
          <div className="bg-[#1a1a1b] border border-[#343536] rounded-xl p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-[#d4a017]" />
              <span className="text-xs font-bold font-mono uppercase tracking-widest text-[#adadb0]">On-Chain Details</span>
            </div>
            {scoreResult?.details ? (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Transactions', val: scoreResult.details.txCount?.toLocaleString() ?? '—' },
                  { label: 'Balance', val: scoreResult.details.balanceETH ? `${scoreResult.details.balanceETH} ETH` : '—' },
                  { label: 'Wallet Age', val: scoreResult.details.ageLabel ?? '—' },
                  { label: 'Type', val: scoreResult.type ?? '—' },
                ].map(({ label, val }) => (
                  <div key={label} className="bg-[#111113] rounded-lg p-3">
                    <div className="text-[10px] text-[#818384] font-mono uppercase tracking-wider mb-1">{label}</div>
                    <div className="text-sm font-bold text-[#d7dadc]">{val}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-[#4a4a4e] text-sm font-mono">
                {isEVM ? 'Score data loading...' : 'Scoring not available for this chain'}
              </div>
            )}

            {/* Flags */}
            {scoreResult?.flags && scoreResult.flags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {scoreResult.flags.map(f => (
                  <span key={f} className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#272729] text-[#818384] uppercase">{f}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Scarab Banner ── */}
        <div className="bg-[#d4a017]/8 border border-[#d4a017]/25 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🪲</span>
            <div>
              <div className="font-bold text-[#d4a017] text-sm">Earn Scarab by Reviewing</div>
              <div className="text-xs text-[#818384] mt-0.5">
                Costs <strong className="text-[#d7dadc]">2 🪲</strong> to submit · Quality reviews earn up to <strong className="text-[#d7dadc]">+10 🪲</strong> back · EAS receipts get <strong className="text-[#d7dadc]">5× weight</strong>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {scarab ? (
              <div className="text-center">
                <div className="text-lg font-black text-[#d4a017]">🪲 {scarab.balance}</div>
                <div className="text-[10px] text-[#818384] font-mono">your balance</div>
              </div>
            ) : walletAddress ? (
              <div className="text-[#818384] text-xs font-mono animate-pulse">Loading...</div>
            ) : (
              <div className="text-xs text-[#818384] font-mono">Connect wallet to see balance</div>
            )}
          </div>
        </div>

        {/* ── AI Summary ── */}
        {(scoreResult?.summary || project.description) && (
          <div className="bg-[#1a1a1b] border border-[#343536] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-4 h-4 text-[#d4a017]" />
              <span className="text-xs font-bold font-mono uppercase tracking-widest text-[#adadb0]">Analysis</span>
            </div>
            <p className="text-sm text-[#adadb0] leading-relaxed">{scoreResult?.summary || project.description}</p>
          </div>
        )}

        {/* ── Community Reviews ── */}
        <div className="bg-[#1a1a1b] border border-[#343536] rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#d4a017]" />
              <span className="text-xs font-bold font-mono uppercase tracking-widest text-[#adadb0]">
                Community Reviews
              </span>
              {reviews.length > 0 && (
                <span className="text-xs bg-[#272729] text-[#818384] px-2 py-0.5 rounded-full font-mono">{reviews.length}</span>
              )}
            </div>
            {reviews.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-[#818384]">
                <StarRating rating={project.avgRating || 0} />
                <span className="font-mono ml-1">{(project.avgRating || 0).toFixed(1)}</span>
              </div>
            )}
          </div>

          {/* Review list */}
          {reviews.length === 0 ? (
            <div className="text-center py-8 text-[#4a4a4e]">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-mono">No reviews yet. Be the first!</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {reviews.map(r => (
                <div key={r.id} className="bg-[#111113] border border-[#2a2a2e] rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-[#818384]">{truncate(r.reviewer)}</span>
                      {r.weight > 1.5 && (
                        <span className="text-[10px] bg-[#d4a017]/10 text-[#d4a017] border border-[#d4a017]/20 px-1.5 py-0.5 rounded font-mono uppercase">
                          EAS ×{r.weight}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <StarRating rating={r.rating / 2} size="sm" />
                      <span className="text-[10px] text-[#818384] font-mono">
                        {new Date(r.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {r.comment && <p className="text-sm text-[#adadb0] leading-relaxed">{r.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Leave a Review ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-[#d4a017]" />
            <span className="text-xs font-bold font-mono uppercase tracking-widest text-[#adadb0]">Leave a Review</span>
          </div>
          <ReviewFormInline
            projectAddress={project.address}
            projectName={project.name}
            scarabBalance={scarab?.balance ?? null}
            onSuccess={() => setReviewKey(k => k + 1)}
          />
        </div>

      </div>
    </div>
  )
}
