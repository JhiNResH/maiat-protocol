'use client'

import { useState } from 'react'
import { Search, Shield, Star, Zap, Activity, ChevronRight, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

// ── Types ────────────────────────────────────────────────────────────────────

// Matches /api/v1/wallet/[address]/passport response
interface PassportApiResponse {
  address: string
  passport: {
    trustLevel: 'new' | 'trusted' | 'verified' | 'guardian'
    reputationScore: number
    totalReviews: number
    totalUpvotes: number
    feeTier: number
    feeDiscount: string
  }
  scarab: {
    balance: number
  }
  reviews: {
    recent: Array<{
      id: string
      rating: number
      comment: string
      address: string   // project address
      projectName?: string
      projectSlug?: string
      createdAt: string
    }>
    count: number
    averageRating: number
  }
}

// Matches /api/v1/wallet/[address]/interactions response
interface InteractionApiResponse {
  address: string
  interactedCount: number
  interacted: Array<{
    name: string | null
    address: string
    category: string | null
    txCount: number
    isKnown: boolean
    hasReviewed: boolean
    trustScore: number | null
  }>
}

// Normalized for display
interface Passport {
  address: string
  trustLevel: 'new' | 'trusted' | 'verified' | 'guardian'
  reputationScore: number
  scarabPoints: number
  totalReviews: number
  totalUpvotes: number
  feeTier: number
  feeDiscount: string
  reviewsGiven: PassportApiResponse['reviews']['recent']
}

interface Interaction {
  address: string
  name: string
  category: string
  trustScore: number | null
  txCount: number
  isKnown: boolean
  hasReviewed: boolean
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const LEVEL_CONFIG = {
  guardian: { label: 'GUARDIAN', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', icon: '🛡️' },
  verified: { label: 'VERIFIED', color: '#22C55E', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.3)',  icon: '✅' },
  trusted:  { label: 'TRUSTED',  color: '#0052FF', bg: 'rgba(0,82,255,0.1)',    border: 'rgba(0,82,255,0.3)',   icon: '🔵' },
  new:      { label: 'NEW',      color: '#666666', bg: 'rgba(102,102,102,0.1)', border: 'rgba(102,102,102,0.3)', icon: '⚪' },
}

function truncate(addr: string) {
  if (!addr || addr.length < 12) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ScanPage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [passport, setPassport] = useState<Passport | null>(null)
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [error, setError] = useState<string | null>(null)

  async function scan(addr: string) {
    const address = addr.trim()
    if (!address) return
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      setError('Invalid address — must be a valid 0x EVM address')
      return
    }

    setLoading(true)
    setError(null)
    setPassport(null)
    setInteractions([])

    try {
      const [passportRes, interactionsRes] = await Promise.all([
        fetch(`/api/v1/wallet/${address}/passport`),
        fetch(`/api/v1/wallet/${address}/interactions`),
      ])

      if (!passportRes.ok) throw new Error('Passport lookup failed')

      // Map nested API response → flat display type
      const raw: PassportApiResponse = await passportRes.json()
      setPassport({
        address: raw.address,
        trustLevel: raw.passport.trustLevel,
        reputationScore: raw.passport.reputationScore,
        scarabPoints: raw.scarab.balance,
        totalReviews: raw.reviews.count,
        totalUpvotes: raw.passport.totalUpvotes,
        feeTier: raw.passport.feeTier,
        feeDiscount: raw.passport.feeDiscount,
        reviewsGiven: raw.reviews.recent,
      })

      if (interactionsRes.ok) {
        const iRaw: InteractionApiResponse = await interactionsRes.json()
        setInteractions(
          iRaw.interacted.map(i => ({
            address: i.address,
            name: i.name ?? i.address.slice(0, 8) + '...',
            category: i.category ?? 'Unknown',
            trustScore: i.trustScore,
            txCount: i.txCount,
            isKnown: i.isKnown,
            hasReviewed: i.hasReviewed,
          }))
        )
      }
    } catch (e: any) {
      setError(e.message ?? 'Scan failed')
    } finally {
      setLoading(false)
    }
  }

  const cfg = passport ? LEVEL_CONFIG[passport.trustLevel] : null

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E5E5E5] font-mono">
      {/* Header */}
      <div className="border-b border-[#1F1F1F] px-6 py-4 flex items-center gap-3">
        <Link href="/explore" className="text-[#444] hover:text-[#888] transition-colors text-xs">
          ← EXPLORE
        </Link>
        <span className="text-[#333]">/</span>
        <span className="text-[#888] text-xs uppercase tracking-widest">// SCAN ADDRESS</span>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
            // Trust Passport Scanner
          </h1>
          <p className="text-xs text-[#555]">
            Enter any EVM wallet address to view its Trust Passport — reputation level, Scarab balance, and on-chain activity.
          </p>
        </div>

        {/* Search */}
        <div className="flex gap-2 mb-8">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && scan(query)}
              placeholder="0x..."
              className="w-full bg-[#111] border border-[#1F1F1F] rounded-lg pl-9 pr-4 py-3 text-sm text-[#E5E5E5] placeholder-[#333] focus:outline-none focus:border-[#0052FF]/50 transition-colors"
            />
          </div>
          <button
            onClick={() => scan(query)}
            disabled={loading}
            className="px-5 py-3 bg-[#0052FF] text-white text-xs font-bold rounded-lg hover:bg-[#0047DD] disabled:opacity-40 transition-colors"
          >
            {loading ? 'SCANNING...' : 'SCAN'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg text-[#EF4444] text-xs mb-6">
            <AlertTriangle size={13} />
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-16 text-[#444] text-xs">
            <div className="animate-pulse">// scanning on-chain data...</div>
          </div>
        )}

        {/* Passport Result */}
        {passport && cfg && (
          <div className="space-y-4">
            {/* Trust Level Card */}
            <div
              className="rounded-xl p-6 border"
              style={{ background: cfg.bg, borderColor: cfg.border }}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{cfg.icon}</span>
                    <span className="text-xl font-bold" style={{ color: cfg.color }}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="text-[#888] text-xs">{truncate(passport.address)}</div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-white">{passport.reputationScore}</div>
                  <div className="text-[#555] text-xs">REP SCORE</div>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-4 gap-3 pt-4 border-t" style={{ borderColor: cfg.border }}>
                {[
                  { label: 'SCARAB', value: `🪲 ${passport.scarabPoints.toLocaleString()}`, color: '#F59E0B' },
                  { label: 'REVIEWS', value: passport.totalReviews, color: '#22C55E' },
                  { label: 'UPVOTES', value: passport.totalUpvotes, color: '#0052FF' },
                  { label: 'FEE TIER', value: passport.feeDiscount.split('(')[0].trim(), color: cfg.color },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <div className="text-sm font-bold" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-[10px] text-[#444] mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Level Explanation */}
            <div className="px-4 py-3 bg-[#111] border border-[#1F1F1F] rounded-lg text-xs text-[#666]">
              {passport.trustLevel === 'guardian' && '// Guardian: 200+ rep score. Community champion. 0% platform fee, 3× review weight.'}
              {passport.trustLevel === 'verified' && '// Verified: 50+ rep score. Identity confirmed via Base Verify. 0.1% fee, 2× weight.'}
              {passport.trustLevel === 'trusted' && '// Trusted: 10+ rep score. Established contributor. 0.3% fee, 1× weight.'}
              {passport.trustLevel === 'new' && '// New: 0-9 rep score. Earn Scarab by writing quality reviews. Standard 0.5% fee.'}
            </div>

            {/* Reviews Given */}
            {passport.reviewsGiven && passport.reviewsGiven.length > 0 && (
              <div className="bg-[#111] border border-[#1F1F1F] rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-[#1F1F1F] flex items-center gap-2">
                  <Star size={12} className="text-[#F59E0B]" />
                  <span className="text-xs text-[#888] uppercase tracking-widest">
                    // Reviews Given ({passport.reviewsGiven.length})
                  </span>
                </div>
                {passport.reviewsGiven.slice(0, 5).map((r, i) => (
                  <Link
                    key={i}
                    href={`/agent/${r.projectSlug ?? r.address}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-[#161616] transition-colors border-b border-[#1A1A1A] last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white font-medium mb-0.5">
                        {r.projectName ?? truncate(r.address)}
                      </div>
                      <div className="text-[11px] text-[#555] truncate">{r.comment}</div>
                    </div>
                    <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, j) => (
                          <span key={j} className={`text-[10px] ${j < r.rating / 2 ? 'text-[#F59E0B]' : 'text-[#333]'}`}>★</span>
                        ))}
                      </div>
                      <span className="text-[10px] text-[#444]">{timeAgo(r.createdAt)}</span>
                      <ChevronRight size={12} className="text-[#333]" />
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* On-chain Interactions */}
            {interactions.length > 0 && (
              <div className="bg-[#111] border border-[#1F1F1F] rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-[#1F1F1F] flex items-center gap-2">
                  <Activity size={12} className="text-[#0052FF]" />
                  <span className="text-xs text-[#888] uppercase tracking-widest">
                    // On-chain Interactions ({interactions.length})
                  </span>
                </div>
                {interactions.slice(0, 8).map((item, i) => (
                  <Link
                    key={i}
                    href={`/agent/${item.address}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-[#161616] transition-colors border-b border-[#1A1A1A] last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold"
                        style={{
                          background: item.isKnown ? 'rgba(0,82,255,0.15)' : 'rgba(102,102,102,0.15)',
                          color: item.isKnown ? '#0052FF' : '#666',
                        }}
                      >
                        {item.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs text-white flex items-center gap-1.5">
                          {item.name}
                          {item.hasReviewed && <span className="text-[9px] text-[#22C55E]">✓ reviewed</span>}
                        </div>
                        <div className="text-[10px] text-[#444]">{item.txCount} txs · {item.category}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      {item.trustScore !== null && (
                        <div>
                          <div className="text-xs font-bold" style={{
                            color: (item.trustScore ?? 0) >= 70 ? '#22C55E' : (item.trustScore ?? 0) >= 50 ? '#F59E0B' : '#EF4444'
                          }}>
                            {((item.trustScore ?? 0) / 10).toFixed(1)}
                          </div>
                          <div className="text-[10px] text-[#444]">TRUST</div>
                        </div>
                      )}
                      <ChevronRight size={12} className="text-[#333]" />
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* No interactions */}
            {!loading && interactions.length === 0 && (
              <div className="text-center py-8 text-[#444] text-xs border border-[#1F1F1F] rounded-xl">
                // No indexed interactions found on Base
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!passport && !loading && !error && (
          <div className="text-center py-20 text-[#333]">
            <Shield size={40} className="mx-auto mb-4 opacity-20" />
            <div className="text-xs uppercase tracking-widest">// Enter a wallet address to scan</div>
          </div>
        )}
      </div>
    </div>
  )
}
