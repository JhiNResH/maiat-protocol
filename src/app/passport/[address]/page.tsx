'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import Link from 'next/link'
import { Award, Zap, Info } from "lucide-react";
import { motion } from "framer-motion";
import StatCard from "@/components/StatCard";

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
  displayName: string | null
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

function fmt(addr?: string) {
  if (!addr) return '0x???…????'
  return addr.slice(0, 6) + '…' + addr.slice(-4)
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="text-xs font-mono">
      {[1,2,3,4,5].map(i => (
        <span key={i} className={i <= rating ? 'text-amber-400' : 'text-[var(--border-color)]'}>★</span>
      ))}
    </span>
  )
}

function RepBar({ score }: { score: number }) {
  // Guardian is 200, Verified is 50, Trusted is 10, New is 0
  // Scaling: 0-250 for progress bar
  const pct = Math.min(100, (score / 200) * 100)
  const color = score >= 200 ? '#A78BFA' : score >= 50 ? '#FBBF24' : score >= 10 ? '#34D399' : '#9CA3AF'
  return (
    <div className="w-full bg-[var(--bg-elevated)] rounded-full h-1.5 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}88` }}
      />
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PassportPage() {
  const params = useParams()
  const address = (params?.address as string)?.toLowerCase()
  const { user } = usePrivy()
  const { wallets } = useWallets()
  const externalWallet = wallets.find(w => w.walletClientType !== 'privy')

  const [data, setData] = useState<PassportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  
  // Profile editing
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [editError, setEditError] = useState('')

  // reviewable projects removed — only agents matter now
  const [reviewableAgents, setReviewableAgents] = useState<ReviewableAgent[]>([])
  const [agentsLoading, setAgentsLoading] = useState(false)
  const [showAllAgents, setShowAllAgents] = useState(false)

  const isOwn = (externalWallet?.address ?? user?.wallet?.address)?.toLowerCase() === address

  useEffect(() => {
    if (!address || !/^0x[a-f0-9]{40}$/.test(address)) return
    setLoading(true)
    fetch(`/api/v1/wallet/${address}/passport`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.passport) setData(d) })
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

  const handleUpdateProfile = async () => {
    if (!editName.trim() || savingProfile) return
    setSavingProfile(true)
    setEditError('')
    try {
      // 1. Sign the intent
      const activeWallet = wallets.find(w => w.address.toLowerCase() === address.toLowerCase())
        || wallets.find(w => w.walletClientType !== 'privy')
      if (!activeWallet) throw new Error('Wallet not connected')

      const message = `Update my Maiat profile name to: ${editName}`
      const signature = await activeWallet.sign(message)

      // 2. POST to API
      const res = await fetch(`/api/v1/wallet/${address}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: editName, signature })
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Update failed')

      // 3. Update local state
      setData(prev => prev ? { ...prev, displayName: editName } : null)
      setIsEditing(false)
    } catch (err: any) {
      setEditError(err.message || 'Failed to update')
    } finally {
      setSavingProfile(false)
    }
  }

  if (loading) {
    return (
      <div className="pb-20 relative flex items-center justify-center min-h-[60vh]">
        
        <p className="text-[var(--text-muted)] text-xs font-medium animate-pulse">Loading passport…</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="pb-20 relative flex items-center justify-center min-h-[60vh] gap-3">
        
        <div className="m-auto flex flex-col items-center gap-3">
          <p className="text-[var(--text-secondary)] font-medium text-sm">Invalid address</p>
          <Link href="/monitor" className="text-emerald-500 font-bold text-xs hover:underline">← back to monitor</Link>
        </div>
      </div>
    )
  }

  // Fallback if passport data is missing
  const passport = data.passport ?? {
    trustLevel: 'new',
    reputationScore: 0,
    jobsCompleted: 0,
    jobsFailed: 0,
    completionRate: 0,
    avgRating: 0,
    totalEarned: 0,
    totalSpent: 0,
    firstSeen: null,
    lastActive: null,
    badges: [],
  }
  const trust = TRUST_CONFIG[passport.trustLevel] ?? TRUST_CONFIG.new
  const perks = TRUST_PERKS[passport.trustLevel] ?? TRUST_PERKS.new
  const unreviewedAgents = reviewableAgents.filter(a => !a.reviewed)
  const visibleAgents = showAllAgents ? unreviewedAgents : unreviewedAgents.slice(0, 10)

  return (
    <div className="pb-20 relative">
      <main className="max-w-6xl mx-auto px-6 relative">

        {/* Hero */}
        <section className="mb-16 pt-12 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="atmosphere-text font-black text-[var(--text-color)]"
          >
            Passport
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-[var(--text-secondary)] text-xl max-w-2xl font-medium mx-auto mt-8"
          >
            {data?.displayName || fmt(data?.address)} · {trust.label}
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="flex items-center justify-center gap-3 mt-6"
          >
            {isOwn && (
              <span className="px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                Your Passport
              </span>
            )}
            <button
              onClick={handleCopy}
              className="px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-color)] transition-all"
            >
              {copied ? '✓ Copied' : '⎘ Share'}
            </button>
          </motion.div>
        </section>

        <div className="space-y-6">

          {/* ── Row 1: Hero Trust Passport Card ────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative liquid-glass rounded-[2.5rem] p-8 hover-lift"
          >
            <div className="relative">
              {/* Address + edit row */}
              <div className="flex items-start justify-between mb-5">
                <div>
                  {isEditing ? (
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        placeholder="Enter display name…"
                        className="bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[var(--text-color)] text-sm font-medium px-3 py-1.5 rounded outline-none focus:border-emerald-500"
                        autoFocus
                      />
                      <button
                        onClick={handleUpdateProfile}
                        disabled={savingProfile}
                        className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                      >
                        {savingProfile ? '…' : 'SAVE'}
                      </button>
                      <button
                        onClick={() => { setIsEditing(false); setEditError('') }}
                        className="text-[10px] font-bold text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                      >
                        CANCEL
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                       <p className="text-[var(--text-color)] text-lg font-black tracking-wide">
                        {data?.displayName || fmt(data?.address)}
                      </p>
                      {isOwn && (
                        <button
                          onClick={() => { setIsEditing(true); setEditName(data?.displayName || '') }}
                          className="p-1 hover:bg-emerald-500/10 rounded transition-colors text-[var(--text-muted)] hover:text-[var(--text-color)]"
                          title="Edit Profile"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                        </button>
                      )}
                    </div>
                  )}
                  {editError && <p className="text-[9px] text-rose-500 font-medium mt-1">{editError}</p>}
                  <p className="text-[var(--text-muted)] text-[10px] font-medium mt-0.5">{data?.address}</p>
                </div>
                <span
                  className="text-xs font-bold px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)]"
                  style={{ color: trust.color }}
                >
                  {trust.label}
                </span>
              </div>

              {/* Reputation progress bar */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-secondary)]">Reputation</span>
                  <span className="text-[10px] font-mono" style={{ color: trust.color }}>{passport.reputationScore} pts</span>
                </div>
                <RepBar score={passport.reputationScore} />
              </div>
            </div>
          </motion.div>

          {/* ── Stat Cards (same pattern as analytics) ─────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-4">
            <StatCard label="Reputation" value={passport.reputationScore} delay={0.3} />
            <StatCard label="Reviews" value={passport.totalReviews} delay={0.4} />
            <StatCard label="🪲 Scarab" value={data?.scarab?.balance ?? 0} delay={0.5} />
          </div>

          {/* ── Daily Scarab Claim ─────────────────────────────────────── */}
          {isOwn && <ScarabClaim walletAddress={address} />}

          {/* ── Row 2: Agents | Market Positions ────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Agents You Can Review */}
            <div className="liquid-glass rounded-[2.5rem] p-8 hover-lift">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-muted)]">
                  Agents You Can Review
                </p>
                {unreviewedAgents.length > 0 && (
                  <span className="text-[10px] text-[var(--text-muted)] font-medium border border-[var(--border-color)] px-1.5 py-0.5 rounded">
                    {unreviewedAgents.length} pending
                  </span>
                )}
              </div>

              {agentsLoading ? (
                <p className="text-[var(--text-muted)] text-[10px] font-medium animate-pulse py-2">Scanning ACP history…</p>
              ) : unreviewedAgents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 gap-2">
                  <p className="text-[var(--text-muted)] text-[10px] font-medium">No unreviewed agents.</p>
                  <Link href="/monitor" className="text-[10px] text-emerald-500 font-bold hover:underline">
                    Explore agents →
                  </Link>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-1.5">
                    {visibleAgents.map(agent => {
                      const score = agent.score != null ? (agent.score / 10).toFixed(1) : '—'
                      const scoreColor = agent.score == null ? 'text-[var(--text-muted)]' :
                        agent.score >= 70 ? 'text-emerald-500' :
                        agent.score >= 40 ? 'text-[#06b6d4]' : 'text-emerald-500'

                      return (
                        <Link
                          key={agent.address}
                          href={`/review/${agent.address}`}
                          className="flex items-center gap-2 liquid-glass border border-[var(--border-color)] rounded-lg px-2 py-1.5 hover:border-emerald-500/20 hover:bg-emerald-500/5 transition-all"
                        >
                          {agent.logo ? (
                            <img src={agent.logo} alt={agent.name} className="w-6 h-6 rounded object-cover shrink-0" />
                          ) : (
                            <div
                              className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold shrink-0"
                              style={{ background: '#10b98122', color: '#10b981', border: '1px solid #10b98144' }}
                            >
                              {agent.name.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-[var(--text-color)] text-[10px] font-bold truncate">{agent.name}</p>
                            <p className="text-[var(--text-muted)] text-[9px] font-medium"><span className={scoreColor}>{score}</span></p>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                  {unreviewedAgents.length > 10 && !showAllAgents && (
                    <button
                      onClick={() => setShowAllAgents(true)}
                      className="mt-3 w-full text-[10px] text-emerald-500 font-bold hover:underline"
                    >
                      Show {unreviewedAgents.length - 10} more →
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Market Positions */}
            <MarketPositions address={address} />
          </motion.div>

          {/* ── Row 3: Perks | Review History ───────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Level Perks */}
            <div className="liquid-glass rounded-[2.5rem] p-8 hover-lift">
              <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-muted)] mb-3">
                Level Perks
              </p>
              <div className="flex flex-col gap-3">
                {perks.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 text-sm font-medium px-5 py-3 rounded-2xl"
                    style={{
                      color: trust.color,
                      backgroundColor: `${trust.color}10`,
                    }}
                  >
                    <span className="text-base" style={{ color: trust.color }}>✓</span>
                    <span>{p}</span>
                  </div>
                ))}
              </div>
              {passport.trustLevel !== 'guardian' && (
                <p className="mt-3 text-[10px] text-[var(--text-muted)] font-medium">
                  Review more to level up →{' '}
                  <Link href="/monitor" className="text-emerald-500 hover:underline">browse</Link>
                </p>
              )}
            </div>

            {/* Review History */}
            <div className="liquid-glass rounded-[2.5rem] p-8 hover-lift">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-muted)]">
                  Review History
                </p>
                {data?.reviews?.count > 0 && (
                  <span className="text-[10px] text-[var(--text-muted)] font-medium border border-[var(--border-color)] px-1.5 py-0.5 rounded">
                    {data?.reviews?.count} total
                  </span>
                )}
              </div>

              {data?.reviews?.recent?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 gap-2">
                  <p className="text-[var(--text-muted)] text-[10px] font-medium">No reviews yet.</p>
                  {isOwn && (
                    <Link href="/review" className="text-[10px] text-emerald-500 font-bold hover:underline">
                      Leave your first review →
                    </Link>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {data?.reviews?.recent?.map(r => (
                    <div key={r.id} className="liquid-glass border border-[var(--border-color)] rounded-lg px-2.5 py-2 hover:border-emerald-500/20 transition-colors">
                      <div className="flex items-center justify-between">
                        <Link
                          href={`/review/${r.address}`}
                          className="text-[10px] text-[var(--text-secondary)] font-medium hover:text-[var(--text-color)] transition-colors"
                        >
                          {r.name || fmt(r.address)}
                        </Link>
                        <div className="flex items-center gap-1.5">
                          <StarRating rating={r.rating} />
                          <span className="text-[var(--text-muted)] text-[10px] font-medium">
                            {new Date(r.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      {r.comment && (
                        <p className="text-[var(--text-muted)] text-[10px] font-medium leading-snug mt-1">
                          &ldquo;{r.comment.slice(0, 80)}{r.comment.length > 80 ? '…' : ''}&rdquo;
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {/* ── CTA (if not own wallet) ──────────────────────────────────── */}
          {!isOwn && (
            <div className="liquid-glass border border-[var(--border-color)] rounded-[2.5rem] p-8 text-center">
              <p className="text-[var(--text-muted)] text-[10px] font-medium mb-3">View your own trust passport</p>
              <Link
                href="/passport"
                className="inline-block bg-[var(--text-color)] text-[var(--bg-color)] font-bold text-xs px-6 py-3 rounded-2xl transition-all hover:opacity-90"
              >
                Connect Wallet →
              </Link>
            </div>
          )}

        </div>
        </div>
      </main>
    </div>
  )
}

// ── Market Positions component ────────────────────────────────────────────────

function MarketPositions({ address }: { address: string }) {
  const [positions, setPositions] = useState<Array<{
    marketId: string
    marketTitle: string
    projectName: string
    amount: number
    status: string
    payout: number | null
    createdAt: string
  }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!address || !/^0x[a-f0-9]{40}$/.test(address)) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/v1/wallet/${address}/positions`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => {
        console.log('[Passport] positions for', address, '→', d.positions?.length ?? 0);
        setPositions(d.positions ?? []);
      })
      .catch((e) => {
        console.error('[Passport] positions error:', e);
        setPositions([]);
      })
      .finally(() => setLoading(false))
  }, [address])

  if (loading) return (
    <div className="liquid-glass rounded-[2.5rem] p-8 hover-lift">
      <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-muted)] animate-pulse">
        Loading positions…
      </p>
    </div>
  )

  if (positions.length === 0) return (
    <div className="liquid-glass rounded-[2.5rem] p-8 hover-lift">
      <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-muted)] mb-3">
        Market Positions
      </p>
      <div className="flex flex-col items-center justify-center py-4 gap-2">
        <p className="text-[var(--text-muted)] text-[10px] font-medium">No positions yet.</p>
        <Link href="/markets" className="text-[10px] text-emerald-500 font-bold hover:underline">
          Browse markets →
        </Link>
      </div>
    </div>
  )

  const totalStaked = positions.reduce((s, p) => s + p.amount, 0)

  // Merge positions by project+market
  const merged = Object.values(
    positions.reduce<Record<string, any>>((acc, pos) => {
      const key = `${pos.projectName}__${pos.marketId}`
      if (!acc[key]) acc[key] = { ...pos, totalAmount: 0, count: 0 }
      acc[key].totalAmount += pos.amount
      acc[key].count += 1
      return acc
    }, {})
  )

  return (
    <div className="liquid-glass rounded-[2.5rem] p-8 hover-lift">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-muted)]">
          Market Positions
        </p>
        <span className="text-[10px] text-emerald-500 font-bold border border-emerald-500/20 px-1.5 py-0.5 rounded">
          {totalStaked} 🪲 staked
        </span>
      </div>
      <div className="space-y-1.5">
        {merged.map((pos, i) => (
          <Link
            key={i}
            href={`/markets/${pos.marketId}`}
            className="flex items-center justify-between liquid-glass border border-[var(--border-color)] rounded-lg px-2.5 py-2 hover:border-emerald-500/20 hover:bg-emerald-500/5 transition-all"
          >
            <div className="min-w-0">
              <p className="text-[var(--text-color)] text-[10px] font-bold truncate">{pos.projectName}</p>
              <p className="text-[var(--text-muted)] text-[9px] font-medium truncate">{pos.marketTitle}</p>
            </div>
            <div className="text-right shrink-0 ml-2">
              <p className="text-[var(--text-color)] text-[10px] font-bold">{pos.totalAmount} 🪲</p>
              <p className={`text-[9px] font-medium ${
                pos.status === 'resolved'
                  ? (pos.payout && pos.payout > 0 ? 'text-emerald-400' : 'text-red-400')
                  : 'text-[var(--text-muted)]'
              }`}>
                {pos.status === 'resolved'
                  ? (pos.payout && pos.payout > 0 ? `+${pos.payout} 🪲` : 'Lost')
                  : pos.status}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ── Scarab Claim component ──────────────────────────────────────────────────
function ScarabClaim({ walletAddress }: { walletAddress: string }) {
  const { wallets } = useWallets()
  const [claiming, setClaiming] = useState(false)
  const [claimResult, setClaimResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [hasClaimed, setHasClaimed] = useState(false)

  // Check if already claimed today
  useEffect(() => {
    fetch(`/api/v1/scarab/status?address=${walletAddress}`)
      .then(r => r.json())
      .then(d => { if (d.claimedToday) setHasClaimed(true) })
      .catch(() => {})
  }, [walletAddress])

  const handleClaim = async () => {
    if (claiming || hasClaimed) return
    setClaiming(true)
    setClaimResult(null)
    try {
      // 1. Get nonce
      const nonceRes = await fetch(`/api/v1/scarab/nonce?address=${walletAddress}`)
      const { nonce, expiresAt } = await nonceRes.json()

      // 2. Find wallet and sign
      const activeWallet = wallets.find(w => w.address.toLowerCase() === walletAddress.toLowerCase())
        || wallets.find(w => w.walletClientType !== 'privy')
      if (!activeWallet) throw new Error('Wallet not connected')

      const { getAddress } = await import('viem')
      const checksumAddress = getAddress(activeWallet.address)
      const message = [`Claim daily Scarab for ${checksumAddress}`, `Nonce: ${nonce}`, `Expiration: ${expiresAt}`].join('\n')
      const signature = await activeWallet.sign(message)

      // 3. Claim
      const res = await fetch('/api/v1/scarab/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: checksumAddress, signature, nonce, expiresAt }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Claim failed')

      setHasClaimed(true)
      if (result.alreadyClaimed) {
        setClaimResult({ ok: false, text: 'Already claimed today!' })
      } else {
        setClaimResult({ ok: true, text: `+${result.amount ?? 5} 🪲 claimed! Streak: ${result.streak ?? 1} day(s)` })
      }
    } catch (err: any) {
      setClaimResult({ ok: false, text: err.message || 'Failed' })
    } finally {
      setClaiming(false)
    }
  }

  return (
    <div className="liquid-glass rounded-[2.5rem] p-6 hover-lift">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-muted)]">🪲 DAILY SCARAB</p>
          {claimResult && (
            <p className={`text-[10px] font-mono mt-1 ${claimResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
              {claimResult.text}
            </p>
          )}
        </div>
        {hasClaimed ? (
          <span className="text-[10px] font-bold px-3 py-1.5 rounded-lg" style={{ color: '#34d399', backgroundColor: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
            ✓ Claimed Today
          </span>
        ) : (
          <button
            onClick={handleClaim}
            disabled={claiming}
            className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
          >
            {claiming ? 'Signing...' : 'Claim Scarab'}
          </button>
        )}
      </div>
    </div>
  )
}
