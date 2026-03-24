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
import { motion } from 'framer-motion'
import { ReviewForm } from '@/components/ReviewForm'
import { ReviewList } from '@/components/ReviewList'
import StatCard from '@/components/StatCard'
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
  return 'bg-[var(--text-muted)]/10 border-[var(--text-muted)]/30 text-[var(--text-muted)]'
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
        <Star key={i} size={12} className={i <= Math.round(rating) ? 'fill-emerald-500 text-emerald-500' : 'text-[var(--border-color)]'} />
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
        <div className="flex items-center gap-2 text-[var(--text-secondary)] uppercase tracking-widest">
          {icon}
          <span>{label}</span>
        </div>
        <span className="font-bold font-mono" style={{ color }}>{(value ?? 0).toFixed(1)} / {max}</span>
      </div>
      <div className="h-1.5 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden border border-black/5 dark:border-white/5">
        <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AgentDetailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-[var(--text-muted)] font-mono text-sm uppercase tracking-widest">Loading...</span>
        </div>
      </div>
    }>
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

  // Force dark mode on this page
  useEffect(() => {
    document.documentElement.classList.add('dark')
    return () => {
      // Restore user's theme preference on unmount
      const savedTheme = localStorage.getItem('theme')
      if (savedTheme !== 'dark') {
        document.documentElement.classList.remove('dark')
      }
    }
  }, [])

  // 1. Fetch Agent Data (with detailed ERC-8004 from dedicated endpoint)
  const { data: agentData, isLoading: agentLoading } = useSWR(`/api/v1/agents?search=${address}&limit=1`, fetcher);
  const agent = agentData?.agents?.[0];

  // 1b. Fetch detailed agent data including ERC-8004
  const { data: agentDetail } = useSWR(agent ? `/api/v1/agent/${address}` : null, fetcher);
  const erc8004 = agentDetail?.erc8004;

  // 2. Fetch Score Result
  const { data: scoreResult } = useSWR(agent ? `/api/v1/score/${address}?summary=true&chain=base` : null, fetcher);

  // 3. Fetch Reviews
  const { data: reviewData } = useSWR(agent ? `/api/v1/review?address=${address}` : null, fetcher);
  const reviews = reviewData?.reviews || [];

  // 4. Fetch Scarab Balance
  const { data: scarab } = useSWR(walletAddress ? `/api/v1/scarab?address=${walletAddress}` : null, fetcher);

  // 5. Fetch Wadjet Rug Prediction
  const { data: rugData } = useSWR(agent ? `/api/v1/agent/${address}/rug-prediction` : null, fetcher);

  function copy() {
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (agentLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-[var(--text-muted)] font-mono text-sm uppercase tracking-widest">Loading Project...</span>
      </div>
    </div>
  )

  if (!agent) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-6">
        <div className="text-6xl animate-pulse opacity-20">🪲</div>
        <p className="text-[var(--text-muted)] font-bold uppercase tracking-widest">Project Not Found</p>
        <Link href="/leaderboard" className="inline-block text-emerald-500 border border-emerald-500/30 px-6 py-2 rounded-2xl hover:bg-emerald-500/10 transition-all uppercase text-[10px] font-bold tracking-widest">← Back to Leaderboard</Link>
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
    <div className="pb-20 relative min-h-screen bg-[#0A0A0A] text-white">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 relative">

        {/* ── Hero Section ── */}
        <section className="mb-8 sm:mb-12 pt-6 sm:pt-12 text-center">
          {/* Breadcrumb */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center justify-center gap-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[0.2em] mb-6"
          >
            <Link href="/leaderboard" className="hover:text-emerald-500 transition-colors">Leaderboard</Link>
            <span className="opacity-30">/</span>
            <span className="text-[var(--text-secondary)]">Agent</span>
            <span className="opacity-30">/</span>
            <span className="text-emerald-500">{agent.name}</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="atmosphere-text font-black text-[var(--text-color)]"
          >
            {agent.name}
          </motion.h1>

          {agent.description && (
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-[var(--text-secondary)] text-xl max-w-2xl font-medium mx-auto mt-8"
            >
              {agent.description}
            </motion.p>
          )}
        </section>

        {/* ── Stat Cards Row ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8"
        >
          <StatCard label="Trust Score" value={(score * 10).toFixed(0)} delay={0.3} />
          <StatCard label="Reviews" value={reviews.length} delay={0.35} />
          <StatCard label="Transactions" value={agent.breakdown?.totalJobs?.toLocaleString() || '0'} delay={0.4} />
          <StatCard label="Scarab Balance" value={scarab?.balance ?? '0'} delay={0.45} />
        </motion.div>

        {/* ── Hero Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="liquid-glass rounded-[1.5rem] sm:rounded-[3rem] p-5 sm:p-8 relative overflow-hidden group mb-6 sm:mb-8 hover-lift"
        >
          <div className="flex flex-col lg:flex-row items-start gap-6 sm:gap-10 relative z-10">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="relative w-24 h-24 rounded-2xl overflow-hidden border border-[var(--border-color)] flex items-center justify-center text-3xl font-black text-[var(--text-color)]">
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
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500">BASE</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${riskBg(risk)}`}>
                      {risk} RISK
                    </span>
                    {erc8004?.registered && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/30 cursor-help"
                        title={`ERC-8004 Identity #${erc8004.agentId} — Reputation: ${erc8004.reputation?.normalizedScore ?? 0}/100`}
                      >
                        8004
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-[var(--text-muted)]">
                    <span className="text-xs font-mono">{truncate(address)}</span>
                    <button onClick={copy} className="hover:text-emerald-500 transition-colors">
                      {copied ? <CheckCircle size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <a href={`https://basescan.org/address/${address}`} target="_blank" rel="noopener noreferrer"
                    className="text-[var(--text-muted)] hover:text-emerald-500 transition-colors">
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            </div>

            {/* Score Display */}
            <div className="shrink-0 w-full lg:w-auto flex flex-col items-center justify-center liquid-glass rounded-[3rem] px-10 py-8 text-center space-y-2">
              <span className="text-4xl font-black" style={{ color: scoreColor(score) }}>{(score * 10).toFixed(0)}</span>
              <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">Trust Score</span>
              <div className="flex flex-col items-center gap-1 mt-2">
                <StarRating rating={score / 2} />
                <span className="text-[10px] text-[var(--text-muted)]">{reviews.length} reviews</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Data Grid ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8"
        >
          {/* Stats Column */}
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Score breakdown */}
            <div className="liquid-glass rounded-[1.5rem] sm:rounded-[3rem] p-6 sm:p-10 space-y-6 hover-lift">
              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4 text-emerald-500" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">Score Breakdown</h3>
              </div>
              <div className="space-y-5">
                <ScoreBar label="On-Chain History" value={Math.min(4.0, agent.breakdown?.completionRate * 4.0 || estimatedBreakdown.onchainHistory)} max={4.0} icon={<Activity size={12} />} />
                <ScoreBar label="Contract Analysis" value={Math.min(3.0, agent.breakdown?.paymentRate * 3.0 || estimatedBreakdown.contractAnalysis)} max={3.0} icon={<Bug size={12} />} />
                <ScoreBar label="Blacklist Check" value={estimatedBreakdown.blacklist} max={2.0} icon={<CheckCircle size={12} />} />
                <ScoreBar label="Activity" value={estimatedBreakdown.activity} max={1.0} icon={<Zap size={12} />} />
              </div>
            </div>

            {/* On-chain Details */}
            <div className="liquid-glass rounded-[1.5rem] sm:rounded-[3rem] p-6 sm:p-10 space-y-6 flex flex-col hover-lift">
              <div className="flex items-center gap-3">
                <Activity className="w-4 h-4 text-emerald-500" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">On-Chain Details</h3>
              </div>
              <div className="grid grid-cols-2 gap-4 flex-1">
                {[
                  { label: 'Transactions', val: agent.breakdown?.totalJobs?.toLocaleString() || '0' },
                  { label: 'AGDP', val: agent.breakdown?.agdp ? formatCompact(agent.breakdown.agdp) : '—' },
                  { label: 'Revenue', val: agent.breakdown?.revenue ? formatCompact(agent.breakdown.revenue) : '—' },
                  { label: 'Type', val: 'ACP Agent' },
                ].map((s, i) => (
                  <div key={i} className="bg-[var(--bg-color)] rounded-2xl p-4 space-y-1 border border-[var(--border-color)]">
                    <div className="text-[9px] text-[var(--text-muted)] font-mono uppercase tracking-wider">{s.label}</div>
                    <div className="text-sm font-bold text-[var(--text-color)]">{s.val}</div>
                  </div>
                ))}
              </div>
              {/* ERC-8004 Identity Section */}
              {erc8004?.registered && (
                <div className="bg-[#10b981]/5 border border-[#10b981]/20 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-[#10b981] uppercase tracking-widest">ERC-8004 Identity</span>
                      <span className="text-[9px] font-mono text-[var(--text-muted)]">#{erc8004.agentId}</span>
                    </div>
                    <CheckCircle size={12} className="text-[#10b981]" />
                  </div>
                  {erc8004.reputation && (
                    <div className="flex items-center gap-4 text-[10px]">
                      <div>
                        <span className="text-[var(--text-muted)]">Reputation: </span>
                        <span className="font-bold text-[#10b981]">{erc8004.reputation.normalizedScore}/100</span>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)]">Reviews: </span>
                        <span className="font-bold text-[var(--text-color)]">{erc8004.reputation.count}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="mt-4">
                <Link 
                  href={`/markets?agent=${address}&name=${encodeURIComponent(agent?.name || '')}`}
                  className="w-full py-3 bg-[var(--text-color)] text-[var(--bg-color)] rounded-2xl text-[10px] font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
                >
                  <BarChart3 size={14} /> Stake on Markets
                </Link>
              </div>
            </div>
          </div>

          {/* Scarab Column */}
          <div className="space-y-6">
            <div className="liquid-glass rounded-[1.5rem] sm:rounded-[3rem] p-6 sm:p-10 space-y-4 hover-lift">
              <div className="flex items-center justify-between">
                <span className="text-2xl">🪲</span>
                <div className="text-right">
                  <div className="text-2xl font-black text-emerald-500 leading-none">{scarab?.balance ?? '0'}</div>
                  <div className="text-[9px] text-[var(--text-muted)] font-mono uppercase tracking-widest">your balance</div>
                </div>
              </div>
              <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                Costs <strong className="text-[var(--text-color)]">2 🪲</strong> to submit · Quality reviews earn up to <strong className="text-[var(--text-color)]">+10 🪲</strong> back
              </p>
            </div>

            {/* Risk + Sentiment Card */}
            <div className="liquid-glass rounded-[1.5rem] sm:rounded-[3rem] p-6 sm:p-10 space-y-5 hover-lift">
              {/* Risk Assessment */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">Risk Assessment</div>
                  <div className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                    risk === 'LOW' ? 'text-[#10b981] bg-[#10b981]/10 border-[#10b981]/20' :
                    risk === 'MEDIUM' ? 'text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/20' :
                    'text-[#ef4444] bg-[#ef4444]/10 border-[#ef4444]/20'
                  }`}>
                    {risk === 'LOW' ? '🟢 PROCEED' : risk === 'MEDIUM' ? '🟡 CAUTION' : '🔴 AVOID'}
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-2xl font-black" style={{ color: scoreColor(score) }}>{(score * 10).toFixed(0)}</span>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">/100</span>
                </div>
                <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                  {score >= 9 ? 'Elite tier agent. Extensive on-chain history with zero risk flags.' :
                   score >= 7 ? 'Reliable agent. Solid behavioral history and clean record.' :
                   score >= 4 ? 'Exercise caution. Limited history or minor risk signals detected.' :
                   'High risk. Insufficient data or significant red flags.'}
                </p>
              </div>

              <div className="h-px bg-[var(--border-color)]" />

              {/* Wadjet Rug Prediction */}
              {rugData?.prediction && (() => {
                const p = rugData.prediction;
                const col = p.riskLevel === 'critical' ? '#ef4444' : p.riskLevel === 'high' ? '#f97316' : p.riskLevel === 'medium' ? '#f59e0b' : '#10b981';
                return (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">Wadjet Risk Intel</div>
                      <div style={{ color: col, background: `${col}15`, border: `1px solid ${col}30` }} className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">
                        {p.riskLevel}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-1 h-2 rounded-full bg-black/5 dark:bg-white/5 overflow-hidden">
                        <div style={{ width: `${p.rugScore}%`, background: `linear-gradient(90deg, ${col}80, ${col})` }} className="h-full rounded-full" />
                      </div>
                      <span style={{ color: col }} className="text-lg font-black font-mono">{p.rugScore}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">/100</span>
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] leading-relaxed mb-3">{p.summary}</p>
                    {p.signals.filter((s: any) => s.severity !== 'info').slice(0, 4).length > 0 && (
                      <div className="space-y-1.5">
                        {p.signals.filter((s: any) => s.severity !== 'info').slice(0, 4).map((s: any) => (
                          <div key={s.name} className="flex items-center gap-2 text-[10px]">
                            <span style={{ color: s.severity === 'danger' ? '#ef4444' : '#f59e0b' }}>
                              {s.severity === 'danger' ? '⚠' : '◆'}
                            </span>
                            <span className="text-[var(--text-muted)] flex-1">{s.name}</span>
                            <span className="text-[var(--text-muted)] font-mono">{s.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 text-[8px] text-[var(--text-muted)] font-mono">Powered by Wadjet · {rugData.meta?.model}</div>
                  </div>
                );
              })()}

              <div className="h-px bg-[var(--border-color)]" />

              {/* Community Sentiment */}
              <div>
                <div className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-3">Community Sentiment</div>
                {reviews.length === 0 ? (
                  <p className="text-[10px] text-[var(--text-muted)] font-mono">No reviews yet</p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-[var(--text-color)]">
                          {(reviewData?.averageRating / 2).toFixed(1)}
                        </span>
                        <div className="flex gap-0.5">
                          {[1,2,3,4,5].map(i => (
                            <Star key={i} size={10} className={i <= Math.round(reviewData?.averageRating / 2) ? 'fill-emerald-500 text-emerald-500' : 'text-[var(--border-color)]'} />
                          ))}
                        </div>
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        reviewData?.averageRating >= 7 ? 'text-[#10b981] bg-[#10b981]/10 border-[#10b981]/20' :
                        reviewData?.averageRating >= 4 ? 'text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/20' :
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
        </motion.div>

        {/* ── Community Reviews ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.55 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 pt-8 sm:pt-12 border-t border-[var(--border-color)]"
        >
          {/* List — shared ReviewList with upvote/downvote */}
          <div className="lg:col-span-7 space-y-8">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-4 h-4 text-emerald-500" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">Community Reviews</h2>
            </div>
            <ReviewList address={address} />
          </div>

          {/* Form */}
          <div className="lg:col-span-5 space-y-6">
            <div className="liquid-glass rounded-[1.5rem] sm:rounded-[3rem] p-5 sm:p-8 sticky top-24 hover-lift">
              <div className="flex items-center gap-2 mb-6">
                <Trophy className="w-4 h-4 text-emerald-500" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">Leave a Review</h2>
              </div>
              <ReviewForm
                projectId={address}
                projectName={agent.name}
                onSuccess={() => setReviewKey(k => k + 1)}
              />
            </div>
          </div>
        </motion.div>

      </main>
    </div>
  )
}
