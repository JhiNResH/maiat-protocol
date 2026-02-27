'use client'

import Link from 'next/link'

interface ProjectCardProps {
  id: string
  slug?: string
  name: string
  description: string
  category?: string
  chain?: string
  trustScore: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  reviewCount?: number
  txCount?: number
}

function getRiskBadgeStyle(level: string) {
  switch (level) {
    case 'LOW':
      return 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/30'
    case 'MEDIUM':
      return 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30'
    case 'HIGH':
    case 'CRITICAL':
      return 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30'
    default:
      return 'bg-[#666666]/10 text-[#666666] border-[#666666]/30'
  }
}

function getScoreColor(score: number) {
  if (score >= 7.0) return 'text-[#22C55E]'
  if (score >= 4.0) return 'text-[#F59E0B]'
  return 'text-[#EF4444]'
}

function getChainDot(chain?: string) {
  switch (chain?.toLowerCase()) {
    case 'base':
      return 'bg-[#0052FF]'
    case 'ethereum':
    case 'eth':
      return 'bg-purple-500'
    case 'bnb':
    case 'bsc':
    case 'binance':
      return 'bg-[#F3BA2F]'
    case 'solana':
    case 'sol':
      return 'bg-[#9945FF]'
    default:
      return 'bg-[#666666]'
  }
}

function getCategoryColor(cat?: string) {
  if (cat === 'Agent') return '#0052FF'
  if (cat === 'DeFi' || cat === 'DEX') return '#7C3AED'
  if (cat === 'Lending') return '#0EA5E9'
  return '#666666'
}

function truncateDescription(desc: string, maxLen = 60) {
  if (desc.length <= maxLen) return desc
  return desc.slice(0, maxLen).trim() + '...'
}

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return n.toString()
}

export function ProjectCard({
  id,
  slug,
  name,
  description,
  category,
  chain,
  trustScore,
  riskLevel,
  reviewCount = 0,
  txCount = 0,
}: ProjectCardProps) {
  const href = `/agent/${slug || id}`
  const initial = name.charAt(0).toUpperCase()
  const catColor = getCategoryColor(category)

  return (
    <Link
      href={href}
      className="group flex items-center gap-4 px-4 py-3 bg-[#111111] border border-[#1F1F1F] rounded-lg transition-all duration-200 hover:border-[#0052FF]/50 hover:shadow-[0_0_20px_rgba(0,82,255,0.15)]"
      style={{ minHeight: '72px' }}
    >
      {/* LEFT: Avatar + Name + Chain */}
      <div className="flex items-center gap-3 min-w-0 flex-shrink-0" style={{ width: '180px' }}>
        {/* Avatar circle */}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold font-mono shrink-0"
          style={{
            backgroundColor: catColor + '22',
            color: catColor,
            border: `1px solid ${catColor}44`,
          }}
        >
          {initial}
        </div>

        {/* Name + Chain badge */}
        <div className="min-w-0 flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-[#E5E5E5] truncate group-hover:text-[#0052FF] transition-colors">
            {name}
          </span>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${getChainDot(chain)}`} />
            <span className="text-[10px] font-mono text-[#666666] uppercase">
              {chain || 'Unknown'}
            </span>
          </div>
        </div>
      </div>

      {/* CENTER: Description (truncated) */}
      <div className="flex-1 min-w-0 px-2">
        <p className="text-xs text-[#666666] font-mono truncate">
          {truncateDescription(description)}
        </p>
      </div>

      {/* RIGHT: Trust Score + Risk Badge */}
      <div className="flex items-center gap-4 shrink-0">
        {/* Stats in monospace */}
        <div className="hidden sm:flex items-center gap-3 text-[10px] font-mono text-[#666666]">
          {txCount > 0 && (
            <span>{formatNumber(txCount)} txs</span>
          )}
          <span>{reviewCount} reviews</span>
        </div>

        {/* Risk Badge */}
        <span
          className={`px-2 py-0.5 text-[10px] font-bold font-mono uppercase tracking-wide rounded border ${getRiskBadgeStyle(riskLevel)}`}
        >
          {riskLevel}
        </span>

        {/* Trust Score */}
        <div className="flex flex-col items-center min-w-[48px]">
          <span className={`text-xl font-bold font-mono leading-none ${getScoreColor(trustScore)}`}>
            {trustScore.toFixed(1)}
          </span>
          <span className="text-[8px] font-mono text-[#666666] uppercase tracking-wider mt-0.5">
            trust
          </span>
        </div>
      </div>
    </Link>
  )
}
