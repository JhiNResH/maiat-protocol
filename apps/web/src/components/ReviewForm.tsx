'use client'

import { useState } from 'react'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { Shield, Star, Send, Loader2 } from 'lucide-react'
import { getAddress } from 'viem'

interface ReviewFormProps {
  projectId: string
  projectName: string
  onSuccess?: () => void
}

const REVIEW_TAGS = [
  'Reliable',
  'Fast',
  'Good UX',
  'Innovative',
  'Secure',
  'Responsive',
  'Fair Pricing',
  'Buggy',
  'Slow',
  'Poor Support',
]

export function ReviewForm({ projectId, projectName, onSuccess }: ReviewFormProps) {
  const { authenticated, user, login } = usePrivy()
  const { wallets } = useWallets()
  const walletAddress = user?.wallet?.address

  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (!authenticated) {
    return (
      <div className="liquid-glass rounded-[3rem] p-6 text-center">
        <Shield className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-3" />
        <h3 className="text-sm font-bold text-[var(--text-color)] mb-1 uppercase tracking-wider">Write a Review</h3>
        <p className="text-xs text-[var(--text-muted)] mb-4">Connect your wallet to share your experience with this agent.</p>
        <button
          onClick={login}
          className="w-full py-3 bg-[var(--text-color)] text-[var(--bg-color)] font-bold text-xs rounded-2xl transition-all hover:opacity-90 uppercase tracking-widest"
        >
          Connect Wallet
        </button>
      </div>
    )
  }

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag].slice(0, 3)
    )
  }

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Please select a rating')
      return
    }

    if (!walletAddress) {
      setError('Wallet not connected')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const checksumAddress = getAddress(projectId)
      const checksumReviewer = getAddress(walletAddress)
      const ratingValue = rating * 2 // Convert 1-5 stars to 2-10 scale

      // Build signature message
      const message = `Maiat Review: ${checksumAddress} Rating: ${ratingValue} Reviewer: ${checksumReviewer}`

      // Sign the message with the user's wallet
      const wallet = wallets.find(w => w.address.toLowerCase() === walletAddress.toLowerCase())
      if (!wallet) {
        throw new Error('Wallet not found')
      }

      const provider = await wallet.getEthereumProvider()
      const signature = await provider.request({
        method: 'personal_sign',
        params: [message, walletAddress],
      }) as string

      // Submit review
      const res = await fetch('/api/v1/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: checksumAddress,
          rating: ratingValue,
          comment: comment.trim() || undefined,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
          reviewer: checksumReviewer,
          signature,
          source: 'human',
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || data.detail || 'Failed to submit review')
      }

      setSuccess(true)
      setRating(0)
      setComment('')
      setSelectedTags([])
      onSuccess?.()

      // Reset success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to submit review')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="liquid-glass rounded-[3rem] p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center mx-auto mb-3">
          <Shield className="w-6 h-6 text-[var(--text-color)]" />
        </div>
        <h3 className="text-sm font-bold text-[var(--text-color)] mb-1 uppercase tracking-wider">Review Submitted!</h3>
        <p className="text-xs text-[var(--text-muted)]">Thank you for sharing your experience.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Rating */}
      <div>
        <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2 block">
          Your Rating
        </label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-1 transition-transform hover:scale-110"
            >
              <Star
                size={24}
                className={`transition-colors ${
                  star <= (hoverRating || rating)
                    ? 'fill-current text-[var(--text-color)]'
                    : 'text-[var(--border-color)]'
                }`}
              />
            </button>
          ))}
          {rating > 0 && (
            <span className="ml-2 text-sm text-[var(--text-secondary)] self-center">
              {rating === 1 ? 'Poor' : rating === 2 ? 'Fair' : rating === 3 ? 'Good' : rating === 4 ? 'Great' : 'Excellent'}
            </span>
          )}
        </div>
      </div>

      {/* Comment */}
      <div>
        <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2 block">
          Your Review (Optional)
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share your experience with this agent..."
          rows={3}
          className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-2xl px-4 py-3 text-sm text-[var(--text-color)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text-color)]/30 transition-colors resize-none"
        />
      </div>

      {/* Tags */}
      <div>
        <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2 block">
          Tags (Optional, max 3)
        </label>
        <div className="flex flex-wrap gap-2">
          {REVIEW_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                selectedTags.includes(tag)
                  ? 'bg-[var(--text-color)] text-white'
                  : 'bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-muted)] hover:border-[var(--text-color)]/30'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3 text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting || rating === 0}
        className="w-full py-3 bg-[var(--text-color)] text-white font-bold text-xs rounded-2xl transition-all hover:bg-[var(--text-color)] disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <Send size={14} />
            Submit Review
          </>
        )}
      </button>

      {/* Info */}
      <p className="text-[9px] text-[var(--text-muted)] text-center">
        Reviews cost <strong className="text-[var(--text-color)]">2</strong> Scarab. Quality reviews earn up to <strong className="text-[var(--text-color)]">+3</strong> Scarab back.
      </p>
    </div>
  )
}
