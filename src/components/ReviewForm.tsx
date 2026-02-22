'use client'

import { useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'

interface ReviewFormProps {
  projectId: string
  projectName: string
  onSuccess?: () => void
}

export function ReviewForm({ projectId, projectName, onSuccess }: ReviewFormProps) {
  const { authenticated, user, login } = usePrivy()
  const [rating, setRating] = useState(5)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const address = user?.wallet?.address

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!address) return

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          address,
          rating,
          content: content.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Review failed')

      setContent('')
      setRating(5)
      if (onSuccess) onSuccess()
      alert(`✅ Review submitted! (-2 Scarab spent)`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!authenticated) {
    return (
      <div className="bg-white border border-gray-200 rounded-md p-5 text-center">
        <p className="text-gray-500 font-mono text-sm mb-3">Sign in to review this project</p>
        <button
          onClick={login}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold font-mono text-sm py-2 px-6 rounded-md transition-colors"
        >
          Sign In
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-md p-5">
      <h3 className="text-sm font-bold font-mono text-gray-900 mb-4">Review {projectName}</h3>

      {/* Rating */}
      <div className="mb-4">
        <label className="block text-xs font-mono text-gray-400 mb-2">Rating</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className={`text-2xl transition-all ${
                star <= rating ? 'text-yellow-500' : 'text-gray-300'
              } hover:scale-110`}
            >
              ★
            </button>
          ))}
          <span className="ml-2 text-xs font-mono text-gray-400 self-center">
            {rating === 1 && 'Unsafe'}
            {rating === 2 && 'Poor'}
            {rating === 3 && 'Average'}
            {rating === 4 && 'Good'}
            {rating === 5 && 'Excellent'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="mb-4">
        <label className="block text-xs font-mono text-gray-400 mb-2">Review (optional)</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share your experience with this project..."
          rows={4}
          className="w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm font-mono text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-400"
        />
        <div className="text-xs font-mono text-gray-400 mt-1">{content.length}/500 characters</div>
      </div>

      {/* Cost Warning */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-md px-3 py-2 mb-4 text-xs font-mono text-yellow-700">
        ⚠️ Submitting costs <strong>2 Scarab 🪲</strong>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4 text-xs font-mono text-red-600">
          ❌ {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold font-mono text-sm py-2.5 rounded-md transition-colors"
      >
        {submitting ? '⏳ Submitting...' : '🚀 Submit Review (-2 🪲)'}
      </button>
    </form>
  )
}
