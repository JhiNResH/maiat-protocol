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
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    glow: 'shadow-emerald-500/20',
  },
  pending: {
    label: 'Unreviewed',
    icon: '🟡',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
  },
  rejected: {
    label: 'Flagged',
    icon: '🔴',
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/30',
    glow: 'shadow-red-500/20',
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
