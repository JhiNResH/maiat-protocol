'use client'

import Link from 'next/link'
import { Clock, Users, TrendingUp, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TopProject {
  projectId: string
  totalStake: number
}

interface MarketCardProps {
  id: string
  title: string
  description: string
  category: string
  status: 'open' | 'closed' | 'resolved'
  totalPool: number
  positionCount: number
  voterCount?: number
  closesAt: string
  topProjects?: TopProject[]
  agentParam?: string
  agentName?: string
  projectNames?: Record<string, string>
}

function formatTimeRemaining(closesAt: string) {
  const now = new Date()
  const close = new Date(closesAt)
  const diff = close.getTime() - now.getTime()

  if (diff <= 0) return 'ENDED'

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

  if (days > 0) return `${days}d ${hours}h`
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

function formatScarab(amount: number) {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}k`
  return amount.toString()
}

function getCategoryStyle(category: string) {
  switch (category) {
    case 'ai-agents':
      return 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
    case 'defi':
      return 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400'
    case 'mixed':
      return 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
    default:
      return 'bg-[var(--card-bg)] text-[var(--text-secondary)]'
  }
}

function getStatusStyle(status: string) {
  switch (status) {
    case 'open':
      return 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
    case 'closed':
      return 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
    case 'resolved':
      return 'bg-[var(--card-bg)] text-[var(--text-muted)]'
    default:
      return 'bg-[var(--card-bg)] text-[var(--text-muted)]'
  }
}

export function MarketCard({
  id,
  title,
  description,
  category,
  status,
  totalPool,
  positionCount,
  voterCount,
  closesAt,
  topProjects = [],
  projectNames = {},
  agentParam,
  agentName,
}: MarketCardProps) {
  const timeRemaining = formatTimeRemaining(closesAt)
  const isActive = status === 'open' && timeRemaining !== 'ENDED'
  const marketHref = agentParam 
    ? `/markets/${id}?agent=${agentParam}${agentName ? `&name=${encodeURIComponent(agentName)}` : ''}`
    : `/markets/${id}`

  return (
    <Link
      href={marketHref}
      className="group block liquid-glass rounded-[2.5rem] p-8 transition-all duration-300 hover:border-emerald-500/30 hover-lift"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-[var(--text-color)] truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
            {title}
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2 font-medium">
            {description}
          </p>
        </div>

        {/* Status Badge */}
        <span className={cn(
          "shrink-0 px-3 py-1 text-[9px] font-bold uppercase tracking-widest rounded-full",
          getStatusStyle(status)
        )}>
          {status}
        </span>
      </div>

      {/* Stats Row */}
      <div className="flex items-center gap-6 mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <span className="text-sm font-bold text-[var(--text-color)]">
            {formatScarab(totalPool)} 🪲
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <span className="text-sm font-bold text-[var(--text-secondary)]">
            {voterCount ?? positionCount}
          </span>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Clock className={cn("w-3.5 h-3.5", isActive ? 'text-emerald-500' : 'text-[var(--text-muted)]')} />
          <span className={cn("text-sm font-bold", isActive ? 'text-emerald-500' : 'text-[var(--text-muted)]')}>
            {timeRemaining}
          </span>
        </div>
      </div>

      {/* Category Tag */}
      <div className="flex items-center gap-2 mb-4">
        <span className={cn(
          "px-3 py-1 text-[9px] font-bold uppercase tracking-widest rounded-full",
          getCategoryStyle(category)
        )}>
          {category.replace('-', ' ')}
        </span>
      </div>

      {/* Top 3 Staked */}
      {topProjects.length > 0 && (
        <div className="border-t border-[var(--border-color)] pt-4">
          <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-3 block">
            Top Staked
          </span>
          <div className="flex flex-col gap-2">
            {topProjects.slice(0, 3).map((project, idx) => (
              <div key={project.projectId} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                  {idx + 1}
                </span>
                <span className="text-xs font-bold text-[var(--text-color)] truncate flex-1">
                  {projectNames[project.projectId] || project.projectId.slice(0, 8)}
                </span>
                <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                  {formatScarab(project.totalStake)} 🪲
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {topProjects.length === 0 && status === 'open' && (
        <div className="border-t border-[var(--border-color)] pt-4">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-muted)]">
            <Trophy className="w-3.5 h-3.5" />
            <span>Be the first to stake</span>
          </div>
        </div>
      )}
    </Link>
  )
}
