'use client'

import { useEffect, useState, useCallback } from 'react'
import { Shield, MessageSquare, Star, Clock, ThumbsUp, ThumbsDown, Bot, User, CheckCircle, AlertTriangle, Zap } from 'lucide-react'
import { usePrivy } from '@privy-io/react-auth'

interface Review {
  id: string
  address: string
  rating: number
  comment: string
  reviewer: string
  weight: number
  timestamp: string
  qualityScore?: number | null
  interactionTier?: string
  source?: string
  hasEas?: boolean
  upvotes?: number
  downvotes?: number
}

interface ReviewListProps {
  address: string
  refreshTrigger?: number
}

function getInteractionBadge(r: Review) {
  if (r.interactionTier === 'acp' || r.hasEas) return { label: 'ACP Verified', icon: CheckCircle, color: 'bg-black/5 dark:bg-white/5 text-[var(--text-color)] border-[var(--border-color)]' }
  if (r.interactionTier === 'onchain') return { label: 'On-chain', icon: Shield, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' }
  return { label: 'Unverified', icon: AlertTriangle, color: 'bg-black/5 dark:bg-white/5 text-[var(--text-muted)] border-white/10' }
}

function getQualityTier(qs: number | null | undefined) {
  const score = qs ?? 50
  if (score >= 70) return { badge: '✓ Verified', badgeClass: 'text-[var(--text-color)] bg-black/5 dark:bg-white/5', cardClass: '', isLow: false }
  if (score >= 40) return { badge: null, badgeClass: '', cardClass: '', isLow: false }
  return { badge: 'Low Quality', badgeClass: 'text-red-400 bg-red-500/10', cardClass: 'opacity-50', isLow: true }
}

export function ReviewList({ address, refreshTrigger }: ReviewListProps) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [votingId, setVotingId] = useState<string | null>(null)
  const [myVotes, setMyVotes] = useState<Record<string, 'up' | 'down'>>({})
  const { user } = usePrivy()
  const walletAddress = user?.wallet?.address

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true)
      const voterQ = walletAddress ? `&voter=${walletAddress}` : ''
      const res = await fetch(`/api/v1/review?address=${address}${voterQ}`)
      if (!res.ok) throw new Error('Failed to fetch reviews')
      const data = await res.json()
      setReviews(data.reviews || [])
      setCount(data.count || 0)
      // Hydrate vote state from API
      const votes: Record<string, 'up' | 'down'> = {}
      for (const r of (data.reviews || [])) {
        if (r.myVote) votes[r.id] = r.myVote
      }
      setMyVotes(prev => ({ ...prev, ...votes }))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [address, walletAddress])

  useEffect(() => {
    fetchReviews()
  }, [fetchReviews, refreshTrigger])

  async function handleVote(reviewId: string, direction: 'up' | 'down') {
    if (!walletAddress || votingId) return
    setVotingId(reviewId)
    try {
      await fetch('/api/v1/review/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId, voter: walletAddress, direction }),
      })
      setMyVotes(prev => ({ ...prev, [reviewId]: direction }))
      fetchReviews()
    } catch { /* silent */ }
    finally { setVotingId(null) }
  }

  if (loading && reviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3">
        <div className="animate-spin w-6 h-6 border-2 border-[var(--text-color)] border-t-transparent rounded-full" />
        <span className="text-sm text-[var(--text-muted)] ">Loading reviews...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-red-400 text-sm  text-center">
        Error loading reviews: {error}
      </div>
    )
  }

  if (reviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4 liquid-glass rounded-[3rem] border border-dashed border-[var(--border-color)]">
        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
          <MessageSquare className="w-6 h-6 text-[var(--text-muted)]" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm font-bold text-[var(--text-color)] ">No reviews yet</p>
          <p className="text-xs text-[var(--text-muted)] ">Be the first to share your experience!</p>
        </div>
      </div>
    )
  }

  // Sort: qualityScore descending, verified first, low quality last
  const sorted = [...reviews].sort((a, b) => {
    const scoreA = a.qualityScore ?? 50;
    const scoreB = b.qualityScore ?? 50;
    return scoreB - scoreA;
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-bold text-[var(--text-color)] flex items-center gap-2 ">
          Community Reviews
          <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-[var(--text-color)] text-xs ">{count}</span>
        </h3>
      </div>

      <div className="grid gap-3">
        {sorted.map((review) => {
          const quality = getQualityTier(review.qualityScore)
          const interaction = getInteractionBadge(review)
          const InteractionIcon = interaction.icon

          return (
            <details key={review.id} open={!quality.isLow}>
              <summary className={`list-none cursor-pointer flex flex-col gap-3 liquid-glass rounded-2xl border border-[var(--border-color)] p-5 transition-all hover:border-[var(--border-color)] ${quality.cardClass}`}>
                {/* Header: Reviewer, Badges, Rating */}
                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-bold text-[var(--text-color)] ">
                        {review.reviewer.slice(0, 6)}...{review.reviewer.slice(-4)}
                      </span>
                      {/* Source badge */}
                      {review.source === 'agent' ? (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 text-[9px] font-bold uppercase tracking-wider border border-purple-500/20">
                          <Bot className="w-2.5 h-2.5" /> Agent
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-[var(--text-muted)] text-[9px] font-bold uppercase tracking-wider border border-white/10">
                          <User className="w-2.5 h-2.5" /> Human
                        </span>
                      )}
                      {/* Interaction tier */}
                      <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${interaction.color}`}>
                        <InteractionIcon className="w-2.5 h-2.5" /> {interaction.label}
                      </span>
                      {/* Quality badge */}
                      {review.qualityScore != null && (
                        <span 
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider cursor-help ${
                            review.qualityScore >= 70 ? 'text-[var(--text-color)] bg-black/5 dark:bg-white/5 border border-[var(--border-color)]' :
                            review.qualityScore >= 40 ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20' :
                            'text-red-400 bg-red-500/10 border border-red-400/20'
                          }`}
                          title={`AI Quality Intel: Relevance, Evidence, and Helpfulness scored by Gemini.`}
                        >
                          <Zap size={10} className="fill-current" /> AI Quality: {(review.qualityScore / 10).toFixed(1)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3 h-3 ${i < Math.round((review.rating || 0) / 2) ? 'fill-amber-400 text-amber-400' : 'text-[var(--border-color)]'}`}
                        />
                      ))}
                      <span className="ml-2 text-[11px]  text-[var(--text-muted)]">
                        {new Date(review.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Rating + Vote */}
                  <div className="flex items-center gap-3">
                    <div className={`px-2 py-1 rounded text-[11px] font-bold  ${
                      review.rating >= 8 ? 'bg-black/5 dark:bg-white/5 text-[var(--text-color)]' :
                      review.rating >= 5 ? 'bg-amber-500/10 text-amber-400' :
                      'bg-red-500/10 text-red-400'
                    }`}>
                      {review.rating}/10
                    </div>
                    {/* Upvote/Downvote */}
                    <div className="flex flex-col items-center gap-0.5">
                      <button
                        onClick={(e) => { e.preventDefault(); handleVote(review.id, 'up'); }}
                        disabled={!walletAddress || votingId === review.id}
                        className={`transition-colors disabled:opacity-30 p-0.5 ${myVotes[review.id] === 'up' ? 'text-[var(--text-color)]' : 'text-[var(--text-muted)] hover:text-[var(--text-color)]'}`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                      <span className={`text-[9px]  ${(review.upvotes ?? 0) - (review.downvotes ?? 0) > 0 ? 'text-[var(--text-color)]' : (review.upvotes ?? 0) - (review.downvotes ?? 0) < 0 ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>
                        {(review.upvotes ?? 0) - (review.downvotes ?? 0)}
                      </span>
                      <button
                        onClick={(e) => { e.preventDefault(); handleVote(review.id, 'down'); }}
                        disabled={!walletAddress || votingId === review.id}
                        className={`transition-colors disabled:opacity-30 p-0.5 ${myVotes[review.id] === 'down' ? 'text-red-400' : 'text-[var(--text-muted)] hover:text-red-400'}`}
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Comment */}
                {review.comment ? (
                  <p className={`text-[13px] leading-relaxed  ${quality.isLow ? 'text-[var(--text-muted)] italic' : 'text-[var(--text-secondary)]'}`}>
                    {quality.isLow && review.comment.length > 100 ? review.comment.slice(0, 100) + '…' : review.comment}
                  </p>
                ) : (
                  <p className="text-[13px] text-[var(--text-muted)]  italic">(No comment provided)</p>
                )}
              </summary>
            </details>
          )
        })}
      </div>
    </div>
  )
}
