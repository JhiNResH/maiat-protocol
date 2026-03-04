'use client'

import { cn } from '@/lib/utils'

type TrustLevel = 'approved' | 'pending' | 'rejected'

interface TrustBadgeProps {
  status: TrustLevel
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

const config: Record<TrustLevel, { label: string; icon: string; bg: string; text: string; border: string; glow?: string }> = {
  approved: {
    label: 'Verified Safe',
    icon: '🟢',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    glow: 'shadow-blue-500/20',
  },
  pending: {
    label: 'Unreviewed',
    icon: '🟡',
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    border: 'border-cyan-500/30',
  },
  rejected: {
    label: 'Flagged',
    icon: '🔴',
    bg: 'bg-slate-500/10',
    text: 'text-slate-400',
    border: 'border-slate-500/30',
    glow: 'shadow-slate-500/20',
  },
}

export function TrustBadge({ status, size = 'md', showLabel = true, className }: TrustBadgeProps) {
  const c = config[status]
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5 gap-1',
    md: 'text-sm px-2.5 py-1 gap-1.5',
    lg: 'text-base px-3 py-1.5 gap-2',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        c.bg, c.text, c.border,
        c.glow && `shadow-sm ${c.glow}`,
        sizeClasses[size],
        className
      )}
    >
      <span>{c.icon}</span>
      {showLabel && <span>{c.label}</span>}
    </span>
  )
}
