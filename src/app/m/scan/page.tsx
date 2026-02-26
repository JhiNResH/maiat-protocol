'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Search, Shield, Star, Zap, Trophy, Clock, ExternalLink, Copy, ChevronRight } from 'lucide-react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrustPassport {
  address: string
  trustLevel: 'new' | 'trusted' | 'verified' | 'guardian'
  reputationScore: number
  scarabPoints: number
  totalReviews: number
  totalUpvotes: number
  feeTier: number
  feeDiscount: string
}

interface Review {
  id: string
  rating: number
  content: string
  weight: number
  createdAt: string
  project: {
    id: string
    name: string
    slug: string
    category: string
    chain: string
    trustScore: number
  } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LEVEL_CONFIG = {
  new:      { label: 'NEW',      color: '#666666', bg: 'rgba(102,102,102,0.15)', desc: 'Just getting started' },
  trusted:  { label: 'TRUSTED',  color: '#0052FF', bg: 'rgba(0,82,255,0.15)',   desc: 'Active community member' },
  verified: { label: 'VERIFIED', color: '#22C55E', bg: 'rgba(34,197,94,0.15)', desc: 'Base-verified identity' },
  guardian: { label: 'GUARDIAN', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', desc: 'Trusted community champion' },
}

function truncateAddress(addr: string) {
  if (!addr || addr.length < 12) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function isValidAddress(addr: string) {
  return /^0x[0-9a-fA-F]{40}$/.test(addr)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PassportCard({ passport }: { passport: TrustPassport }) {
  const lvl = LEVEL_CONFIG[passport.trustLevel]
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(passport.address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="border border-[#1F1F1F] rounded-xl bg-[#111111] overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#1F1F1F] bg-[#0D0D0D]">
        <span className="font-mono text-xs text-[#666666] tracking-widest uppercase">// TRUST PASSPORT</span>
        <span className="font-mono text-xs" style={{ color: lvl.color, background: lvl.bg, padding: '2px 8px', borderRadius: 4 }}>
          {lvl.label}
        </span>
      </div>

      <div className="p-5">
        {/* Address */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold font-mono"
            style={{ background: lvl.bg, color: lvl.color }}
          >
            {passport.address.slice(2, 4).toUpperCase()}
          </div>
          <div>
            <div className="font-mono text-sm text-[#E5E5E5] flex items-center gap-2">
              {truncateAddress(passport.address)}
              <button onClick={copy} className="text-[#666666] hover:text-[#E5E5E5] transition-colors">
                {copied ? '✓' : <Copy size={12} />}
              </button>
              <a
                href={`https://basescan.org/address/${passport.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#666666] hover:text-[#0052FF] transition-colors"
              >
                <ExternalLink size={12} />
              </a>
            </div>
            <div className="text-xs text-[#666666] mt-0.5">{lvl.desc}</div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <StatBox icon={<Zap size={14} />} label="SCARAB" value={passport.scarabPoints.toLocaleString()} color="#F59E0B" />
          <StatBox icon={<Trophy size={14} />} label="REP SCORE" value={passport.reputationScore.toString()} color="#0052FF" />
          <StatBox icon={<Star size={14} />} label="REVIEWS GIVEN" value={passport.totalReviews.toString()} color="#22C55E" />
          <StatBox icon={<Shield size={14} />} label="UPVOTES EARNED" value={passport.totalUpvotes.toString()} color="#7C3AED" />
        </div>

        {/* Fee tier */}
        <div className="flex items-center justify-between bg-[#0D0D0D] rounded-lg px-4 py-3 border border-[#1F1F1F]">
          <span className="font-mono text-xs text-[#666666]">PROTOCOL FEE TIER</span>
          <span className="font-mono text-xs" style={{ color: lvl.color }}>{passport.feeDiscount}</span>
        </div>
      </div>
    </div>
  )
}

function StatBox({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-lg px-4 py-3">
      <div className="flex items-center gap-1.5 mb-1" style={{ color }}>
        {icon}
        <span className="font-mono text-[10px] text-[#666666] tracking-widest">{label}</span>
      </div>
      <div className="font-mono text-xl font-bold text-[#E5E5E5]">{value}</div>
    </div>
  )
}

function ReviewRow({ review }: { review: Review }) {
  const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating)
  const timeAgo = (() => {
    const diff = Date.now() - new Date(review.createdAt).getTime()
    const d = Math.floor(diff / 86400000)
    if (d > 0) return `${d}d ago`
    const h = Math.floor(diff / 3600000)
    if (h > 0) return `${h}h ago`
    return 'just now'
  })()

  const href = review.project
    ? (review.project.category === 'DeFi'
        ? `/defi/${review.project.slug}/${review.project.id}`
        : `/agent/${review.project.slug}`)
    : '#'

  return (
    <Link href={href} className="flex items-start gap-4 px-4 py-3 bg-[#111111] border border-[#1F1F1F] rounded-lg hover:border-[#0052FF]/50 transition-colors group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-xs text-[#E5E5E5] truncate">{review.project?.name ?? 'Unknown'}</span>
          <span className="font-mono text-[10px] text-[#666666] shrink-0">{review.project?.chain}</span>
          {review.weight > 1 && (
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,82,255,0.15)', color: '#0052FF' }}>
              {review.weight}x
            </span>
          )}
        </div>
        <div className="font-mono text-[10px] text-[#F59E0B] mb-1">{stars}</div>
        {review.content && (
          <div className="text-xs text-[#666666] truncate">"{review.content}"</div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="font-mono text-[10px] text-[#666666]">{timeAgo}</span>
        <ChevronRight size={12} className="text-[#333333] group-hover:text-[#0052FF] transition-colors" />
      </div>
    </Link>
  )
}

// ─── Main scan component ──────────────────────────────────────────────────────

function ScanContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [input, setInput] = useState(searchParams.get('address') ?? '')
  const [loading, setLoading] = useState(false)
  const [passport, setPassport] = useState<TrustPassport | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [error, setError] = useState('')

  const handleScan = async (addr: string = input.trim()) => {
    if (!addr) return
    if (!isValidAddress(addr)) {
      setError('Invalid Ethereum address')
      return
    }
    setError('')
    setLoading(true)
    setPassport(null)
    setReviews([])

    try {
      // Parallel fetch
      const [repRes, reviewRes] = await Promise.all([
        fetch(`/api/reputation?address=${addr}`),
        fetch(`/api/v1/project?reviewer=${addr}&limit=20`).catch(() => null),
      ])

      if (!repRes.ok) throw new Error('Address not found')
      const rep = await repRes.json()
      setPassport(rep)
      router.replace(`/m/scan?address=${addr}`, { scroll: false })

      // Reviews are best-effort
      if (reviewRes?.ok) {
        const rv = await reviewRes.json()
        setReviews(rv.reviews ?? [])
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load passport')
    } finally {
      setLoading(false)
    }
  }

  // Auto-scan if address in URL
  useEffect(() => {
    const addr = searchParams.get('address')
    if (addr && isValidAddress(addr)) {
      setInput(addr)
      handleScan(addr)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex-1 p-6 max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-mono text-xs text-[#666666] tracking-widest uppercase mb-1">// SCAN ADDRESS</h1>
        <p className="font-mono text-lg text-[#E5E5E5]">Trust Passport Viewer</p>
        <p className="text-xs text-[#666666] mt-1">Enter any wallet address to view their Trust Passport on Base</p>
      </div>

      {/* Search input */}
      <div className="flex gap-2 mb-6">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666666]" />
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleScan()}
            placeholder="0x... wallet address"
            className="w-full bg-[#111111] border border-[#1F1F1F] rounded-lg pl-9 pr-4 py-3 font-mono text-sm text-[#E5E5E5] placeholder-[#333333] focus:outline-none focus:border-[#0052FF]/50 focus:shadow-[0_0_0_1px_rgba(0,82,255,0.3)] transition-all"
          />
        </div>
        <button
          onClick={() => handleScan()}
          disabled={loading}
          className="px-5 py-3 bg-[#0052FF] hover:bg-[#0040CC] disabled:opacity-50 text-white font-mono text-sm rounded-lg transition-colors"
        >
          {loading ? '...' : 'SCAN'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg font-mono text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <div className="font-mono text-xs text-[#666666] animate-pulse">// SCANNING CHAIN...</div>
        </div>
      )}

      {/* Passport */}
      {passport && !loading && (
        <div className="space-y-4">
          <PassportCard passport={passport} />

          {/* Reviews section */}
          <div className="border border-[#1F1F1F] rounded-xl bg-[#111111] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#1F1F1F] bg-[#0D0D0D]">
              <span className="font-mono text-xs text-[#666666] tracking-widest uppercase">// REVIEWS GIVEN</span>
              <span className="font-mono text-xs text-[#0052FF]">{passport.totalReviews} total</span>
            </div>
            <div className="p-3 space-y-2">
              {reviews.length > 0 ? (
                reviews.map(r => <ReviewRow key={r.id} review={r} />)
              ) : (
                <div className="text-center py-6 font-mono text-xs text-[#333333]">
                  // no reviews indexed yet
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!passport && !loading && !error && (
        <div className="text-center py-16">
          <Shield size={32} className="text-[#1F1F1F] mx-auto mb-4" />
          <div className="font-mono text-xs text-[#333333]">// ENTER AN ADDRESS TO VIEW TRUST PASSPORT</div>
        </div>
      )}
    </div>
  )
}

export default function ScanPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center">
        <div className="font-mono text-xs text-[#666666] animate-pulse">// LOADING...</div>
      </div>
    }>
      <ScanContent />
    </Suspense>
  )
}
