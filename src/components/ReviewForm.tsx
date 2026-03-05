'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useInteractionCheck } from '@/hooks/useInteractionCheck'
import { Shield, Zap, MessageSquare, Star, Info, CheckCircle, Trophy } from 'lucide-react'

interface ReviewFormProps {
  projectId: string      // target contract/agent address
  projectName: string    // display name
  onSuccess?: () => void
}

export function ReviewForm({ projectId, projectName, onSuccess }: ReviewFormProps) {
  const { authenticated, user, login } = usePrivy()
  const walletAddress = user?.wallet?.address

  const [rating, setRating] = useState(5)
  const [content, setContent] = useState('')
  const [easReceiptId, setEasReceiptId] = useState('')
  const [detectedEasId, setDetectedEasId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [scarabBalance, setScarabBalance] = useState<number | null>(null)

  // ── Interaction Check ───────────────────────────────────────────────────
  const { status: interactionStatus, proof, check: checkInteraction } =
    useInteractionCheck(walletAddress, projectId)

  // ── Fetch Scarab Balance ───────────────────────────────────────────────
  const fetchScarab = useCallback(async () => {
    if (!walletAddress) return
    try {
      const res = await fetch(`/api/v1/scarab?address=${walletAddress}`)
      if (res.ok) {
        const data = await res.json()
        setScarabBalance(data.balance)
      }
    } catch {}
  }, [walletAddress])

  // ── Auto-Detect EAS Receipts ──────────────────────────────────────────
  const detectReceipts = useCallback(async () => {
    if (!walletAddress || !projectId) return
    try {
      const res = await fetch(`/api/v1/wallet/${walletAddress}/eas-receipts`)
      if (res.ok) {
        const data = await res.json()
        const receipts = data.receipts || []
        
        // Find if any receipt matches this target agent
        const match = receipts.find((r: any) => {
          try {
            const json = JSON.parse(r.receiptJson)
            return json.target?.toLowerCase() === projectId.toLowerCase() || 
                   json.agentAddress?.toLowerCase() === projectId.toLowerCase()
          } catch {
            return false
          }
        })

        if (match) {
          setDetectedEasId(match.id)
          setEasReceiptId(match.id)
        }
      }
    } catch (err) {
      console.warn("[EAS Detect] failed:", err)
    }
  }, [walletAddress, projectId])

  useEffect(() => {
    if (authenticated && walletAddress) {
      fetchScarab()
      detectReceipts()
    }
  }, [authenticated, walletAddress, fetchScarab, detectReceipts])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!walletAddress) return
    if (interactionStatus === 'blocked') return

    setSubmitting(true)
    setSubmitError(null)

    try {
      const res = await fetch('/api/v1/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: projectId,
          reviewer: walletAddress,
          rating,
          comment: content.trim() || undefined,
          easReceiptId: (detectedEasId || easReceiptId.trim()) || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Review failed')

      setContent('')
      setRating(5)
      setEasReceiptId('')
      fetchScarab()
      if (onSuccess) onSuccess()
      alert('✅ Opinion recorded on-chain!')
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error'
      setSubmitError(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  if (!authenticated) {
    return (
      <div className="bg-[#0d0e17] border border-[#1e2035] rounded-xl p-6 text-center">
        <MessageSquare className="w-8 h-8 text-[#475569] mx-auto mb-3" />
        <h3 className="text-sm font-bold text-white mb-1 uppercase tracking-wider">Connect to Review</h3>
        <p className="text-xs text-[#94a3b8] mb-4 font-mono">Verify your interactions and earn Scarab rewards.</p>
        <button 
          onClick={login}
          className="w-full py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-bold text-xs rounded-lg transition-colors uppercase tracking-widest"
        >
          Connect Wallet
        </button>
      </div>
    )
  }

  if (interactionStatus === 'idle' || interactionStatus === 'loading') {
    return (
      <div className="bg-[#0d0e17] border border-[#1e2035] rounded-xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-[#3b82f6]" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">Interaction Proof</span>
        </div>
        <p className="text-[10px] text-[#94a3b8] font-mono leading-relaxed mb-4">
          Verify your on-chain interaction history with this agent before leaving an opinion.
        </p>
        <button 
          onClick={checkInteraction}
          disabled={interactionStatus === 'loading'}
          className="w-full py-2.5 bg-[#1e2035] hover:bg-[#2a2d45] disabled:opacity-50 text-white font-mono text-[10px] font-bold rounded-lg transition-all border border-[#3b82f6]/30 uppercase tracking-widest"
        >
          {interactionStatus === 'loading' ? 'Scanning Base Mainnet...' : 'Verify My Interactions'}
        </button>
      </div>
    )
  }

  if (interactionStatus === 'blocked') {
    return (
      <div className="bg-[#0d0e17] border border-red-500/20 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-red-500" />
          <span className="text-xs font-bold text-red-500 uppercase tracking-wider">Proof Required</span>
        </div>
        <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-3 mb-4">
          <p className="text-[10px] text-red-400 font-mono leading-relaxed">
            NO INTERACTION FOUND: No recorded transactions with this agent on Base.
          </p>
        </div>
        <button onClick={checkInteraction} className="w-full py-2 text-[10px] font-mono text-[#94a3b8] hover:text-white transition-colors uppercase">
          Retry Scan
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[#0d0e17] border border-[#1e2035] rounded-xl p-5 flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        {interactionStatus === 'verified' && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981] text-[9px] font-bold font-mono uppercase">
            <CheckCircle className="w-3 h-3" /> On-Chain 3x
          </div>
        )}
        {detectedEasId && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#3b82f6]/10 border border-[#3b82f6]/20 text-[#3b82f6] text-[9px] font-bold font-mono uppercase">
            <Trophy className="w-3 h-3" /> EAS RECEIPT 5x
          </div>
        )}
        {scarabBalance !== null && (
          <div className="ml-auto flex items-center gap-1 text-[9px] font-mono text-[#d4a017]">
            <Zap className="w-3 h-3" /> {scarabBalance} 🪲
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-end">
          <label className="text-[10px] font-bold text-[#475569] uppercase tracking-widest font-mono">Select Rating</label>
          <span className="text-xs font-bold text-white font-mono">{rating}/5</span>
        </div>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              type="button" key={s} onClick={() => setRating(s)}
              className={`flex-1 h-8 rounded border transition-all font-mono text-[10px] font-bold ${
                s <= rating ? 'bg-[#3b82f6]/20 border-[#3b82f6] text-[#3b82f6]' : 'bg-black/40 border-[#1e2035] text-[#475569] hover:border-[#475569]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-bold text-[#475569] uppercase tracking-widest font-mono">Your Opinion</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={`Describe your experience with ${projectName}...`}
          rows={3}
          required
          className="w-full bg-black/40 border border-[#1e2035] focus:border-[#3b82f6]/50 rounded-lg p-3 text-sm text-white placeholder-[#475569] outline-none transition-all resize-none font-mono"
        />
      </div>

      {!detectedEasId && (
        <div className="flex flex-col gap-2">
          <div className="flex justify-between">
            <label className="text-[10px] font-bold text-[#475569] uppercase tracking-widest font-mono">EAS Receipt ID</label>
            <span className="text-[9px] text-[#475569] font-mono italic">Optional: 5x Weight</span>
          </div>
          <input
            type="text"
            value={easReceiptId}
            onChange={(e) => setEasReceiptId(e.target.value)}
            placeholder="0x attestation hash..."
            className="w-full bg-black/40 border border-[#1e2035] focus:border-[#3b82f6]/50 rounded-lg px-3 py-2 text-[10px] text-[#94a3b8] font-mono outline-none"
          />
        </div>
      )}

      <div className="bg-[#1a1a0a] border border-[#06b6d4]/20 rounded-lg px-3 py-2 text-[9px] font-mono text-[#06b6d4]/80">
        Costs <strong>2 🪲 Scarab</strong> · Quality reviews earn up to <strong>+10 🪲</strong>
      </div>

      {submitError && (
        <div className="flex items-center gap-2 text-[10px] text-red-400 font-mono bg-red-400/5 p-2 rounded border border-red-400/20">
          <Info className="w-3 h-3" /> {submitError}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 bg-[#3b82f6] hover:bg-[#2563eb] disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-all shadow-lg shadow-[#3b82f6]/20 uppercase tracking-[2px] font-mono"
      >
        {submitting ? 'Broadcasting...' : 'Submit Opinion'}
      </button>
    </form>
  )
}
