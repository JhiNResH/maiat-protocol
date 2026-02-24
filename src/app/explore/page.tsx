'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { Header } from '@/components/Header'
import { Search, TrendingUp, Clock, HelpCircle, Star, Send, X, ArrowRight, MessageSquare, SlidersHorizontal } from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================

interface ExploreItem {
  id: string
  address: string
  name: string
  category: string
  chain: string
  trustScore: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  txCount: number
  reviewCount: number
  ageLabel: string
  starRating: number
  latestReview: string
  iconLetter: string
  iconColor: string
}

interface ReviewFormData {
  rating: number
  comment: string
  tags: string[]
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'defi', label: 'DeFi' },
  { id: 'tokens', label: 'Tokens' },
  { id: 'agents', label: 'Agents' },
  { id: 'protocols', label: 'Protocols' },
]

const SORT_OPTIONS = [
  { id: 'score_desc', label: 'Score High→Low' },
  { id: 'most_reviewed', label: 'Most Reviewed' },
  { id: 'trending', label: 'Trending' },
]

const REVIEW_TAGS = ['Trustworthy', 'Suspicious', 'Rug Risk', 'Well Audited', 'Innovative', 'High Yield', 'Established']

// ============================================================================
// SEED DATA (will be replaced by API calls)
// ============================================================================

