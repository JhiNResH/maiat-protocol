'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import { ReviewForm } from '@/components/ReviewForm'
import Link from 'next/link'

interface ProjectInfo {
  name: string
  symbol?: string
  address: string
  chain: string
  trustScore: number | null
  category: string
  description?: string
  reviewCount?: number
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return (
    <span className="text-2xl font-bold font-mono text-gray-400">—</span>
  )
  const color = score >= 7 ? '#22C55E' : score >= 4 ? '#F59E0B' : '#EF4444'
  const label = score >= 7 ? 'LOW RISK' : score >= 4 ? 'MEDIUM RISK' : 'HIGH RISK'
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-4xl font-bold font-mono" style={{ color }}>{score.toFixed(1)}</span>
      <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ color, border: `1px solid ${color}` }}>
        {label}
      </span>
    </div>
  )
}

function ChainBadge({ chain }: { chain: string }) {
  const isBase = chain?.toLowerCase() === 'base'
  return (
    <span className={`text-xs font-mono px-2 py-0.5 rounded border ${
      isBase ? 'border-[#0052FF] text-[#0052FF]' : 'border-gray-500 text-gray-400'
    }`}>
      {chain || 'Base'}
    </span>
  )
}

export default function ReviewPage() {
  const params = useParams()
  const address = params?.address as string
  const { authenticated, login } = usePrivy()

  const [project, setProject] = useState<ProjectInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [reviewed, setReviewed] = useState(false)

  useEffect(() => {
    if (!address) return
    setLoading(true)

    // Try by address → API returns project or 404
    fetch(`/api/v1/project/${encodeURIComponent(address)}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return null }
        return r.json()
      })
      .then(data => {
        if (!data) return
        const p = data.project || data
        setProject({
          name: p.name || 'Unknown Project',
          symbol: p.symbol,
          address: p.address || address,
          chain: p.chain || 'Base',
          trustScore: p.trustScore != null ? p.trustScore / 10 : null,
          category: p.category || 'DeFi',
          description: p.description,
          reviewCount: p.reviewCount || 0,
        })
        setLoading(false)
      })
      .catch(() => {
        // Fallback: show the form anyway with just the address
        setProject({
          name: address.slice(0, 6) + '…' + address.slice(-4),
          address,
          chain: 'Base',
          trustScore: null,
          category: 'Unknown',
        })
        setLoading(false)
      })
  }, [address])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <p className="font-mono text-gray-400 animate-pulse text-sm">// LOADING PROJECT…</p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center gap-4 px-4">
        <p className="font-mono text-red-400 text-sm">// PROJECT NOT FOUND</p>
        <p className="font-mono text-gray-500 text-xs text-center">
          {address} is not in Maiat&apos;s registry yet.
        </p>
        <Link href="/explore" className="text-xs font-mono text-[#0052FF] hover:underline">
          ← Browse all projects
        </Link>
      </div>
    )
  }

  if (!project) return null

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col">
      {/* Top bar */}
      <header className="border-b border-[#1a1a1a] px-6 py-4 flex items-center justify-between">
        <Link href="/explore" className="flex items-center gap-2 group">
          <span className="text-[#0052FF] font-mono font-bold text-sm tracking-wider">MAIAT</span>
          <span className="text-gray-600 font-mono text-xs group-hover:text-gray-400 transition-colors">← back</span>
        </Link>
        <span className="font-mono text-xs text-gray-600">// TRUST REVIEW</span>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-start pt-12 px-4 pb-16">
        <div className="w-full max-w-lg">

          {/* Project card */}
          <div className="bg-[#111111] border border-[#222222] rounded-lg p-6 mb-6">
            <div className="flex items-start justify-between gap-4">
              {/* Icon + name */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-[#1a1a1a] border border-[#333] flex items-center justify-center text-xl font-bold text-gray-400">
                  {project.name.charAt(0)}
                </div>
                <div>
                  <h1 className="text-white font-mono font-bold text-lg leading-tight">
                    {project.name}
                    {project.symbol && (
                      <span className="text-gray-500 font-normal text-sm ml-2">${project.symbol}</span>
                    )}
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    <ChainBadge chain={project.chain} />
                    <span className="text-xs font-mono text-gray-600">
                      {project.reviewCount ?? 0} reviews
                    </span>
                  </div>
                </div>
              </div>

              {/* Score */}
              <ScoreBadge score={project.trustScore} />
            </div>

            {project.description && (
              <p className="text-gray-500 font-mono text-xs mt-4 leading-relaxed border-t border-[#222] pt-3">
                {project.description.slice(0, 180)}{project.description.length > 180 ? '…' : ''}
              </p>
            )}

            <div className="mt-3 pt-3 border-t border-[#222] flex items-center gap-1">
              <span className="text-gray-600 font-mono text-xs">contract:</span>
              <span className="text-gray-400 font-mono text-xs">{project.address.slice(0, 10)}…{project.address.slice(-6)}</span>
            </div>
          </div>

          {/* Review section */}
          {reviewed ? (
            <div className="bg-[#0a1a0a] border border-[#22C55E]/30 rounded-lg p-6 text-center">
              <p className="text-[#22C55E] font-mono font-bold mb-1">✅ Review submitted</p>
              <p className="text-gray-500 font-mono text-xs mb-4">Thank you for contributing to the trust network.</p>
              <div className="flex gap-3 justify-center">
                <Link
                  href="/explore"
                  className="text-xs font-mono text-[#0052FF] border border-[#0052FF]/30 hover:bg-[#0052FF]/10 px-4 py-2 rounded transition-colors"
                >
                  Browse more projects
                </Link>
                <button
                  onClick={() => setReviewed(false)}
                  className="text-xs font-mono text-gray-400 border border-[#333] hover:border-gray-500 px-4 py-2 rounded transition-colors"
                >
                  Review again
                </button>
              </div>
            </div>
          ) : !authenticated ? (
            /* Cold-start: not connected */
            <div className="bg-[#111111] border border-[#222222] rounded-lg p-8 text-center">
              <div className="mb-6">
                <p className="text-white font-mono font-bold text-sm mb-2">
                  Connect your wallet to review
                </p>
                <p className="text-gray-500 font-mono text-xs leading-relaxed">
                  Only wallets with on-chain interaction history<br />
                  with this project can submit reviews.
                </p>
              </div>
              <button
                onClick={login}
                className="w-full bg-[#0052FF] hover:bg-[#0040CC] text-white font-mono font-bold text-sm py-3 rounded-lg transition-colors"
              >
                Connect Wallet
              </button>
              <p className="text-gray-600 font-mono text-xs mt-3">
                Powered by Privy · Maiat Protocol
              </p>
            </div>
          ) : (
            /* Connected: show review form */
            <ReviewForm
              projectId={project.address}
              projectName={project.name}
              onSuccess={() => setReviewed(true)}
            />
          )}

          {/* Footer note */}
          <p className="text-center text-gray-700 font-mono text-xs mt-6">
            Reviews are weighted by on-chain interaction depth · -2🪲 Scarab per review
          </p>
        </div>
      </main>
    </div>
  )
}
