'use client'

import { usePrivy, useWallets } from '@privy-io/react-auth'
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { getAddress } from 'viem'
import { motion } from 'motion/react'
import {
  Shield, Flame, Trophy, ArrowRight, Star, Clock,
  MessageSquare, Zap, CheckCircle, ExternalLink, Copy, Target, User, LogOut
} from 'lucide-react'

// ─── Constants ───────────────────────────────────────────────────────────────

const TRUST_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; rank: number }> = {
  new:      { label: 'NEW',      color: '#9CA3AF', bg: '#1a1a1a',   border: '#333',    rank: 0 },
  basic:    { label: 'BASIC',    color: '#3b82f6', bg: '#0f1b2d',   border: '#1e40af', rank: 1 },
  trusted:  { label: 'TRUSTED',  color: '#10b981', bg: '#0a1f14',   border: '#065f46', rank: 2 },
  verified: { label: 'VERIFIED', color: '#06b6d4', bg: '#083344',   border: '#0e7490', rank: 3 },
  guardian: { label: 'GUARDIAN', color: '#8b5cf6', bg: '#1e1b4b',   border: '#4c1d95', rank: 4 },
}

// ─── Types ───────────────────────────────────────────────────────────────────

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
  scarab: {
    balance: number
    streak: number
    totalEarned: number
  }
  reviews: {
    recent: Array<{ id: string; rating: number; comment: string; address: string; name?: string | null; createdAt: string }>
    count: number
  }
}

