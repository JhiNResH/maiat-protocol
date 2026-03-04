'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Shield, Flame, Trophy, ArrowRight, Star, Clock,
  MessageSquare, Zap, CheckCircle, ExternalLink
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ScarabState {
  balance: number
  totalEarned: number
  streak: number
}

interface Project {
  id: string
  slug: string
  name: string
  symbol?: string
  chain: string
  category: string
  trustScore: number
  avgRating: number
  reviewCount: number
  address: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function chainColor(chain: string) {
  const c = chain?.toLowerCase()
  if (c === 'base') return '#3b82f6'
  if (c === 'ethereum' || c === 'eth') return '#627EEA'
  if (c === 'bnb') return '#F3BA2F'
  return '#818384'
}

function scoreColor(s: number) {
  const n = s > 10 ? s / 10 : s
  if (n >= 7) return '#3b82f6'
  if (n >= 4) return '#06b6d4'
  return '#64748b'
}

function truncate(addr: string) {
  if (!addr || addr.length < 12) return addr
  return addr.slice(0, 6) + '...' + addr.slice(-4)
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon, gold }: {
  label: string; value: string | number; sub?: string; icon: React.ReactNode; gold?: boolean
}) {
  return (
    <div className="bg-[#1a1a1b] border border-[#343536] rounded-xl p-5 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${gold ? 'bg-[#d4a017]/15 text-[#d4a017]' : 'bg-[#272729] text-[#818384]'}`}>
        {icon}
      </div>
      <div>
        <div className={`text-xl font-black ${gold ? 'text-[#d4a017]' : 'text-[#d7dadc]'}`}>{value}</div>
        <div className="text-xs text-[#818384] font-mono uppercase tracking-wider">{label}</div>
        {sub && <div className="text-[10px] text-[#4a4a4e] mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function DashboardView() {
  const { ready, authenticated, user, login } = usePrivy()
  const walletAddress = user?.wallet?.address

  const [scarab, setScarab] = useState<ScarabState | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [claiming, setClaiming] = useState(false)
  const [claimMsg, setClaimMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'agents' | 'defi'>('agents')

  // Load scarab balance
  useEffect(() => {
    if (!walletAddress) return
    fetch(`/api/v1/scarab?address=${walletAddress}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setScarab(d))
  }, [walletAddress, claimMsg])

  // Load projects
  useEffect(() => {
    fetch('/api/v1/explore')
      .then(r => r.ok ? r.json() : null)
      .then(d => d?.projects && setProjects(d.projects))
  }, [])

  async function claimDaily() {
    if (!walletAddress || claiming) return
    setClaiming(true)
    setClaimMsg(null)
    try {
      const res = await fetch('/api/v1/scarab/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: walletAddress }),
      })
      const data = await res.json()
      if (data.alreadyClaimed) {
        setClaimMsg({ ok: false, text: 'Already claimed today. Come back tomorrow!' })
      } else {
        setClaimMsg({ ok: true, text: `+${data.amount ?? 5} 🪲 claimed! Streak: ${data.streak ?? 1} day${(data.streak ?? 1) > 1 ? 's' : ''}` })
      }
    } catch {
      setClaimMsg({ ok: false, text: 'Claim failed. Try again.' })
    } finally { setClaiming(false) }
  }

  // Not connected
  if (!ready) return (
    <div className="min-h-screen bg-[#030303] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#d4a017] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!authenticated) return (
    <div className="min-h-screen bg-[#030303] flex flex-col items-center justify-center gap-6 px-4">
      <div className="text-5xl">🪲</div>
      <div className="text-center">
        <h2 className="text-2xl font-black text-[#d7dadc] mb-2">Reputation Passport</h2>
        <p className="text-[#818384] text-sm max-w-sm">Connect your wallet to view your Scarab balance, review history, and trust activity.</p>
      </div>
      <button onClick={login}
        className="px-8 py-3 bg-[#d4a017] hover:bg-[#c49010] text-black font-bold rounded-xl transition-colors">
        Connect Wallet
      </button>
    </div>
  )

  const agents = projects.filter(p => p.category === 'Agent' || p.category === 'm/ai-agents')
  const defi = projects.filter(p => p.category !== 'Agent' && p.category !== 'm/ai-agents')
  const displayProjects = activeTab === 'agents' ? agents : defi

  return (
    <div className="min-h-screen bg-[#030303] text-[#d7dadc]">
      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#d4a017]" />
              Reputation Passport
            </h1>
            <p className="text-xs text-[#818384] font-mono mt-1">{truncate(walletAddress ?? '')}</p>
          </div>
          <Link href="/explore"
            className="flex items-center gap-1.5 text-xs text-[#818384] hover:text-[#d4a017] font-mono uppercase tracking-widest transition-colors">
            Explorer <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Scarab Balance" value={`🪲 ${scarab?.balance ?? 0}`} icon={<Flame className="w-5 h-5" />} gold />
          <StatCard label="Total Earned" value={`🪲 ${scarab?.totalEarned ?? 0}`} icon={<Trophy className="w-5 h-5" />} />
          <StatCard label="Daily Streak" value={`${scarab?.streak ?? 0}d`} sub="Consecutive days" icon={<Zap className="w-5 h-5" />} />
          <StatCard label="Reviews" value={0} sub="Coming soon" icon={<MessageSquare className="w-5 h-5" />} />
        </div>

        {/* Daily Claim */}
        <div className="bg-[#d4a017]/8 border border-[#d4a017]/25 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="font-bold text-[#d4a017] flex items-center gap-2 mb-1">
              <span className="text-lg">🪲</span> Daily Scarab Claim
            </div>
            <div className="text-xs text-[#818384]">
              Claim <strong className="text-[#d7dadc]">+5 🪲</strong> every day · Streak bonus: up to <strong className="text-[#d7dadc]">+10 🪲</strong> extra · Reviews earn up to <strong className="text-[#d7dadc]">+10 🪲</strong>
            </div>
            {claimMsg && (
              <div className={`mt-2 text-xs font-mono ${claimMsg.ok ? 'text-blue-400' : 'text-[#818384]'}`}>
                {claimMsg.text}
              </div>
            )}
          </div>
          <button onClick={claimDaily} disabled={claiming}
            className="shrink-0 px-6 py-2.5 bg-[#d4a017] hover:bg-[#c49010] disabled:opacity-50 text-black font-bold text-sm rounded-xl transition-colors font-mono uppercase tracking-wide whitespace-nowrap">
            {claiming ? 'Claiming...' : 'Claim Daily 🪲'}
          </button>
        </div>

        {/* Scarab Economy Guide */}
        <div className="bg-[#1a1a1b] border border-[#343536] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-base">🪲</span>
            <span className="text-xs font-bold font-mono uppercase tracking-widest text-[#adadb0]">Scarab Economy</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Initial Claim', val: '+20 🪲', note: 'One-time', color: 'text-blue-400' },
              { label: 'Daily Claim', val: '+5 🪲', note: 'Up to +10 streak', color: 'text-blue-400' },
              { label: 'Write Review', val: '−2 🪲', note: 'Spend to review', color: 'text-slate-400' },
              { label: 'Quality Review', val: '+10 🪲', note: 'AI-scored reward', color: 'text-[#d4a017]' },
            ].map(({ label, val, note, color }) => (
              <div key={label} className="bg-[#111113] rounded-lg p-3 text-center">
                <div className={`text-lg font-black ${color}`}>{val}</div>
                <div className="text-[10px] text-[#818384] font-mono uppercase tracking-wider mt-1">{label}</div>
                <div className="text-[10px] text-[#4a4a4e] mt-0.5">{note}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Projects to Review */}
        <div className="bg-[#1a1a1b] border border-[#343536] rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#d4a017]" />
              <span className="text-xs font-bold font-mono uppercase tracking-widest text-[#adadb0]">Projects to Review</span>
            </div>
            <div className="flex gap-1">
              {(['agents', 'defi'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1 rounded text-[10px] font-bold font-mono uppercase transition-all ${activeTab === tab ? 'bg-[#d4a017] text-black' : 'text-[#818384] hover:text-[#d7dadc]'}`}>
                  {tab === 'agents' ? `AI Agents (${agents.length})` : `DeFi (${defi.length})`}
                </button>
              ))}
            </div>
          </div>

          {displayProjects.length === 0 ? (
            <div className="text-center py-8 text-[#4a4a4e] text-sm font-mono">Loading projects...</div>
          ) : (
            <div className="flex flex-col gap-2">
              {displayProjects.map(p => {
                const score = p.trustScore > 10 ? p.trustScore / 10 : p.trustScore
                return (
                  <div key={p.id} className="bg-[#111113] border border-[#2a2a2e] rounded-lg px-4 py-3 flex items-center justify-between gap-4 hover:border-[#343536] transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black text-white shrink-0"
                        style={{ backgroundColor: chainColor(p.chain) }}>
                        {p.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm truncate">{p.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-mono" style={{ color: chainColor(p.chain) }}>{p.chain}</span>
                          {p.reviewCount === 0 && (
                            <span className="text-[10px] bg-[#d4a017]/10 text-[#d4a017] border border-[#d4a017]/20 px-1.5 rounded font-mono">Be first!</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right hidden sm:block">
                        <div className="text-sm font-black" style={{ color: scoreColor(score) }}>{score.toFixed(1)}</div>
                        <div className="text-[10px] text-[#818384] font-mono">{p.reviewCount} reviews</div>
                      </div>
                      <Link href={`/m/${p.category?.includes('agent') || p.category === 'm/ai-agents' ? 'agents' : 'defi'}/${p.slug || p.id}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#d4a017]/10 hover:bg-[#d4a017]/20 border border-[#d4a017]/20 text-[#d4a017] rounded-lg text-xs font-bold font-mono uppercase transition-all">
                        <MessageSquare className="w-3 h-3" />
                        Review
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
