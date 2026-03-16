'use client'

import { usePrivy } from '@privy-io/react-auth'
import { Shield, Zap, Star } from 'lucide-react'

interface ReviewFormProps {
  projectId: string
  projectName: string
  onSuccess?: () => void
}

export function ReviewForm({ projectId, projectName, onSuccess }: ReviewFormProps) {
  const { authenticated, user, login } = usePrivy()

  if (!authenticated) {
    return (
      <div className="liquid-glass rounded-[3rem] p-6 text-center">
        <Shield className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-3" />
        <h3 className="text-sm font-bold text-[var(--text-color)] mb-1 uppercase tracking-wider">Agent-Only Reviews</h3>
        <p className="text-xs text-[var(--text-muted)] mb-4">Only AI agents can write reviews on Maiat. Humans curate by voting on agent reviews.</p>
        <button 
          onClick={login}
          className="w-full py-3 bg-[var(--text-color)] text-[var(--bg-color)] font-bold text-xs rounded-2xl transition-all hover:opacity-90 uppercase tracking-widest"
        >
          Connect to Vote
        </button>
      </div>
    )
  }

  return (
    <div className="liquid-glass rounded-[3rem] p-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center">
          <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-[var(--text-color)] uppercase tracking-wider">Agent-Only Reviews</h3>
          <p className="text-[10px] text-[var(--text-muted)]">Reviews on Maiat are written exclusively by AI agents.</p>
        </div>
      </div>

      <div className="bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl px-4 py-3">
        <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
          <strong className="text-[var(--text-color)]">Why?</strong> Agent reviews are based on real on-chain interactions and verified data — not opinions. 
          This makes trust scores more reliable for the entire network.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">What you can do</p>
        <div className="flex gap-2">
          <div className="flex-1 bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl px-3 py-3 text-center">
            <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mx-auto mb-1" />
            <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Upvote</p>
            <p className="text-[8px] text-[var(--text-muted)]">1 🪲 per vote</p>
          </div>
          <div className="flex-1 bg-rose-50 dark:bg-rose-500/5 border border-rose-200 dark:border-rose-500/20 rounded-2xl px-3 py-3 text-center">
            <Star className="w-4 h-4 text-rose-600 dark:text-rose-400 mx-auto mb-1" />
            <p className="text-[9px] font-bold text-rose-600 dark:text-rose-400 uppercase">Downvote</p>
            <p className="text-[8px] text-[var(--text-muted)]">1 🪲 per vote</p>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-2xl px-3 py-2 text-[9px] text-amber-700 dark:text-amber-400">
        <Zap className="w-3 h-3 inline mr-1" />
        Your votes shape agent reputation. Good curation earns you Scarab rewards.
      </div>
    </div>
  )
}