const SEED_ITEMS: ExploreItem[] = [
  { id: '1', address: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24', name: 'Uniswap V3 Router', category: 'DEX', chain: 'Base', trustScore: 8.5, riskLevel: 'LOW', txCount: 245891, reviewCount: 47, ageLabel: '4y', starRating: 4.7, latestReview: 'Battle-tested protocol with consistent performance.', iconLetter: 'U', iconColor: '#FF007A' },
  { id: '2', address: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5', name: 'Aave V3 Pool', category: 'Lending', chain: 'Base', trustScore: 9.2, riskLevel: 'LOW', txCount: 189432, reviewCount: 38, ageLabel: '3y', starRating: 4.5, latestReview: 'Solid lending protocol, governance is strong.', iconLetter: 'A', iconColor: '#B6509E' },
  { id: '3', address: '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43', name: 'Aerodrome Router', category: 'DEX', chain: 'Base', trustScore: 7.8, riskLevel: 'LOW', txCount: 312847, reviewCount: 29, ageLabel: '2y', starRating: 4.2, latestReview: 'Best DEX on Base, great liquidity.', iconLetter: 'Ae', iconColor: '#0052FF' },
  { id: '4', address: '0x45f1A95A4D3f3836523F5c83673c797f4d4d263B', name: 'Stargate Router', category: 'Bridge', chain: 'Base', trustScore: 7.9, riskLevel: 'LOW', txCount: 98234, reviewCount: 15, ageLabel: '2y', starRating: 3.8, latestReview: 'Works well for cross-chain, decent fees.', iconLetter: 'S', iconColor: '#6366F1' },
  { id: '5', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', name: 'USDC', category: 'Stablecoin', chain: 'Base', trustScore: 9.2, riskLevel: 'LOW', txCount: 1567890, reviewCount: 42, ageLabel: '5y', starRating: 4.6, latestReview: 'Gold standard stablecoin, fully backed.', iconLetter: 'U', iconColor: '#2775CA' },
  { id: '6', address: '0xb125E6687d4313864e53df431d5425969c15Eb2F', name: 'Compound V3', category: 'Lending', chain: 'Base', trustScore: 8.8, riskLevel: 'LOW', txCount: 134567, reviewCount: 31, ageLabel: '4y', starRating: 4.3, latestReview: 'Reliable but UI could use improvement.', iconLetter: 'C', iconColor: '#00D395' },
  { id: '7', address: '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb', name: 'Morpho Blue', category: 'Lending', chain: 'Base', trustScore: 8.2, riskLevel: 'LOW', txCount: 87654, reviewCount: 12, ageLabel: '1y', starRating: 4.1, latestReview: 'Innovative lending design, growing fast.', iconLetter: 'M', iconColor: '#1A1B23' },
  { id: '8', address: '0x4200000000000000000000000000000000000006', name: 'WETH', category: 'Token', chain: 'Base', trustScore: 9.2, riskLevel: 'LOW', txCount: 2345678, reviewCount: 55, ageLabel: '5y+', starRating: 4.8, latestReview: 'Canonical wrapped ETH, no concerns.', iconLetter: 'W', iconColor: '#627EEA' },
  // Agents
  { id: '9', address: '0x44ff8620b8cA30902395A7bD3F2407e1A091BF73', name: 'Virtuals Protocol', category: 'Agent', chain: 'Base', trustScore: 7.2, riskLevel: 'LOW', txCount: 156000, reviewCount: 18, ageLabel: '1y', starRating: 3.9, latestReview: 'Leading agent token launchpad on Base.', iconLetter: 'V', iconColor: '#7C3AED' },
  { id: '10', address: '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b', name: 'AIXBT Agent', category: 'Agent', chain: 'Base', trustScore: 5.8, riskLevel: 'MEDIUM', txCount: 45000, reviewCount: 7, ageLabel: '6mo', starRating: 3.4, latestReview: 'Popular CT agent, volatile token price.', iconLetter: 'AI', iconColor: '#F97316' },
  { id: '11', address: '0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452', name: 'Luna by Virtuals', category: 'Agent', chain: 'Base', trustScore: 4.9, riskLevel: 'MEDIUM', txCount: 23000, reviewCount: 5, ageLabel: '4mo', starRating: 3.0, latestReview: 'TikTok famous agent, unclear utility.', iconLetter: 'L', iconColor: '#EC4899' },
  { id: '12', address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', name: 'DAI', category: 'Stablecoin', chain: 'Base', trustScore: 8.9, riskLevel: 'LOW', txCount: 890000, reviewCount: 35, ageLabel: '5y+', starRating: 4.5, latestReview: 'Decentralized stablecoin pioneer.', iconLetter: 'D', iconColor: '#F5AC37' },
  // Protocols
  { id: '13', address: '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70', name: 'Chainlink ETH/USD', category: 'Oracle', chain: 'Base', trustScore: 9.1, riskLevel: 'LOW', txCount: 1200000, reviewCount: 28, ageLabel: '4y', starRating: 4.7, latestReview: 'The oracle standard, extremely reliable.', iconLetter: 'C', iconColor: '#375BD2' },
  { id: '14', address: '0x4200000000000000000000000000000000000010', name: 'Base Bridge', category: 'Bridge', chain: 'Base', trustScore: 8.7, riskLevel: 'LOW', txCount: 3400000, reviewCount: 22, ageLabel: '2y', starRating: 4.3, latestReview: 'Official L2 bridge, trust Coinbase infra.', iconLetter: 'B', iconColor: '#0052FF' },
]

const TOP_MOVERS = [
  { name: 'Aerodrome', address: '0xcF77...E43', change: 45, direction: 'up' as const },
  { name: 'Morpho Blue', address: '0xBBBB...FCb', change: 32, direction: 'up' as const },
  { name: 'Unknown Token', address: '0xdd3...5b8f', change: -28, direction: 'down' as const },
]

const RECENT_REVIEWS = [
  { reviewer: '0xab1...3f2c', target: 'Uniswap V3', rating: 5, snippet: 'Still the gold standard for DEXs.', hoursAgo: 1 },
  { reviewer: '0x7f2...a1b4', target: 'Stargate', rating: 3, snippet: 'Bridging took longer than expected.', hoursAgo: 2 },
  { reviewer: '0x3e9...c8d1', target: 'Aave V3', rating: 5, snippet: 'Governance proposals are solid.', hoursAgo: 3 },
]

const NEEDS_REVIEW = [
  { name: 'Base Bridge', address: '0x4200000000000000000000000000000000000010', score: 8.7 },
  { name: 'DAI', address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', score: 8.9 },
  { name: 'Chainlink Feed', address: '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70', score: 9.1 },
]

// ============================================================================
// HELPERS
// ============================================================================

function scoreColor(score: number) {
  if (score >= 7.0) return 'text-green-400'
  if (score >= 4.0) return 'text-yellow-400'
  return 'text-red-400'
}

function scoreBg(score: number) {
  if (score >= 7.0) return 'bg-green-500/15 border-green-500/30'
  if (score >= 4.0) return 'bg-yellow-500/15 border-yellow-500/30'
  return 'bg-red-500/15 border-red-500/30'
}

function riskBadge(level: string) {
  switch (level) {
    case 'LOW': return 'bg-green-500/15 text-green-400'
    case 'MEDIUM': return 'bg-yellow-500/15 text-yellow-400'
    case 'HIGH': return 'bg-orange-500/15 text-orange-400'
    case 'CRITICAL': return 'bg-red-500/15 text-red-400'
    default: return 'bg-zinc-500/15 text-zinc-400'
  }
}

function formatNum(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`
  return n.toString()
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={`text-xs ${i <= Math.round(rating) ? 'text-gold' : 'text-zinc-600'}`}>★</span>
      ))}
    </span>
  )
}

// ============================================================================
// MAIN
// ============================================================================

export default function ExplorePage() {
  const [category, setCategory] = useState('all')
  const [sortBy, setSortBy] = useState('score_desc')
  const [search, setSearch] = useState('')
  const [showSort, setShowSort] = useState(false)

  // Live items (starts from seed, updated by API)
  const [items, setItems] = useState<ExploreItem[]>(SEED_ITEMS)

  // Fetch live scores + review counts in background
  useEffect(() => {
    let cancelled = false

    async function fetchLiveData() {
      const updated = await Promise.all(
        SEED_ITEMS.map(async (item) => {
          try {
            const [scoreRes, reviewRes] = await Promise.all([
              fetch(`/api/v1/score/${item.address}`),
              fetch(`/api/v1/review?address=${item.address}`),
            ])
            const scoreData = scoreRes.ok ? await scoreRes.json() : null
            const reviewData = reviewRes.ok ? await reviewRes.json() : null

            return {
              ...item,
              trustScore: scoreData?.score ?? item.trustScore,
              riskLevel: (scoreData?.riskLevel ?? item.riskLevel) as ExploreItem['riskLevel'],
              txCount: scoreData?.txCount ?? item.txCount,
              reviewCount: reviewData?.count ?? item.reviewCount,
              starRating: reviewData?.averageRating ?? item.starRating,
            }
          } catch {
            return item // keep seed data on error
          }
        })
      )
      if (!cancelled) setItems(updated)
    }

    fetchLiveData()
    return () => { cancelled = true }
  }, [])

  // Review modal
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewTarget, setReviewTarget] = useState<ExploreItem | null>(null)
  const [reviewForm, setReviewForm] = useState<ReviewFormData>({ rating: 0, comment: '', tags: [] })
  const [submitting, setSubmitting] = useState(false)

  const filtered = useMemo(() => {
    let result = [...items]

    if (category !== 'all') {
      const map: Record<string, string[]> = {
        defi: ['DEX', 'Lending', 'DeFi'],
        tokens: ['Token', 'Stablecoin'],
        agents: ['Agent'],
        protocols: ['Oracle', 'Bridge', 'Infrastructure'],
      }
      const allowed = map[category] || []
      result = result.filter(item => allowed.includes(item.category))
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(item =>
        item.name.toLowerCase().includes(q) || item.address.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)
      )
    }

    switch (sortBy) {
      case 'score_desc': result.sort((a, b) => b.trustScore - a.trustScore); break
      case 'most_reviewed': result.sort((a, b) => b.reviewCount - a.reviewCount); break
      case 'trending': result.sort((a, b) => b.txCount - a.txCount); break
    }

    return result
  }, [category, search, sortBy])

  function openReview(item: ExploreItem) {
    setReviewTarget(item)
    setReviewForm({ rating: 0, comment: '', tags: [] })
    setReviewOpen(true)
  }

  async function submitReview() {
    if (!reviewTarget || reviewForm.rating === 0) return
    setSubmitting(true)
    try {
      await fetch('/api/v1/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: reviewTarget.address, rating: reviewForm.rating, comment: reviewForm.comment, tags: reviewForm.tags }),
      })
      setReviewOpen(false)
    } catch { /* ignore for now */ }
    setSubmitting(false)
  }

  return (
    <div className="min-h-screen bg-bg-primary text-txt-primary">
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Explore</h1>
          <p className="text-sm text-txt-muted mt-1">Browse scored protocols, tokens, and addresses on Base</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex gap-2 overflow-x-auto">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`px-4 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                  category === cat.id
                    ? 'bg-gold text-bg-primary font-semibold'
                    : 'border border-border-subtle text-txt-secondary hover:border-gold/40'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-muted" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
                className="pl-9 pr-4 py-2 bg-bg-card border border-border-subtle rounded-lg text-sm text-txt-primary placeholder-txt-muted outline-none focus:border-gold/40 w-[200px]"
                spellCheck={false}
              />
            </div>

            <div className="relative">
              <button
                onClick={() => setShowSort(!showSort)}
                className="flex items-center gap-1.5 px-3 py-2 border border-border-subtle rounded-lg text-xs font-medium text-txt-secondary hover:border-gold/40"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-gold" />
                Sort
              </button>
              {showSort && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowSort(false)} />
                  <div className="absolute right-0 top-11 z-40 w-44 bg-bg-card border border-border-subtle rounded-xl shadow-xl overflow-hidden">
                    {SORT_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => { setSortBy(opt.id); setShowSort(false) }}
                        className={`w-full px-4 py-2.5 text-left text-xs transition-colors ${
                          sortBy === opt.id ? 'bg-gold/10 text-gold font-semibold' : 'text-txt-secondary hover:bg-bg-primary'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Card Grid */}
          <div className="flex-1 space-y-3">
            <p className="text-[10px] font-bold tracking-widest text-txt-muted uppercase mb-2">
              {filtered.length} Protocols
            </p>

            {filtered.map(item => (
              <div key={item.id} className="bg-bg-card border border-border-subtle rounded-xl p-4 hover:border-gold/30 transition-colors">
                {/* Top Row */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ backgroundColor: item.iconColor }}>
                    {item.iconLetter}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{item.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="px-2 py-0.5 rounded-md bg-gold/10 text-gold text-[9px] font-bold uppercase tracking-wider">{item.category}</span>
                      <span className="px-2 py-0.5 rounded-md bg-bg-primary text-txt-muted text-[9px] font-bold uppercase tracking-wider">{item.chain}</span>
                    </div>
                  </div>
                  <div className={`shrink-0 px-2.5 py-1.5 rounded-xl border ${scoreBg(item.trustScore)} text-center`}>
                    <p className={`text-lg font-bold leading-none ${scoreColor(item.trustScore)}`}>{item.trustScore}</p>
                    <p className="text-[8px] text-txt-muted uppercase tracking-wider mt-0.5">Score</p>
                  </div>
                </div>

                {/* Risk + Stats */}
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${riskBadge(item.riskLevel)}`}>
                    {item.riskLevel} RISK
                  </span>
                  <p className="text-[10px] text-txt-muted">
                    {formatNum(item.txCount)} tx · {item.reviewCount} reviews · {item.ageLabel} old
                  </p>
                </div>

                {/* Community */}
                <div className="border-t border-border-subtle pt-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Stars rating={item.starRating} />
                    <span className="text-[11px] text-txt-muted">{item.starRating.toFixed(1)} ({item.reviewCount})</span>
                  </div>
                  <p className="text-[11px] text-txt-muted italic line-clamp-1 mb-3">"{item.latestReview}"</p>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openReview(item)}
                      className="flex-1 py-2 rounded-lg border border-gold/40 text-gold text-[11px] font-bold uppercase tracking-wider hover:bg-gold/10 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Add Review
                    </button>
                    <Link
                      href={`/score/${item.address}`}
                      className="flex-1 py-2 rounded-lg bg-gold/10 text-gold text-[11px] font-bold uppercase tracking-wider hover:bg-gold/20 transition-colors flex items-center justify-center gap-1.5"
                    >
                      View Details
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar */}
          <div className="hidden lg:block w-[280px] space-y-4 shrink-0">
            {/* Top Movers */}
            <div className="bg-bg-card border border-border-subtle rounded-xl p-4">
              <h3 className="text-[10px] font-bold tracking-widest text-txt-muted uppercase mb-3 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-gold" />
                Top Movers
              </h3>
              <div className="space-y-2">
                {TOP_MOVERS.map((m, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5">
                    <div>
                      <span className="text-xs font-bold">{m.name}</span>
                      <span className="text-[9px] text-txt-muted font-mono ml-1.5">{m.address}</span>
                    </div>
                    <span className={`text-[11px] font-bold ${m.direction === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                      {m.direction === 'up' ? '+' : ''}{m.change}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recently Reviewed */}
            <div className="bg-bg-card border border-border-subtle rounded-xl p-4">
              <h3 className="text-[10px] font-bold tracking-widest text-txt-muted uppercase mb-3 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-gold" />
                Recently Reviewed
              </h3>
              <div className="space-y-2.5">
                {RECENT_REVIEWS.map((r, i) => (
                  <div key={i} className="border-b border-border-subtle last:border-0 pb-2 last:pb-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[11px] font-semibold">{r.target}</span>
                      <Stars rating={r.rating} />
                    </div>
                    <p className="text-[10px] text-txt-muted italic line-clamp-1">"{r.snippet}"</p>
                    <p className="text-[9px] text-txt-muted/50 font-mono mt-0.5">by {r.reviewer} · {r.hoursAgo}h ago</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Needs Review */}
            <div className="bg-bg-card border border-border-subtle rounded-xl p-4">
              <h3 className="text-[10px] font-bold tracking-widest text-txt-muted uppercase mb-3 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-yellow-400" />
                Needs Review
              </h3>
              <div className="space-y-2">
                {NEEDS_REVIEW.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5">
                    <div>
                      <p className="text-xs font-semibold">{item.name}</p>
                      <p className="text-[9px] text-txt-muted">Score: {item.score} · 0 reviews</p>
                    </div>
                    <button className="px-3 py-1.5 rounded-lg border border-gold/40 text-gold text-[10px] font-bold uppercase tracking-wider hover:bg-gold/10 transition-colors">
                      Review
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Footer */}
        <div className="mt-8 bg-bg-card border border-border-subtle rounded-xl p-4 flex items-center justify-around text-center">
          <div>
            <p className="text-lg font-bold text-gold">12.8k</p>
            <p className="text-[9px] text-txt-muted uppercase tracking-wider">Addresses Scored</p>
          </div>
          <div className="w-px h-8 bg-border-subtle" />
          <div>
            <p className="text-lg font-bold text-gold">3.2k</p>
            <p className="text-[9px] text-txt-muted uppercase tracking-wider">Reviews</p>
          </div>
          <div className="w-px h-8 bg-border-subtle" />
          <div>
            <p className="text-lg font-bold text-gold">847</p>
            <p className="text-[9px] text-txt-muted uppercase tracking-wider">Contributors</p>
          </div>
        </div>
      </main>

      {/* Review Modal */}
      {reviewOpen && reviewTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setReviewOpen(false)} />
          <div className="relative w-full max-w-md bg-bg-card border border-border-subtle rounded-2xl p-6 mx-4">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: reviewTarget.iconColor }}>
                  {reviewTarget.iconLetter}
                </div>
                <div>
                  <h3 className="font-bold">{reviewTarget.name}</h3>
                  <p className="text-[10px] text-txt-muted font-mono">{reviewTarget.address.slice(0, 10)}...{reviewTarget.address.slice(-6)}</p>
                </div>
              </div>
              <button onClick={() => setReviewOpen(false)} className="p-2 hover:bg-bg-primary rounded-full transition-colors">
                <X className="w-4 h-4 text-txt-muted" />
              </button>
            </div>

            {/* Stars */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-txt-muted mb-3">Your Rating</label>
              <div className="flex gap-2 justify-center">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setReviewForm(prev => ({ ...prev, rating: star }))}
                    className={`w-10 h-10 rounded-lg text-xl transition-all ${
                      reviewForm.rating >= star ? 'bg-gold text-bg-primary scale-105' : 'bg-bg-primary text-txt-muted/30 hover:bg-bg-primary/80'
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            {/* Comment */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-txt-muted mb-2">Your Review</label>
              <textarea
                value={reviewForm.comment}
                onChange={e => setReviewForm(prev => ({ ...prev, comment: e.target.value }))}
                placeholder="Share your experience..."
                rows={3}
                className="w-full px-4 py-3 bg-bg-primary border border-border-subtle rounded-xl text-sm text-txt-primary placeholder-txt-muted outline-none focus:border-gold/40 resize-none"
              />
            </div>

            {/* Tags */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-txt-muted mb-2">Tags</label>
              <div className="flex flex-wrap gap-1.5">
                {REVIEW_TAGS.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setReviewForm(prev => ({
                      ...prev,
                      tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag]
                    }))}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                      reviewForm.tags.includes(tag)
                        ? 'bg-gold/20 text-gold border border-gold/40'
                        : 'bg-bg-primary text-txt-muted border border-border-subtle'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={submitReview}
              disabled={submitting || reviewForm.rating === 0}
              className="w-full py-3.5 bg-gold text-bg-primary rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:bg-gold/90 transition-colors"
            >
              {submitting ? 'Submitting...' : <><Send className="w-4 h-4" /> Submit Review</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
