'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import { useInteractionCheck } from '@/hooks/useInteractionCheck'
import {
  Copy, ExternalLink, Shield, Activity,
  CheckCircle, Bug, Zap, MessageSquare, Trophy, Flame, ArrowLeft,
} from 'lucide-react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScoreBreakdown {
  onchainHistory: number
  contractAnalysis: number
  blacklist: number
  activity: number
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
  trustScore: number
  avgRating: number
  reviewCount: number
  slug?: string
}

interface ScoreResult {
  score: number
  risk: string
  flags: string[]
  type: string
  details: { txCount: number; balanceETH: string; walletAge: string; ageLabel: string }
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function trunc(addr: string) {
  if (!addr || addr.length < 12) return addr
  return addr.slice(0, 6) + '...' + addr.slice(-4)
}

function explorerUrl(address: string, chain: string) {
  const c = chain?.toLowerCase()
  if (c === 'ethereum' || c === 'eth') return `https://etherscan.io/address/${address}`
  return `https://basescan.org/address/${address}`
}

function chainColor(chain: string) {
  const c = chain?.toLowerCase()
  if (c === 'base') return '#0052FF'
  if (c === 'ethereum' || c === 'eth') return '#627EEA'
  return '#475569'
}

function chainLabel(chain: string) {
  const c = chain?.toLowerCase()
  if (c === 'base') return 'Base'
  if (c === 'ethereum' || c === 'eth') return 'Ethereum'
  return chain
}

function scoreColor(s: number) {
  if (s >= 7) return '#10b981'
  if (s >= 4) return '#f59e0b'
  return '#ef4444'
}

function riskStyle(risk: string) {
  if (risk === 'LOW')      return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
  if (risk === 'MEDIUM')   return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
  if (risk === 'HIGH')     return 'bg-orange-500/10 border-orange-500/30 text-orange-400'
  return 'bg-red-500/10 border-red-500/30 text-red-400'
}

function apiChain(chain: string) {
  const c = chain?.toLowerCase()
  if (c === 'ethereum' || c === 'eth') return 'eth'
  return 'base'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreBar({ label, value, max, icon }: { label: string; value: number; max: number; icon: React.ReactNode }) {
  const pct = Math.min(100, ((value ?? 0) / max) * 100)
  const color = pct >= 66 ? '#10b981' : pct >= 33 ? '#f59e0b' : '#ef4444'
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-[#94a3b8]">
          {icon}
          <span className="font-mono uppercase tracking-wider">{label}</span>
        </div>
        <span className="font-bold font-mono" style={{ color }}>{(value ?? 0).toFixed(1)} / {max}</span>
      </div>
      <div className="h-1.5 bg-[#1e2035] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function StarRow({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <span key={i} className={i <= Math.round(rating) ? 'text-[#d4a017]' : 'text-[#2a2d45]'}>★</span>
      ))}
    </span>
  )
}