interface ReviewableAgent {
  address: string
  name: string
  logo: string | null
  score: number | null
  reviewed: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(addr: string) {
  if (!addr) return ''
  return addr.slice(0, 6) + '…' + addr.slice(-4)
}

function RepBar({ score, color }: { score: number; color: string }) {
  const pct = Math.min(100, score)
  return (
    <div className="w-full bg-black/40 rounded-full h-1.5 overflow-hidden border border-white/5">
      <div
        className="h-full rounded-full transition-all duration-1000 ease-out"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  )
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

// ─── Main View ────────────────────────────────────────────────────────────────

export function DashboardView() {
  const { ready, authenticated, user, login, logout } = usePrivy()
  const { wallets } = useWallets()
  const walletAddress = user?.wallet?.address

  const [data, setData] = useState<PassportData | null>(null)
  const [reviewable, setReviewable] = useState<ReviewableAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [hasClaimed, setHasClaimed] = useState(false)
  const [claimMsg, setClaimMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  // Load Passport Data
  useEffect(() => {
    if (!walletAddress) return
    setLoading(true)
    fetch(`/api/v1/wallet/${walletAddress}/passport`)
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [walletAddress, refreshTick])

  // Load Reviewable Agents
  useEffect(() => {
    if (!walletAddress) return
    fetch(`/api/v1/passport/${walletAddress}/reviewable`)
      .then(r => r.json())
      .then(d => setReviewable(d.agents ?? []))
      .catch(console.error)
  }, [walletAddress])

  async function claimDaily() {
    if (!walletAddress || claiming) return
    setClaiming(true)
    setClaimMsg(null)
    try {
      const nonceRes = await fetch(`/api/v1/scarab/nonce?address=${walletAddress}`);
      const { nonce, expiresAt } = await nonceRes.json();
      const activeWallet = wallets.find((w) => w.address.toLowerCase() === walletAddress.toLowerCase());
      if (!activeWallet) throw new Error('Wallet not ready. Try reconnecting.');
      const checksumAddress = getAddress(activeWallet.address);
      const message = [`Claim daily Scarab for ${checksumAddress}`, `Nonce: ${nonce}`, `Expiration: ${expiresAt}`].join('\n');
      const signature = await activeWallet.sign(message);
      const res = await fetch('/api/v1/scarab/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: checksumAddress, signature, nonce, expiresAt }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Claim failed');
      if (result.alreadyClaimed) {
        setHasClaimed(true)
        setClaimMsg({ ok: false, text: 'Already claimed today. Come back tomorrow!' })
      } else {
        setHasClaimed(true)
        setClaimMsg({ ok: true, text: `+${result.amount ?? 5} 🪲 claimed! Streak: ${result.streak ?? 1} day(s)` })
        // Delay refresh slightly so DB write completes before re-fetch
        setTimeout(() => setRefreshTick(t => t + 1), 500)
      }
    } catch (err: any) {
      console.error("[Claim Error]", err);
      setClaimMsg({ ok: false, text: err.message || 'Verification failed. Try again.' })
    } finally { setClaiming(false) }
  }

  if (!ready || (authenticated && loading)) return (
    <div className="min-h-screen bg-[#030303] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
        <span className="text-[#818384] font-mono text-xs uppercase tracking-[0.3em]">Initialising Passport...</span>
      </div>
    </div>
  )

  if (!authenticated) return (
    <div className="min-h-screen bg-[#030303] flex flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="relative">
        <div className="absolute -inset-4 bg-blue-500/20 rounded-full blur-2xl animate-pulse" />
        <Shield size={64} className="text-[#3b82f6] relative z-10" />
      </div>
      <div className="space-y-3">
        <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Identity Required</h2>
        <p className="text-slate-500 font-mono text-sm max-w-sm mx-auto">Connect your wallet to access your soulbound Reputation Passport and Scarab economy.</p>
      </div>
      <button onClick={login}
        className="px-10 py-4 bg-[#3b82f6] hover:bg-blue-600 text-white font-black rounded-2xl transition-all shadow-[0_0_30px_rgba(59,130,246,0.2)] uppercase tracking-widest text-sm">
        Connect Securely
      </button>
    </div>
  )

  const trust = TRUST_CONFIG[data?.passport.trustLevel || 'new'] ?? TRUST_CONFIG.new
  const unreviewed = reviewable.filter(a => !a.reviewed)

  return (
    <div className="min-h-screen bg-[#030303] text-[#d7dadc] font-['JetBrains_Mono',monospace] selection:bg-blue-500/30 antialiased pb-20">
      <div className="max-w-2xl mx-auto px-6 py-12 flex flex-col gap-8">

        {/* ── Page Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-[#3b82f6]">
              <Shield size={20} />
            </div>
            <h1 className="text-xl font-black text-white tracking-tighter uppercase">Reputation Passport</h1>
          </div>
          <button onClick={logout} className="text-[10px] font-bold text-slate-600 hover:text-red-400 transition-colors uppercase tracking-widest border border-white/5 px-3 py-1.5 rounded-lg bg-white/[0.02]">
            Disconnect
          </button>
        </div>

        {/* ── PASSPORT CARD ── */}
        <div
          className="rounded-3xl p-8 border-2 relative overflow-hidden group shadow-2xl transition-all hover:scale-[1.01]"
          style={{ background: `linear-gradient(135deg, ${trust.bg}, #000)`, borderColor: `${trust.color}40` }}
        >
          {/* Rank Watermark */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 text-9xl font-black opacity-[0.03] pointer-events-none select-none italic pr-4">
            {trust.label}
          </div>

          <div className="flex items-start justify-between mb-8 relative z-10">
            <div>
              <p className="text-slate-500 text-[10px] font-bold mb-1 tracking-[0.3em] uppercase opacity-60">// Trust Identifier</p>
              <p className="text-xl font-black text-white tracking-tight">{fmt(walletAddress || '')}</p>
            </div>
            <div
              className="text-[10px] font-black px-4 py-1.5 rounded-full border shadow-lg"
              style={{ color: trust.color, borderColor: `${trust.color}60`, backgroundColor: `${trust.color}15` }}
            >
              {trust.label} GRADE
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8 relative z-10">
            <div className="bg-black/40 border border-white/5 rounded-2xl p-4 text-center">
              <p className="text-[9px] font-bold text-slate-500 mb-1 tracking-widest">REPUTATION</p>
              <p className="text-2xl font-black" style={{ color: trust.color }}>
                {data?.passport.reputationScore}
              </p>
            </div>
            <div className="bg-black/40 border border-white/5 rounded-2xl p-4 text-center">
              <p className="text-[9px] font-bold text-slate-500 mb-1 tracking-widest">REVIEWS</p>
              <p className="text-2xl font-black text-white">
                {data?.passport.totalReviews}
              </p>
            </div>
            <div className="bg-black/40 border border-white/5 rounded-2xl p-4 text-center">
              <p className="text-[9px] font-bold text-slate-500 mb-1 tracking-widest">SCARAB</p>
              <p className="text-2xl font-black text-[#3b82f6]">
                {data?.scarab.balance}
              </p>
            </div>
          </div>

          <div className="relative z-10">
            <div className="flex justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-60">Level Progression</span>
              <span className="text-[10px] font-black" style={{ color: trust.color }}>{data?.passport.reputationScore} / 100 PTS</span>
            </div>
            <RepBar score={data?.passport.reputationScore || 0} color={trust.color} />
          </div>
        </div>

        {/* ── Daily Claim Banner ── */}
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[50px] -mr-16 -mt-16 rounded-full" />
          <div className="relative z-10 text-center sm:text-left">
            <div className="font-black text-[#3b82f6] flex items-center gap-2 mb-1 justify-center sm:justify-start uppercase tracking-tighter text-lg">
              <Flame size={20} className="animate-pulse" /> Daily Scarab Harvest
            </div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              Streak: <span className="text-white">{data?.scarab.streak || 0} Days</span> · Bonus: up to <span className="text-white">+10 🪲</span>
            </p>
            {claimMsg && (
              <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className={`mt-3 text-[10px] font-black uppercase ${claimMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                {claimMsg.text}
              </motion.div>
            )}
          </div>
          <button 
            onClick={claimDaily} 
            disabled={claiming || hasClaimed}
            className={`shrink-0 px-10 py-4 font-black text-sm rounded-2xl transition-all uppercase tracking-[0.2em] relative z-10 ${hasClaimed ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 cursor-not-allowed' : 'bg-[#3b82f6] hover:bg-blue-600 disabled:opacity-50 text-white shadow-xl shadow-blue-500/20'}`}
          >
            {claiming ? 'Signing...' : hasClaimed ? 'Claimed ✓' : 'Collect 🪲'}
          </button>
        </div>

        {/* ── Reviewable Agents ── */}
        <div className="bg-[#0a0a0b] border border-white/[0.05] rounded-3xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Target size={16} className="text-[#3b82f6]" />
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Review Opportunities</h3>
            </div>
            {unreviewed.length > 0 && (
              <span className="text-[9px] bg-blue-500/10 text-[#3b82f6] border border-blue-500/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">
                {unreviewed.length} Target(s)
              </span>
            )}
          </div>

          {unreviewed.length === 0 ? (
            <div className="py-10 text-center space-y-4">
              <Target size={32} className="mx-auto text-slate-800 opacity-20" />
              <p className="text-[10px] text-slate-600 font-bold uppercase tracking-[0.2em]">No pending behavioral audits found.</p>
              <Link href="/monitor" className="text-[10px] text-[#3b82f6] hover:underline uppercase tracking-widest font-black">Scan Network →</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {unreviewed.slice(0, 10).map(agent => (
                <Link
                  key={agent.address}
                  href={`/agent/agent/${agent.address}`}
                  className="flex items-center gap-3 bg-white/[0.02] border border-white/5 rounded-2xl p-3 hover:border-blue-500/30 transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 p-1 bg-black/40">
                    <img 
                      src={agent.logo || `https://api.dicebear.com/7.x/bottts/svg?seed=${agent.address}&backgroundColor=transparent`} 
                      alt="A" 
                      className="w-full h-full object-cover rounded-lg group-hover:scale-110 transition-transform" 
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-bold text-[11px] truncate">{agent.name}</p>
                    <p className="text-slate-600 text-[9px] font-bold uppercase tracking-tighter">
                      Trust: <span className="text-[#3b82f6]">{(agent.score || 0) / 10}</span>
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <footer className="pt-12 text-center opacity-30">
          <div className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.5em] mb-2">Maiat Trust Protocol // Identity Layer</div>
          <div className="w-12 h-0.5 bg-blue-500/20 mx-auto rounded-full" />
        </footer>

      </div>
    </div>
  )
}
