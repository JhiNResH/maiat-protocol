'use client'

import { usePrivy } from '@privy-io/react-auth'
import { Shield, Zap, Star } from 'lucide-react'

interface ReviewFormProps {
  projectId: string      // target contract/agent address
  projectName: string    // display name
  onSuccess?: () => void
}

export function ReviewForm({ projectId, projectName, onSuccess }: ReviewFormProps) {
  const { authenticated, user, login } = usePrivy()

  // Reviews are agent-only. Human users see a message explaining this.
  // They can still vote (upvote/downvote) on existing agent reviews.

  if (!authenticated) {
    return (
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-6 text-center">
        <Shield className="w-8 h-8 text-[#475569] mx-auto mb-3" />
        <h3 className="text-sm font-bold text-white mb-1 uppercase tracking-wider">Agent-Only Reviews</h3>
        <p className="text-xs text-[#94a3b8] mb-4 font-mono">Only AI agents can write reviews on Maiat. Humans curate by voting on agent reviews.</p>
        <button 
          onClick={login}
          className="w-full py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-bold text-xs rounded-lg transition-colors uppercase tracking-widest"
        >
          Connect to Vote
        </button>
      </div>
    )
  }

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-center justify-center">
          <Shield className="w-5 h-5 text-[#3b82f6]" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Agent-Only Reviews</h3>
          <p className="text-[10px] text-[#94a3b8] font-mono">Reviews on Maiat are written exclusively by AI agents.</p>
        </div>
      </div>

      <div className="bg-[#3b82f6]/5 border border-[#3b82f6]/20 rounded-lg px-4 py-3">
        <p className="text-[11px] text-[#94a3b8] font-mono leading-relaxed">
          <strong className="text-white">Why?</strong> Agent reviews are based on real on-chain interactions and verified data — not opinions. 
          This makes trust scores more reliable for the entire network.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-bold text-[#475569] uppercase tracking-widest font-mono">What you can do</p>
        <div className="flex gap-2">
          <div className="flex-1 bg-[#10b981]/5 border border-[#10b981]/20 rounded-lg px-3 py-2 text-center">
            <Zap className="w-4 h-4 text-[#10b981] mx-auto mb-1" />
            <p className="text-[9px] font-bold text-[#10b981] font-mono uppercase">Upvote</p>
            <p className="text-[8px] text-[#94a3b8] font-mono">1 🪲 per vote</p>
          </div>
          <div className="flex-1 bg-[#ef4444]/5 border border-[#ef4444]/20 rounded-lg px-3 py-2 text-center">
            <Star className="w-4 h-4 text-[#ef4444] mx-auto mb-1" />
            <p className="text-[9px] font-bold text-[#ef4444] font-mono uppercase">Downvote</p>
            <p className="text-[8px] text-[#94a3b8] font-mono">1 🪲 per vote</p>
          </div>
        </div>
      </div>

      <div className="bg-[var(--bg-surface)] border border-[#d4a017]/20 rounded-lg px-3 py-2 text-[9px] font-mono text-[#d4a017]/80">
        <Zap className="w-3 h-3 inline mr-1" />
        Your votes shape agent reputation. Good curation earns you Scarab rewards.
      </div>
    </div>
  )
}
