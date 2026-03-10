'use client'

import Link from 'next/link'
import { Clock, Users, TrendingUp, Trophy } from 'lucide-react'

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

function getCategoryColor(category: string) {
  switch (category) {
    case 'ai-agents':
      return { bg: 'bg-[#3b82f6]/10', text: 'text-[#3b82f6]', border: 'border-[#3b82f6]/30' }
    case 'defi':
      return { bg: 'bg-[#6366f1]/10', text: 'text-[#6366f1]', border: 'border-[#6366f1]/30' }
    case 'mixed':
      return { bg: 'bg-[#06b6d4]/10', text: 'text-[#06b6d4]', border: 'border-[#06b6d4]/30' }
    default:
      return { bg: 'bg-[#666666]/10', text: 'text-[#666666]', border: 'border-[#666666]/30' }
  }
}

function getStatusStyle(status: string) {
  switch (status) {
    case 'open':
      return 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/30'
    case 'closed':
      return 'bg-[#06b6d4]/10 text-[#06b6d4] border-[#06b6d4]/30'
    case 'resolved':
      return 'bg-[#666666]/10 text-[#666666] border-[#666666]/30'
    default:
      return 'bg-[#666666]/10 text-[#666666] border-[#666666]/30'
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
  const catStyle = getCategoryColor(category)
  const timeRemaining = formatTimeRemaining(closesAt)
  const isActive = status === 'open' && timeRemaining !== 'ENDED'
  const marketHref = agentParam 
    ? `/markets/${id}?agent=${agentParam}${agentName ? `&name=${encodeURIComponent(agentName)}` : ''}`
    : `/markets/${id}`

  return (
    <Link
      href={marketHref}
      className="group block bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4 transition-all duration-200 hover:border-[#3b82f6]/50 hover:shadow-[0_0_20px_rgba(0,82,255,0.1)]"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[#E5E5E5] truncate group-hover:text-[#3b82f6] transition-colors">
            {title}
          </h3>
          <p className="text-[10px] font-mono text-[#666666] mt-0.5 line-clamp-2">
            {description}
          </p>
        </div>

        {/* Status Badge */}
        <span
          className={`shrink-0 px-2 py-0.5 text-[9px] font-bold font-mono uppercase tracking-wide rounded border ${getStatusStyle(status)}`}
        >
          {status}
        </span>
      </div>

      {/* Stats Row */}
      <div className="flex items-center gap-4 mb-3">
        {/* Pool Size */}
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3 text-[#666666]" />
          <span className="text-xs font-mono text-[#E5E5E5]">
            {formatScarab(totalPool)} 🪲
          </span>
        </div>

        {/* Position Count */}
        <div className="flex items-center gap-1.5">
          <Users className="w-3 h-3 text-[#666666]" />
          <span className="text-xs font-mono text-[#666666]">
            {voterCount ?? positionCount}
          </span>
        </div>

        {/* Time Remaining */}
        <div className="flex items-center gap-1.5 ml-auto">
          <Clock className={`w-3 h-3 ${isActive ? 'text-[#3b82f6]' : 'text-[#666666]'}`} />
          <span className={`text-xs font-mono ${isActive ? 'text-[#3b82f6]' : 'text-[#666666]'}`}>
            {timeRemaining}
          </span>
        </div>
      </div>

      {/* Category Tag */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`px-2 py-0.5 text-[9px] font-mono uppercase tracking-wide rounded border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
        >
          {category.replace('-', ' ')}
        </span>
      </div>

      {/* Top 3 Staked */}
      {topProjects.length > 0 && (
        <div className="border-t border-[var(--border-default)] pt-3">
          <span className="text-[9px] font-mono text-[#666666] uppercase tracking-wider mb-2 block">
            TOP STAKED
          </span>
          <div className="flex flex-col gap-1.5">
            {topProjects.slice(0, 3).map((project, idx) => (
              <div key={project.projectId} className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-[#3b82f6]/10 flex items-center justify-center text-[9px] font-bold font-mono text-[#3b82f6]">
                  {idx + 1}
                </span>
                <span className="text-xs font-mono text-[#E5E5E5] truncate flex-1">
                  {projectNames[project.projectId] || project.projectId.slice(0, 8)}
                </span>
                <span className="text-[10px] font-mono text-[#666666]">
                  {formatScarab(project.totalStake)} 🪲
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {topProjects.length === 0 && status === 'open' && (
        <div className="border-t border-[var(--border-default)] pt-3">
          <div className="flex items-center gap-2 text-[10px] font-mono text-[#666666]">
            <Trophy className="w-3 h-3" />
            <span>Be the first to stake!</span>
          </div>
        </div>
      )}
    </Link>
  )
}
