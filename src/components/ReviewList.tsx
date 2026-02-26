'use client'

import { useEffect, useState, useCallback } from 'react'
import { Shield, MessageSquare, Star, Clock, Trophy } from 'lucide-react'

interface Review {
  id: string
  address: string
  rating: number
  comment: string
  reviewer: string
  weight: number
  timestamp: string
  interactionProof?: boolean
}

interface ReviewListProps {
  address: string
  refreshTrigger?: number
}

export function ReviewList({ address, refreshTrigger }: ReviewListProps) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/v1/review?address=${address}`)
      if (!res.ok) throw new Error('Failed to fetch reviews')
      const data = await res.json()
      setReviews(data.reviews || [])
      setCount(data.count || 0)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => {
    fetchReviews()
  }, [fetchReviews, refreshTrigger])

  if (loading && reviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3">
        <div className="animate-spin w-6 h-6 border-2 border-gold border-t-transparent rounded-full" />
        <span className="text-sm text-txt-muted font-mono">Loading reviews...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-crimson/10 border border-crimson/20 rounded-xl p-4 text-crimson text-sm font-mono text-center">
        Error loading reviews: {error}
      </div>
    )
  }

  if (reviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4 bg-surface rounded-2xl border border-dashed border-border-subtle">
        <div className="w-12 h-12 rounded-full bg-txt-muted/5 flex items-center justify-center">
          <MessageSquare className="w-6 h-6 text-txt-muted" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm font-bold text-txt-primary font-mono">No reviews yet</p>
          <p className="text-xs text-txt-muted font-mono">Be the first to share your experience!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-bold text-txt-primary flex items-center gap-2 font-mono">
          Community Reviews
          <span className="px-2 py-0.5 rounded-md bg-gold/10 text-gold text-xs font-mono">{count}</span>
        </h3>
      </div>

      <div className="grid gap-4">
        {reviews.map((review) => (
          <div 
            key={review.id} 
            className="flex flex-col gap-3 bg-surface rounded-xl border border-border-subtle p-5 transition-all hover:border-gold/30 shadow-sm"
          >
            {/* Header: Reviewer & Rating */}
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-txt-primary font-mono">
                    {review.reviewer.slice(0, 6)}...{review.reviewer.slice(-4)}
                  </span>
                  {review.weight > 1 && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald/10 text-emerald text-[10px] font-bold uppercase tracking-wider">
                      <Trophy className="w-2.5 h-2.5" />
                      Verified Receipt x{review.weight}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star 
                      key={i} 
                      className={`w-3 h-3 ${i < Math.floor((review.rating || 0) / 2) ? 'fill-gold text-gold' : 'text-txt-muted/30'}`} 
                    />
                  ))}
                  <span className="ml-1 text-[11px] font-mono text-txt-muted">
                    {new Date(review.timestamp).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className={`px-2 py-1 rounded text-[11px] font-bold font-mono ${
                review.rating >= 8 ? 'bg-emerald/10 text-emerald' : 
                review.rating >= 5 ? 'bg-gold/10 text-gold' : 
                'bg-crimson/10 text-crimson'
              }`}>
                Score: {review.rating}/10
              </div>
            </div>

            {/* Comment */}
            {review.comment ? (
              <p className="text-[13px] text-txt-secondary leading-relaxed font-mono italic">
                "{review.comment}"
              </p>
            ) : (
              <p className="text-[13px] text-txt-muted font-mono italic">
                (No comment provided)
              </p>
            )}

            {/* Footer: Tags/Status */}
            <div className="flex items-center gap-3 pt-1">
              <div className="flex items-center gap-1.5 text-[11px] text-txt-muted font-mono">
                <Clock className="w-3 h-3" />
                <span>Just recently</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald font-mono">
                <Shield className="w-3 h-3" />
                <span>On-chain Proof</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
