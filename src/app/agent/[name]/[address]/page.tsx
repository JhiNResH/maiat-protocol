'use client'

import { useEffect, useState, Suspense, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import {
  Copy, ArrowLeft, ExternalLink, Shield, Activity, Star,
  CheckCircle, AlertTriangle, Bug, Zap, MessageSquare, Trophy, Flame, Radar,
  Globe, TrendingUp, DollarSign, Clock, User, SquarePen, BarChart3
} from 'lucide-react'
import Link from 'next/link'
import { ReviewForm } from '@/components/ReviewForm'
import { ReviewList } from '@/components/ReviewList'
import useSWR from 'swr'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ScoreBreakdown {
  onchainHistory: number
  contractAnalysis: number
  blacklist: number
  activity: number
}

interface ScoreResult {
  score: number
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCompact(val: number): string {
  if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(1)}B`;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

function truncate(addr: string) {
  if (!addr || addr.length < 12) return addr
  return addr.slice(0, 6) + '...' + addr.slice(-4)
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

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={12} className={i <= Math.round(rating) ? 'fill-[#d4a017] text-[#d4a017]' : 'text-[#2a2a2e]'} />
      ))}
    </div>
  )
}

function ScoreBar({ label, value, max, icon }: { label: string; value: number; max: number; icon: React.ReactNode }) {
  const pct = Math.min(100, (value / max) * 100)
  const color = pct >= 66 ? '#10b981' : pct >= 33 ? '#f59e0b' : '#ef4444'
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-2 text-[#818384] font-mono uppercase tracking-widest">
          {icon}
          <span>{label}</span>
        </div>
        <span className="font-bold font-mono" style={{ color }}>{(value ?? 0).toFixed(1)} / {max}</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
        <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AgentDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center text-[#d4a017] font-mono uppercase tracking-widest">Loading...</div>}>
      <AgentDetailContent />
    </Suspense>
  )
}

function AgentDetailContent() {
  const params = useParams()
  const address = params.address as string
  const { user } = usePrivy()
  const walletAddress = user?.wallet?.address

  const [copied, setCopied] = useState(false)
  const [reviewKey, setReviewKey] = useState(0)

  // 1. Fetch Agent Data
  const { data: agentData, isLoading: agentLoading } = useSWR(`/api/v1/agents?search=${address}&limit=1`, fetcher);
  const agent = agentData?.agents?.[0];

  // 2. Fetch Score Result
  const { data: scoreResult } = useSWR(agent ? `/api/v1/score/${address}?summary=true&chain=base` : null, fetcher);

  // 3. Fetch Reviews
  const { data: reviewData } = useSWR(agent ? `/api/v1/review?address=${address}` : null, fetcher);
  const reviews = reviewData?.reviews || [];

  // 4. Fetch Scarab Balance
  const { data: scarab } = useSWR(walletAddress ? `/api/v1/scarab?address=${walletAddress}` : null, fetcher);

  function copy() {
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (agentLoading) return (
    <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-[#d4a017] border-t-transparent rounded-full animate-spin" />
        <span className="text-[#818384] font-mono text-sm uppercase tracking-widest">Loading Project...</span>
      </div>
    </div>
  )

  if (!agent) return (
    <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center font-mono">
      <div className="text-center space-y-6">
        <div className="text-6xl animate-pulse opacity-20">🪲</div>
        <p className="text-slate-500 font-bold uppercase tracking-widest">Project Not Found</p>
        <Link href="/monitor" className="inline-block text-[#d4a017] border border-[#d4a017]/30 px-6 py-2 rounded-xl hover:bg-[#d4a017]/10 transition-all uppercase text-[10px] font-bold tracking-widest">← Back to Explorer</Link>
      </div>
    </div>
  )

  const score = scoreResult?.score ?? (agent.trust?.score ? agent.trust.score / 10 : 0)
  const risk = scoreResult?.risk ?? (score >= 7 ? 'LOW' : score >= 4 ? 'MEDIUM' : 'HIGH')
  const breakdown = scoreResult?.breakdown

  const estimatedBreakdown: ScoreBreakdown = {
    onchainHistory: breakdown?.onchainHistory ?? (score >= 7 ? 3.6 : score >= 4 ? 2.4 : 1.2),
    contractAnalysis: breakdown?.contractAnalysis ?? (score >= 7 ? 2.8 : score >= 4 ? 1.8 : 0.9),
    blacklist: breakdown?.blacklist ?? (score >= 7 ? 1.9 : score >= 4 ? 1.4 : 0.8),
    activity: breakdown?.activity ?? (score >= 7 ? 0.9 : score >= 4 ? 0.6 : 0.3),
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[#d7dadc] font-['JetBrains_Mono',monospace] antialiased selection:bg-[#d4a017]/30">
      <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col gap-8">

        {/* ── Breadcrumb ── */}
        <div className="flex items-center gap-3 text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">
          <Link href="/monitor" className="hover:text-[#d4a017] transition-colors">Explorer</Link>
          <span className="opacity-30">/</span>
          <span className="text-slate-400">Project Details</span>
          <span className="opacity-30">/</span>
          <span className="text-[#d4a017]">{agent.name}</span>
        </div>

        {/* ── Hero Card ── */}
        <div className="glass-card rounded-2xl p-8 relative overflow-hidden group">
          <div className="flex flex-col lg:flex-row items-start gap-10 relative z-10">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="relative w-24 h-24 rounded-2xl overflow-hidden border border-[var(--border-default)] bg-[var(--bg-page)] flex items-center justify-center text-3xl font-black text-white">
                {agent.logo ? (
                  <img src={agent.logo} alt={agent.name} className="w-full h-full object-cover" />
                ) : (
                  agent.name.charAt(0)
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-6">
              <div>
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h1 className="text-3xl font-black">{agent.name}</h1>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#272729] text-[#d4a017]">BASE</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${riskBg(risk)}`}>
                      {risk} RISK
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-[#818384]">
                    <span className="text-xs font-mono">{truncate(address)}</span>
                    <button onClick={copy} className="hover:text-[#d4a017] transition-colors">
                      {copied ? <CheckCircle size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <a href={`https://basescan.org/address/${address}`} target="_blank" rel="noopener noreferrer"
                    className="text-[#818384] hover:text-[#d4a017] transition-colors">
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>

              {/* DESCRIPTION */}
              {agent.description && (
                <p className="text-sm text-[#adadb0] leading-relaxed max-w-3xl">
                  {agent.description}
                </p>
              )}
            </div>

            {/* Score Display */}
            <div className="shrink-0 w-full lg:w-auto flex flex-col items-center justify-center glass-card rounded-2xl px-10 py-8 text-center space-y-2">
              <span className="text-4xl font-black" style={{ color: scoreColor(score) }}>{(score * 10).toFixed(0)}</span>
              <span className="text-[10px] text-[#818384] font-mono uppercase tracking-widest">Trust Score</span>
              <div className="flex flex-col items-center gap-1 mt-2">
                <StarRating rating={score / 2} />
                <span className="text-[10px] text-[#818384]">{reviews.length} reviews</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Data Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Stats Column */}
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Score breakdown */}
            <div className="glass-card rounded-2xl p-6 space-y-6">
              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4 text-[#d4a017]" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#adadb0]">Score Breakdown</h3>
              </div>
              <div className="space-y-5">
                <ScoreBar label="On-Chain History" value={Math.min(4.0, agent.breakdown?.completionRate * 4.0 || estimatedBreakdown.onchainHistory)} max={4.0} icon={<Activity size={12} />} />
                <ScoreBar label="Contract Analysis" value={Math.min(3.0, agent.breakdown?.paymentRate * 3.0 || estimatedBreakdown.contractAnalysis)} max={3.0} icon={<Bug size={12} />} />
                <ScoreBar label="Blacklist Check" value={estimatedBreakdown.blacklist} max={2.0} icon={<CheckCircle size={12} />} />
                <ScoreBar label="Activity" value={estimatedBreakdown.activity} max={1.0} icon={<Zap size={12} />} />
              </div>
            </div>

            {/* On-chain Details */}
            <div className="glass-card rounded-2xl p-6 space-y-6 flex flex-col">
              <div className="flex items-center gap-3">
                <Activity className="w-4 h-4 text-[#d4a017]" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#adadb0]">On-Chain Details</h3>
              </div>
              <div className="grid grid-cols-2 gap-4 flex-1">
                {[
                  { label: 'Transactions', val: agent.breakdown?.totalJobs?.toLocaleString() || '0' },
                  { label: 'AGDP', val: agent.breakdown?.agdp ? formatCompact(agent.breakdown.agdp) : '—' },
                  { label: 'Revenue', val: agent.breakdown?.revenue ? formatCompact(agent.breakdown.revenue) : '—' },
                  { label: 'Type', val: 'ACP Agent' },
                ].map((s, i) => (
                  <div key={i} className="bg-[var(--bg-surface)] rounded-xl p-4 space-y-1">
                    <div className="text-[9px] text-[#818384] font-mono uppercase tracking-wider">{s.label}</div>
                    <div className="text-sm font-bold text-[#d7dadc]">{s.val}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link 
                  href={`/monitor/agent/${(agent.name || 'agent').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}/${address}`}
                  className="w-full py-2.5 bg-white/[0.03] border border-white/5 rounded-xl text-[10px] font-bold text-slate-400 hover:text-white hover:bg-white/[0.08] transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
                >
                  <Radar size={14} /> Monitor
                </Link>
                <Link 
                  href={`/markets?agent=${address}&name=${encodeURIComponent(agent?.name || '')}`}
                  className="w-full py-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[10px] font-bold text-blue-400 hover:bg-blue-500/20 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
                >
                  <BarChart3 size={14} /> Stake on Markets
                </Link>
              </div>
            </div>
          </div>

          {/* Scarab Column */}
          <div className="space-y-6">
            <div className="bg-[#d4a017]/8 border border-[#d4a017]/25 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-2xl">🪲</span>
                <div className="text-right">
                  <div className="text-2xl font-black text-[#d4a017] leading-none">{scarab?.balance ?? '0'}</div>
                  <div className="text-[9px] text-[#818384] font-mono uppercase tracking-widest">your balance</div>
                </div>
              </div>
              <p className="text-[10px] text-[#818384] leading-relaxed">
                Costs <strong className="text-[#d7dadc]">2 🪲</strong> to submit · Quality reviews earn up to <strong className="text-[#d7dadc]">+10 🪲</strong> back
              </p>
            </div>

            {/* Risk + Sentiment Card */}
            <div className="glass-card rounded-2xl p-6 space-y-5">
              {/* Risk Assessment */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[10px] font-bold text-[#adadb0] uppercase tracking-widest">Risk Assessment</div>
                  <div className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                    risk === 'LOW' ? 'text-[#10b981] bg-[#10b981]/10 border-[#10b981]/20' :
                    risk === 'MEDIUM' ? 'text-[#d4a017] bg-[#d4a017]/10 border-[#d4a017]/20' :
                    'text-[#ef4444] bg-[#ef4444]/10 border-[#ef4444]/20'
                  }`}>
                    {risk === 'LOW' ? '🟢 PROCEED' : risk === 'MEDIUM' ? '🟡 CAUTION' : '🔴 AVOID'}
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-2xl font-black" style={{ color: scoreColor(score) }}>{(score * 10).toFixed(0)}</span>
                  <span className="text-[10px] text-[#818384] font-mono">/100</span>
                </div>
                <p className="text-[10px] text-[#818384] leading-relaxed">
                  {score >= 9 ? 'Elite tier agent. Extensive on-chain history with zero risk flags.' :
                   score >= 7 ? 'Reliable agent. Solid behavioral history and clean record.' :
                   score >= 4 ? 'Exercise caution. Limited history or minor risk signals detected.' :
                   'High risk. Insufficient data or significant red flags.'}
                </p>
              </div>

              <div className="h-px bg-[#2a2a2e]" />

              {/* Community Sentiment */}
              <div>
                <div className="text-[10px] font-bold text-[#adadb0] uppercase tracking-widest mb-3">Community Sentiment</div>
                {reviews.length === 0 ? (
                  <p className="text-[10px] text-[#4a4a4e] font-mono">No reviews yet</p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-[#d7dadc]">
                          {(reviewData?.averageRating / 2).toFixed(1)}
                        </span>
                        <div className="flex gap-0.5">
                          {[1,2,3,4,5].map(i => (
                            <Star key={i} size={10} className={i <= Math.round(reviewData?.averageRating / 2) ? 'fill-[#d4a017] text-[#d4a017]' : 'text-[#2a2a2e]'} />
                          ))}
                        </div>
                      </div>
                      <span className="text-[10px] text-[#818384] font-mono">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        reviewData?.averageRating >= 7 ? 'text-[#10b981] bg-[#10b981]/10 border-[#10b981]/20' :
                        reviewData?.averageRating >= 4 ? 'text-[#d4a017] bg-[#d4a017]/10 border-[#d4a017]/20' :
                        'text-[#ef4444] bg-[#ef4444]/10 border-[#ef4444]/20'
                      }`}>
                        {reviewData?.averageRating >= 7 ? '👍 Positive' : reviewData?.averageRating >= 4 ? '🤔 Mixed' : '👎 Negative'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* ── Community Reviews ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-12 border-t border-[var(--border-default)]">
          {/* List — shared ReviewList with upvote/downvote */}
          <div className="lg:col-span-7 space-y-8">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-4 h-4 text-[#d4a017]" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#adadb0]">Community Reviews</h2>
            </div>
            <ReviewList address={address} />
          </div>

          {/* Form */}
          <div className="lg:col-span-5 space-y-6">
            <div className="glass-card rounded-2xl p-8 sticky top-24">
              <div className="flex items-center gap-2 mb-6">
                <Trophy className="w-4 h-4 text-[#d4a017]" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-[#adadb0]">Leave a Review</h2>
              </div>
              <ReviewForm
                projectId={address}
                projectName={agent.name}
                onSuccess={() => setReviewKey(k => k + 1)}
              />
            </div>
          </div>
        </div>

      </div>

      <footer className="mt-20 border-t border-[var(--border-default)] py-12 text-center">
        <div className="text-[10px] font-mono text-[#818384] tracking-[0.4em] uppercase">
          Maiat Protocol // Behavioral Oracle System
        </div>
      </footer>
    </div>
  )
}
