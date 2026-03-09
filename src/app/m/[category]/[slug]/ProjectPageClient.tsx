'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import { useInteractionCheck } from '@/hooks/useInteractionCheck'

function toCategorySlug(cat: string): string {
  const c = cat?.toLowerCase() ?? ''
  if (c.includes('agent') || c === 'm/ai-agents') return 'agents'
  if (c.includes('defi') || c === 'dex' || c === 'lending') return 'defi'
  if (c.includes('token') || c.includes('meme')) return 'tokens'
  return 'explore'
}
import {
  Copy, ArrowLeft, ExternalLink, Shield, Activity, Star,
  CheckCircle, AlertTriangle, Bug, Zap, MessageSquare, Trophy, Flame
} from 'lucide-react'
import Link from 'next/link'
import { ReviewForm } from '@/components/ReviewForm'

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
  if (c === 'base') return '#3b82f6'
  if (c === 'ethereum' || c === 'eth') return '#627EEA'
  if (c === 'bnb') return '#F3BA2F'
  return '#818384'
}

function riskColor(risk: string) {
  if (risk === 'LOW') return 'text-[#10b981]'
  if (risk === 'MEDIUM') return 'text-[#f59e0b]'
  if (risk === 'HIGH') return 'text-[#ef4444]'
  return 'text-slate-500'
}

function riskBg(risk: string) {
  if (risk === 'LOW') return 'bg-[#10b981]/10 border-[#10b981]/30 text-[#10b981]'
  if (risk === 'MEDIUM') return 'bg-[#f59e0b]/10 border-[#f59e0b]/30 text-[#f59e0b]'
  if (risk === 'HIGH') return 'bg-[#ef4444]/10 border-[#ef4444]/30 text-[#ef4444]'
  return 'bg-slate-500/10 border-slate-500/30 text-slate-400'
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
      <div className="h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProjectPageClient() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center text-[#d4a017] font-mono">Loading...</div>}>
      <ProjectDetailPage />
    </Suspense>
  )
}

function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const category = params.category as string
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
        const { project: dbP, autoCreated } = await projRes.json()
        setProject(dbP)

        // Redirect to canonical URL if category is wrong (e.g. /m/explore/0x...)
        const correctCat = toCategorySlug(dbP.category)
        const correctSlug = dbP.slug || slug
        if ((autoCreated || category === 'explore') && correctCat !== 'explore') {
          router.replace(`/m/${correctCat}/${correctSlug}`)
          return
        }

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
    <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-[#d4a017] border-t-transparent rounded-full animate-spin" />
        <span className="text-[#818384] font-mono text-sm uppercase tracking-widest">Loading Project...</span>
      </div>
    </div>
  )

  if (error || !project) return (
    <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">🪲</div>
        <p className="text-[#d7dadc] font-bold mb-2">{error || 'Project not found'}</p>
        <Link href="/monitor" className="text-[#d4a017] text-sm font-mono hover:underline">← Back to Explorer</Link>
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
    <div className="min-h-screen bg-[var(--bg-page)] text-[#d7dadc]">
      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-5">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs font-mono text-[#818384]">
          <Link href="/monitor" className="hover:text-[#d4a017] transition-colors uppercase tracking-widest">Explorer</Link>
          <span>/</span>
          <Link href={`/monitor`} className="hover:text-[#d4a017] transition-colors uppercase tracking-widest">{category}</Link>
          <span>/</span>
          <span className="text-[#adadb0] uppercase tracking-widest">{project?.name ?? slug}</span>
        </div>

        {/* ── Hero Card ── */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-xl p-6">
          <div className="flex flex-col sm:flex-row items-start gap-6">

            {/* Avatar */}
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white shrink-0"
              style={{ backgroundColor: chainColor(project.chain) }}>
              {project.name.charAt(0)}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex wrap items-center gap-2 mb-1">
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
                  {copied && <span className="text-xs text-blue-400 font-mono">Copied!</span>}
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
            <div className="shrink-0 flex flex-col items-center justify-center bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl px-6 py-4 min-w-[100px]">
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
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-xl p-5 flex flex-col gap-4">
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
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-xl p-5 flex flex-col gap-4">
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
                  <div key={label} className="bg-[var(--bg-surface)] rounded-lg p-3">
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
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-4 h-4 text-[#d4a017]" />
              <span className="text-xs font-bold font-mono uppercase tracking-widest text-[#adadb0]">Analysis</span>
            </div>
            <p className="text-sm text-[#adadb0] leading-relaxed">{scoreResult?.summary || project.description}</p>
          </div>
        )}

        {/* ── Community Reviews ── */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-xl p-5 flex flex-col gap-4">
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
                <div key={r.id} className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4">
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
          <ReviewForm
            projectId={project.address}
            projectName={project.name}
            onSuccess={() => setReviewKey(k => k + 1)}
          />
        </div>

      </div>
    </div>
  )
}