function ReviewFormInline({
  projectAddress, projectName, scarabBalance, onSuccess,
}: {
  projectAddress: string
  projectName: string
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

  // ── Interaction gate ──────────────────────────────────────────────────────
  const { status: interactionStatus, proof: interactionProof, check: checkInteraction } =
    useInteractionCheck(walletAddress, projectAddress)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!walletAddress || !canAfford) return
    if (interactionStatus === 'blocked') return
    setSubmitting(true); setResult(null)
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
      setComment(''); setRating(5); setEasId('')
      onSuccess()
    } catch { setResult({ error: 'Network error' }) }
    finally { setSubmitting(false) }
  }

  if (!authenticated) return (
    <div className="bg-[#0d0e17] border border-[#1e2035] rounded-xl p-6 text-center">
      <div className="text-2xl mb-2">🪲</div>
      <p className="text-[#94a3b8] text-sm mb-1">Connect wallet to review and earn Scarab</p>
      <p className="text-[#475569] text-xs mb-4 font-mono">Reviews cost 2 🪲 · Quality reviews earn up to +10 🪲</p>
      <button onClick={login} className="px-6 py-2 bg-[#0052FF] hover:bg-[#0041cc] text-white font-semibold text-sm rounded-xl transition-colors">
        Connect Wallet
      </button>
    </div>
  )

  // ── Interaction gate states ───────────────────────────────────────────────
  if (interactionStatus === 'idle') return (
    <div className="bg-[#0d0e17] border border-[#1e2035] rounded-xl p-6">
      <p className="text-[#94a3b8] text-sm mb-1 font-semibold">Verify On-Chain Interaction</p>
      <p className="text-[#475569] text-xs mb-4 font-mono">Only wallets that have interacted with this project can leave a review.</p>
      <button onClick={checkInteraction} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl transition-colors">
        🔍 Verify Interaction
      </button>
    </div>
  )

  if (interactionStatus === 'loading') return (
    <div className="bg-[#0d0e17] border border-[#1e2035] rounded-xl p-6 text-center">
      <p className="text-[#94a3b8] text-sm font-mono animate-pulse">⏳ Checking on-chain history…</p>
    </div>
  )

  if (interactionStatus === 'blocked') return (
    <div className="bg-[#0d0e17] border border-[#1e2035] rounded-xl p-6">
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-3">
        <p className="text-red-400 text-sm font-semibold mb-1">❌ No Interaction Found</p>
        <p className="text-red-400/70 text-xs font-mono">
          Wallet {walletAddress?.slice(0,6)}…{walletAddress?.slice(-4)} has no recorded txs with {projectName}.
        </p>
      </div>
      <p className="text-[#475569] text-xs font-mono mb-3">Interact with this project on-chain first, then re-check.</p>
      <button onClick={checkInteraction} className="w-full py-2 border border-[#1e2035] hover:border-[#2a2d45] text-[#94a3b8] text-sm rounded-xl transition-colors">
        🔄 Re-check
      </button>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="bg-[#0d0e17] border border-[#1e2035] rounded-xl p-6 flex flex-col gap-4">
      {/* Interaction badge */}
      {interactionStatus === 'verified' && interactionProof && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 text-xs text-green-400 font-mono flex items-center gap-2">
          <span>✅</span>
          <span>
            Interaction verified
            {interactionProof.txCount > 0 && ` · ${interactionProof.txCount} tx${interactionProof.txCount > 1 ? 's' : ''}`}
            {interactionProof.firstTxDate && ` · since ${new Date(interactionProof.firstTxDate).toLocaleDateString()}`}
          </span>
        </div>
      )}
      {interactionStatus === 'error' && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 text-xs text-yellow-400 font-mono">
          ⚠️ Could not verify on-chain — backend will re-check on submit.
        </div>
      )}

      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-[#475569]">Costs <span className="text-[#d4a017]">2 🪲</span> · Earn up to <span className="text-[#d4a017]">+10 🪲</span></span>
        {scarabBalance !== null && (
          <span className="text-[#475569]">Balance: <span className={canAfford ? 'text-[#d4a017]' : 'text-red-400'}>🪲 {scarabBalance}</span></span>
        )}
      </div>

      {!canAfford && (
        <div className="bg-red-500/8 border border-red-500/20 rounded-lg px-3 py-2 text-xs text-red-400 font-mono">
          Insufficient Scarab. Claim daily 🪲 from sidebar.
        </div>
      )}

      {/* Star Rating */}
      <div>
        <label className="text-xs text-[#475569] font-mono uppercase tracking-wider block mb-2">Rating</label>
        <div className="flex gap-1">
          {[1,2,3,4,5].map(s => (
            <button type="button" key={s} onClick={() => setRating(s)}
              className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-all border ${s <= rating ? 'text-[#d4a017] bg-[#d4a017]/10 border-[#d4a017]/30' : 'text-[#1e2035] bg-[#13141f] border-[#1e2035] hover:border-[#2a2d45]'}`}>
              ★
            </button>
          ))}
        </div>
      </div>

      {/* Comment */}
      <div>
        <label className="text-xs text-[#475569] font-mono uppercase tracking-wider block mb-2">Analysis <span className="normal-case text-[#2a2d45]">(optional)</span></label>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder={`Share your experience with ${projectName}...`}
          rows={3}
          className="w-full bg-[#13141f] border border-[#1e2035] focus:border-[#0052FF]/40 rounded-xl px-4 py-3 text-sm text-[#f1f5f9] placeholder-[#2a2d45] focus:outline-none resize-none transition-all"
        />
      </div>

      {/* EAS Receipt */}
      <div>
        <label className="text-xs text-[#475569] font-mono uppercase tracking-wider block mb-2">
          EAS Receipt <span className="normal-case text-[#2a2d45]">(optional — 5× weight boost)</span>
        </label>
        <input
          value={easReceiptId}
          onChange={e => setEasId(e.target.value)}
          placeholder="0x attestation hash..."
          className="w-full bg-[#13141f] border border-[#1e2035] focus:border-[#0052FF]/40 rounded-xl px-4 py-2 text-sm text-[#f1f5f9] placeholder-[#2a2d45] focus:outline-none transition-all font-mono"
        />
      </div>

      {result?.error && <p className="text-xs text-red-400 font-mono">{result.error}</p>}
      {result?.msg && (
        <p className="text-xs text-emerald-400 font-mono">✓ {result.msg} {result.earned ? `+${result.earned} 🪲` : ''}</p>
      )}

      <button type="submit" disabled={submitting || !canAfford}
        className="w-full py-2.5 bg-[#0052FF] hover:bg-[#0041cc] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition-colors">
        {submitting ? 'Submitting...' : 'Submit Review (−2 🪲)'}
      </button>
    </form>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function AgentDetailClient() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050508] flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-[#0052FF] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <AgentDetail />
    </Suspense>
  )
}

// ─── Core Detail Page ─────────────────────────────────────────────────────────

function AgentDetail() {
  const params       = useParams()
  const slug         = params.address as string
  const { user }     = usePrivy()
  const walletAddress = user?.wallet?.address

  const [project,     setProject]     = useState<Project | null>(null)
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null)
  const [reviews,     setReviews]     = useState<Review[]>([])
  const [scarabBal,   setScarabBal]   = useState<number | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [copied,      setCopied]      = useState(false)
  const [reviewKey,   setReviewKey]   = useState(0)

  // Load project + score
  useEffect(() => {
    async function load() {
      if (!slug) return
      setLoading(true)
      try {
        const projRes = await fetch(`/api/v1/project/${slug}`)
        if (!projRes.ok) { setError('Project not found'); return }
        const { project: p } = await projRes.json()
        setProject(p)

        const isEVM = /^0x[0-9a-fA-F]{40}$/.test(p.address)
        if (isEVM) {
          const sRes = await fetch(`/api/v1/score/${p.address}?summary=true&chain=${apiChain(p.chain)}`)
          if (sRes.ok) setScoreResult(await sRes.json())
        }
      } catch { setError('Failed to load') }
      finally { setLoading(false) }
    }
    load()
  }, [slug])

  // Load reviews
  useEffect(() => {
    if (!project?.address) return
    fetch(`/api/v1/review?address=${project.address}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setReviews(d.reviews || []))
  }, [project?.address, reviewKey])

  // Load scarab balance
  useEffect(() => {
    if (!walletAddress) return
    fetch(`/api/v1/scarab?address=${walletAddress}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setScarabBal(d.balance))
  }, [walletAddress, reviewKey])

  if (loading) return (
    <div className="min-h-screen bg-[#050508] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-[#0052FF] border-t-transparent rounded-full animate-spin" />
        <span className="text-[#475569] font-mono text-xs uppercase tracking-widest">Loading...</span>
      </div>
    </div>
  )

  if (error || !project) return (
    <div className="min-h-screen bg-[#050508] flex items-center justify-center">
      <div className="text-center">
        <Shield className="w-12 h-12 text-[#1e2035] mx-auto mb-4" />
        <p className="text-[#f1f5f9] font-semibold mb-2">{error || 'Project not found'}</p>
        <Link href="/explore" className="text-[#0052FF] text-sm hover:underline">← Back to Explore</Link>
      </div>
    </div>
  )

  const score = scoreResult?.score ?? (project.trustScore ? project.trustScore / 10 : 0)
  const risk  = scoreResult?.risk  ?? (score >= 7 ? 'LOW' : score >= 4 ? 'MEDIUM' : 'HIGH')
  const bd    = scoreResult?.breakdown

  const est = {
    onchainHistory:  bd?.onchainHistory  ?? (score >= 7 ? 3.6 : score >= 4 ? 2.4 : 1.2),
    contractAnalysis:bd?.contractAnalysis ?? (score >= 7 ? 2.8 : score >= 4 ? 1.8 : 0.9),
    blacklist:       bd?.blacklist        ?? (score >= 7 ? 1.9 : score >= 4 ? 1.4 : 0.8),
    activity:        bd?.activity         ?? (score >= 7 ? 0.9 : score >= 4 ? 0.6 : 0.3),
  }

  const isEVM = /^0x[0-9a-fA-F]{40}$/.test(project.address)
  const col   = chainColor(project.chain)

  return (
    <div className="min-h-screen bg-[#050508] text-[#f1f5f9]">
      <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-5">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[#475569]">
          <Link href="/explore" className="flex items-center gap-1 hover:text-[#0052FF] transition-colors">
            <ArrowLeft className="w-3 h-3" /> Explore
          </Link>
          <span>/</span>
          <span className="text-[#94a3b8]">{project.name}</span>
        </div>

        {/* ── Hero ── */}
        <div className="bg-[#0d0e17] border border-[#1e2035] rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            {/* Avatar */}
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-black text-white shrink-0"
              style={{ backgroundColor: col + '22', color: col, border: `1.5px solid ${col}44` }}
            >
              {project.name.charAt(0)}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl font-bold">{project.name}</h1>
                {project.symbol && (
                  <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-[#13141f] border border-[#1e2035] text-[#d4a017]">{project.symbol}</span>
                )}
                <span
                  className="text-[10px] font-medium font-mono px-2 py-0.5 rounded-full border"
                  style={{ color: col, borderColor: col + '40', backgroundColor: col + '12' }}
                >
                  {chainLabel(project.chain)}
                </span>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${riskStyle(risk)}`}>
                  {risk} RISK
                </span>
              </div>

              {isEVM && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-[#475569] font-mono">{trunc(project.address)}</span>
                  <button onClick={() => { navigator.clipboard.writeText(project.address); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
                    className="text-[#475569] hover:text-[#0052FF] transition-colors">
                    <Copy className="w-3 h-3" />
                  </button>
                  {copied && <span className="text-[10px] text-emerald-400 font-mono">Copied</span>}
                  <a href={explorerUrl(project.address, project.chain)} target="_blank" rel="noopener noreferrer"
                    className="text-[#475569] hover:text-[#0052FF] transition-colors">
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {project.description && (
                <p className="text-sm text-[#64748b] leading-relaxed">{project.description}</p>
              )}
            </div>

            {/* Score */}
            <div className="shrink-0 flex flex-col items-center justify-center bg-[#13141f] border border-[#1e2035] rounded-xl px-5 py-4 min-w-[88px]">
              <span className="text-3xl font-black leading-none" style={{ color: scoreColor(score) }}>
                {score.toFixed(1)}
              </span>
              <span className="text-[9px] text-[#475569] font-mono uppercase tracking-widest mt-1">Trust Score</span>
              <StarRow rating={project.avgRating || 0} />
              <span className="text-[9px] text-[#475569] mt-0.5">{reviews.length} reviews</span>
            </div>
          </div>
        </div>

        {/* ── Score Breakdown + On-chain Stats ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#0d0e17] border border-[#1e2035] rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-[#0052FF]" />
              <span className="text-xs font-medium font-mono uppercase tracking-widest text-[#475569]">Score Breakdown</span>
            </div>
            <ScoreBar label="On-Chain History"   value={est.onchainHistory}   max={4.0} icon={<Activity className="w-3 h-3" />} />
            <ScoreBar label="Contract Analysis"  value={est.contractAnalysis} max={3.0} icon={<Bug className="w-3 h-3" />} />
            <ScoreBar label="Blacklist Check"     value={est.blacklist}        max={2.0} icon={<CheckCircle className="w-3 h-3" />} />
            <ScoreBar label="Activity"            value={est.activity}         max={1.0} icon={<Zap className="w-3 h-3" />} />
          </div>

          <div className="bg-[#0d0e17] border border-[#1e2035] rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-[#0052FF]" />
              <span className="text-xs font-medium font-mono uppercase tracking-widest text-[#475569]">On-Chain Details</span>
            </div>
            {scoreResult?.details ? (
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: 'Transactions', val: scoreResult.details.txCount?.toLocaleString() ?? '—' },
                  { label: 'Balance',      val: scoreResult.details.balanceETH ? `${scoreResult.details.balanceETH} ETH` : '—' },
                  { label: 'Wallet Age',   val: scoreResult.details.ageLabel ?? '—' },
                  { label: 'Type',         val: scoreResult.type ?? '—' },
                ].map(({ label, val }) => (
                  <div key={label} className="bg-[#13141f] rounded-xl p-3 border border-[#1e2035]">
                    <div className="text-[9px] text-[#475569] font-mono uppercase tracking-wider mb-1">{label}</div>
                    <div className="text-sm font-semibold">{val}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-[#2a2d45] font-mono">
                {isEVM ? 'Fetching on-chain data...' : 'Scoring not available'}
              </div>
            )}
            {scoreResult?.flags && scoreResult.flags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {scoreResult.flags.map(f => (
                  <span key={f} className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-[#13141f] border border-[#1e2035] text-[#475569] uppercase">{f}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Scarab Banner ── */}
        <div className="bg-[#d4a017]/6 border border-[#d4a017]/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="text-xl">🪲</span>
            <div>
              <div className="font-semibold text-[#d4a017] text-sm">Earn Scarab by Reviewing</div>
              <div className="text-xs text-[#64748b] mt-0.5">
                Costs <strong className="text-[#f1f5f9]">2 🪲</strong> · Quality reviews earn up to <strong className="text-[#f1f5f9]">+10 🪲</strong> · EAS gets <strong className="text-[#f1f5f9]">5× weight</strong>
              </div>
            </div>
          </div>
          {scarabBal !== null ? (
            <div className="text-center shrink-0">
              <div className="text-lg font-black text-[#d4a017]">🪲 {scarabBal}</div>
              <div className="text-[9px] text-[#475569] font-mono">your balance</div>
            </div>
          ) : null}
        </div>

        {/* ── AI Summary ── */}
        {(scoreResult?.summary || project.description) && (
          <div className="bg-[#0d0e17] border border-[#1e2035] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-3.5 h-3.5 text-[#d4a017]" />
              <span className="text-xs font-medium font-mono uppercase tracking-widest text-[#475569]">Analysis</span>
            </div>
            <p className="text-sm text-[#64748b] leading-relaxed">{scoreResult?.summary || project.description}</p>
          </div>
        )}

        {/* ── Community Reviews ── */}
        <div className="bg-[#0d0e17] border border-[#1e2035] rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-[#0052FF]" />
              <span className="text-xs font-medium font-mono uppercase tracking-widest text-[#475569]">Reviews</span>
              {reviews.length > 0 && (
                <span className="text-[10px] bg-[#13141f] border border-[#1e2035] text-[#475569] px-2 py-0.5 rounded-full font-mono">{reviews.length}</span>
              )}
            </div>
            {reviews.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-[#475569]">
                <StarRow rating={project.avgRating || 0} />
                <span className="font-mono ml-1">{(project.avgRating || 0).toFixed(1)}</span>
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
            projectAddress={project.address}
            projectName={project.name}
            scarabBalance={scarabBal}
            onSuccess={() => setReviewKey(k => k + 1)}
          />
        </div>

        {/* ── ACP API Snippet ── */}
        <div className="bg-[#0d0e17] border border-[#1e2035] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-3.5 h-3.5 text-[#0052FF]" />
            <span className="text-xs font-medium font-mono uppercase tracking-widest text-[#475569]">ACP Agent Query</span>
          </div>
          <pre className="text-xs font-mono text-[#64748b] leading-relaxed overflow-x-auto">
{`GET /api/v1/score/${project.address}?chain=${apiChain(project.chain)}

→ { "score": ${score.toFixed(1)}, "risk": "${risk}", "verdict": "${risk === 'LOW' ? 'SAFE' : risk === 'MEDIUM' ? 'CAUTION' : 'AVOID'}" }`}
          </pre>
        </div>

      </div>
    </div>
  )
}
