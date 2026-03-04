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
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error'
      setSubmitError(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Not signed in ─────────────────────────────────────────────────────────
  if (!authenticated) {
    return (
      <div className="bg-[#111] border border-[#222] rounded-xl p-6 text-center">
        <p className="text-gray-400 font-mono text-sm mb-3">Sign in to review this project</p>
        <button
          onClick={login}
          className="bg-[#EF4444] hover:bg-[#DC2626] text-white font-bold font-mono text-sm py-2.5 px-6 rounded-lg transition-colors"
        >
          Connect Wallet
        </button>
      </div>
    )
  }

  // ── STEP 1: Interaction gate (idle / loading / blocked) ───────────────────
  if (interactionStatus === 'idle') {
    return (
      <div className="bg-[#111] border border-[#222] rounded-xl p-6">
        <div className="text-center mb-5">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#EF4444]/10 border border-[#EF4444]/30 flex items-center justify-center">
            <span className="text-xl">🔍</span>
          </div>
          <h3 className="text-white font-mono font-bold text-sm mb-2">Verify Interaction</h3>
          <p className="text-gray-500 font-mono text-xs leading-relaxed">
            Only wallets with on-chain history<br />
            with this agent can submit reviews.
          </p>
        </div>
        <button
          onClick={handleVerifyInteraction}
          className="w-full bg-[#EF4444] hover:bg-[#DC2626] text-white font-bold font-mono text-sm py-3 rounded-lg transition-colors"
        >
          Verify On-Chain Interaction
        </button>
      </div>
    )
  }

  if (interactionStatus === 'loading') {
    return (
      <div className="bg-[#111] border border-[#222] rounded-xl p-8 text-center">
        <div className="w-10 h-10 mx-auto mb-3 rounded-full border-2 border-[#EF4444] border-t-transparent animate-spin" />
        <p className="text-gray-400 font-mono text-sm">
          Checking on-chain interactions…
        </p>
      </div>
    )
  }

  if (interactionStatus === 'blocked') {
    return (
      <div className="bg-[#111] border border-[#222] rounded-xl p-6">
        <div className="bg-[#1a0a0a] border border-[#EF4444]/30 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <span className="text-lg">⛔</span>
            <div>
              <p className="text-[#EF4444] font-mono font-bold text-sm mb-1">
                No Interaction Found
              </p>
              <p className="text-gray-500 font-mono text-xs leading-relaxed">
                <span className="text-gray-400">{address?.slice(0, 6)}…{address?.slice(-4)}</span> has no
                recorded transactions with this agent on Base.
              </p>
            </div>
          </div>
        </div>
        <p className="text-gray-600 font-mono text-xs mb-4 text-center">
          Interact with the agent first, then verify again.
        </p>
        <button
          onClick={handleVerifyInteraction}
          className="w-full border border-[#333] hover:border-[#555] text-gray-300 font-mono text-sm py-2.5 rounded-lg transition-colors"
        >
          Re-check Interaction
        </button>
      </div>
    )
  }

  // ── STEP 2: Interaction verified (or error = fail-open) — show form ────────
  return (
    <form onSubmit={handleSubmit} className="bg-[#111] border border-[#222] rounded-xl p-6">
      {/* Interaction badge */}
      {interactionStatus === 'verified' && proof && (
        <div className="bg-[#0a1a0a] border border-[#22C55E]/30 rounded-lg px-3 py-2 mb-4 text-xs font-mono text-[#22C55E] flex items-center gap-2">
          <span>✓</span>
          <span>
            Verified
            {proof.txCount > 0 && ` · ${proof.txCount} tx${proof.txCount > 1 ? 's' : ''}`}
            {proof.firstTxDate && ` · since ${new Date(proof.firstTxDate).toLocaleDateString()}`}
          </span>
        </div>
      )}
      {interactionStatus === 'error' && (
        <div className="bg-[#1a1a0a] border border-[#F59E0B]/30 rounded-lg px-3 py-2 mb-4 text-xs font-mono text-[#F59E0B]">
          ⚠ Could not verify — backend will re-check.
        </div>
      )}

      {/* Rating */}
      <div className="mb-5">
        <label className="block text-xs font-mono text-gray-500 mb-2">Rating</label>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className={`text-2xl transition-all hover:scale-110 ${
                star <= rating ? 'text-yellow-400' : 'text-gray-700'
              }`}
            >
              ★
            </button>
          ))}
          <span className="ml-3 text-xs font-mono text-gray-500">
            {rating === 1 && 'Unsafe'}
            {rating === 2 && 'Poor'}
            {rating === 3 && 'Average'}
            {rating === 4 && 'Good'}
            {rating === 5 && 'Excellent'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="mb-5">
        <label className="block text-xs font-mono text-gray-500 mb-2">Review (optional)</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share your experience…"
          rows={3}
          maxLength={500}
          className="w-full bg-[#0a0a0a] border border-[#333] focus:border-[#EF4444] rounded-lg px-3 py-2.5 text-sm font-mono text-white placeholder:text-gray-600 focus:outline-none transition-colors resize-none"
        />
        <div className="text-[10px] font-mono text-gray-600 mt-1">{content.length}/500</div>
      </div>

      {/* EAS Receipt ID */}
      <div className="mb-5">
        <label className="block text-xs font-mono text-gray-500 mb-2">
          EAS Receipt ID <span className="text-[#22C55E]">(×5 Rep boost)</span>
        </label>
        <input
          type="text"
          value={easReceiptId}
          onChange={(e) => setEasReceiptId(e.target.value)}
          placeholder="Paste receipt ID…"
          className="w-full bg-[#0a0a0a] border border-[#333] focus:border-[#EF4444] rounded-lg px-3 py-2.5 text-sm font-mono text-white placeholder:text-gray-600 focus:outline-none transition-colors"
        />
      </div>

      {/* Cost notice */}
      <div className="bg-[#1a1a0a] border border-[#F59E0B]/20 rounded-lg px-3 py-2 mb-4 text-xs font-mono text-[#F59E0B]/80">
        Submitting costs <strong>2 🪲 Scarab</strong>
      </div>

      {/* Submit error */}
      {submitError && (
        <div className="bg-[#1a0a0a] border border-[#EF4444]/30 rounded-lg px-3 py-2 mb-4 text-xs font-mono text-[#EF4444]">
          {submitError}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-[#EF4444] hover:bg-[#DC2626] disabled:bg-[#333] disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold font-mono text-sm py-3 rounded-lg transition-colors"
      >
        {submitting ? 'Submitting…' : 'Submit Review'}
      </button>
    </form>
  )
}
