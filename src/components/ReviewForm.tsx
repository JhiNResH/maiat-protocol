'use client'

import { useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useInteractionCheck } from '@/hooks/useInteractionCheck'

interface ReviewFormProps {
  projectId: string      // target contract address (0x...)
  projectName: string
  onSuccess?: () => void
}

export function ReviewForm({ projectId, projectName, onSuccess }: ReviewFormProps) {
  const { authenticated, user, login } = usePrivy()
  const [rating, setRating] = useState(5)
  const [content, setContent] = useState('')
  const [easReceiptId, setEasReceiptId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const address = user?.wallet?.address

  // ── Interaction gate ──────────────────────────────────────────────────────
  const { status: interactionStatus, proof, check: checkInteraction } =
    useInteractionCheck(address, projectId)

  const handleVerifyInteraction = () => {
    checkInteraction()
  }

  // ── Review submit ─────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!address) return
    // Safeguard: block if explicitly blocked (fail-open for error/idle)
    if (interactionStatus === 'blocked') return

    setSubmitting(true)
    setSubmitError(null)

    try {
      const res = await fetch('/api/v1/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: projectId,
          reviewer: address,
          rating,
          comment: content.trim() || undefined,
          easReceiptId: easReceiptId.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Review failed')

      setContent('')
      setRating(5)
      setEasReceiptId('')
      if (onSuccess) onSuccess()
      alert('✅ Review submitted! (-2 Scarab spent)')
    } catch (e: any) {
      setSubmitError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Not signed in ─────────────────────────────────────────────────────────
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

  // ── STEP 1: Interaction gate (idle / loading / blocked) ───────────────────
  if (interactionStatus === 'idle') {
    return (
      <div className="bg-white border border-gray-200 rounded-md p-5">
        <h3 className="text-sm font-bold font-mono text-gray-900 mb-2">Review {projectName}</h3>
        <p className="text-xs font-mono text-gray-500 mb-4">
          Only wallets that have interacted with this project can leave a review.
          Click below to verify your on-chain history.
        </p>
        <button
          onClick={handleVerifyInteraction}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold font-mono text-sm py-2.5 rounded-md transition-colors"
        >
          🔍 Verify On-Chain Interaction
        </button>
      </div>
    )
  }

  if (interactionStatus === 'loading') {
    return (
      <div className="bg-white border border-gray-200 rounded-md p-5 text-center">
        <p className="text-sm font-mono text-gray-500 animate-pulse">
          ⏳ Checking your on-chain interactions…
        </p>
      </div>
    )
  }

  if (interactionStatus === 'blocked') {
    return (
      <div className="bg-white border border-gray-200 rounded-md p-5">
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
          <p className="text-sm font-bold font-mono text-red-700 mb-1">
            ❌ No On-Chain Interaction Found
          </p>
          <p className="text-xs font-mono text-red-600">
            Your wallet <span className="font-bold">{address?.slice(0, 6)}…{address?.slice(-4)}</span>{' '}
            has no recorded transactions with <span className="font-bold">{projectName}</span> on Base.
          </p>
        </div>
        <p className="text-xs font-mono text-gray-500 mb-4">
          To leave a review, interact with the project first (swap, deposit, call a function, etc.)
          then come back to verify again.
        </p>
        <button
          onClick={handleVerifyInteraction}
          className="w-full border border-gray-300 hover:border-gray-400 text-gray-700 font-bold font-mono text-sm py-2.5 rounded-md transition-colors"
        >
          🔄 Re-check Interaction
        </button>
      </div>
    )
  }

  // ── STEP 2: Interaction verified (or error = fail-open) — show form ────────
  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-md p-5">
      <h3 className="text-sm font-bold font-mono text-gray-900 mb-4">Review {projectName}</h3>

      {/* Interaction badge */}
      {interactionStatus === 'verified' && proof && (
        <div className="bg-green-50 border border-green-200 rounded-md px-3 py-2 mb-4 text-xs font-mono text-green-700 flex items-center gap-2">
          <span>✅</span>
          <span>
            On-chain interaction verified
            {proof.txCount > 0 && ` · ${proof.txCount} tx${proof.txCount > 1 ? 's' : ''}`}
            {proof.firstTxDate && ` · since ${new Date(proof.firstTxDate).toLocaleDateString()}`}
          </span>
        </div>
      )}
      {interactionStatus === 'error' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md px-3 py-2 mb-4 text-xs font-mono text-yellow-700">
          ⚠️ Could not verify interaction on-chain — proceeding with caution. Backend will re-check.
        </div>
      )}

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
          maxLength={500}
          className="w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm font-mono text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-400"
        />
        <div className="text-xs font-mono text-gray-400 mt-1">{content.length}/500 characters</div>
      </div>

      {/* EAS Receipt ID */}
      <div className="mb-4">
        <label className="block text-xs font-mono text-gray-400 mb-2">
          EAS Receipt ID 🧾 <span className="text-green-600">(Boost Rep ×5)</span>
        </label>
        <input
          type="text"
          value={easReceiptId}
          onChange={(e) => setEasReceiptId(e.target.value)}
          placeholder="Paste your Verified Receipt ID..."
          className="w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm font-mono text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-400"
        />
      </div>

      {/* Cost warning */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-md px-3 py-2 mb-4 text-xs font-mono text-yellow-700">
        ⚠️ Submitting costs <strong>2 Scarab 🪲</strong>
      </div>

      {/* Submit error */}
      {submitError && (
        <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4 text-xs font-mono text-red-600">
          ❌ {submitError}
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
