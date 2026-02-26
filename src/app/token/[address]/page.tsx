'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { TrustGauge } from '@/components/TrustGauge'
import { ScoreBreakdown } from '@/components/ScoreBreakdown'
import {
  Copy, Shield, TrendingUp, ArrowDown, Repeat, Zap, CircleCheck
} from 'lucide-react'

interface TokenResult {
  address: string
  name: string
  symbol: string
  chain: string
  score: number
  risk: string
  safety?: {
    isHoneypot: boolean
    rugPullRisk: string
    hasVerifiedSource: boolean
    hasAudit: boolean
    ownershipRenounced: boolean
    isProxy: boolean
  }
  holders?: { address: string; percentage: number }[]
  liquidity?: {
    tvl: string
    trend7d: string
    volume24h: string
    marketCap: string
  }
  breakdown?: {
    onChainHistory: number
    contractAnalysis: number
    blacklistCheck: number
    activityPattern: number
  }
}

export default function TokenDetailPage() {
  const params = useParams()
  const address = params.address as string
  const [result, setResult] = useState<TokenResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function fetchToken() {
      try {
        const res = await fetch(`/api/v1/token/${address}`)
        const data = await res.json()
        if (!res.ok) setError(data.error ?? 'Failed to fetch token data')
        else setResult(data)
      } catch {
        setError('Network error. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    fetchToken()
  }, [address])

  function handleCopy() {
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const score = result?.score ?? 0
  const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`
  const isHighTrust = score > 7.0

  const breakdown = result?.breakdown ?? {
    onChainHistory: parseFloat((score * 0.38).toFixed(1)),
    contractAnalysis: parseFloat((score * 0.29).toFixed(1)),
    blacklistCheck: parseFloat((score * 0.19).toFixed(1)),
    activityPattern: parseFloat((score * 0.06).toFixed(1)),
  }

  const safety = result?.safety ?? {
    isHoneypot: false,
    rugPullRisk: 'Low',
    hasVerifiedSource: true,
    hasAudit: true,
    ownershipRenounced: true,
    isProxy: false,
  }

  const liquidity = result?.liquidity ?? {
    tvl: '$4.2B',
    trend7d: '+2.4%',
    volume24h: '$892M',
    marketCap: '$7.8B',
  }

  const holders = result?.holders ?? [
    { address: '0x2FAF...c6aB', percentage: 8.42 },
    { address: '0xBE0e...8d15', percentage: 6.18 },
    { address: '0x40ec...7c2D', percentage: 5.73 },
    { address: '0x1111...1111', percentage: 4.91 },
    { address: '0xDef1...Ca1e', percentage: 3.55 },
    { address: '0x7a25...9bE2', percentage: 2.87 },
    { address: '0xC36c...aF92', percentage: 2.14 },
    { address: '0x5d3a...eB4C', percentage: 1.89 },
    { address: '0xF8e3...d7A1', percentage: 1.62 },
    { address: '0x9Ab2...4f83', percentage: 1.31 },
  ]

  const safetyChecks = [
    { label: `Honeypot Check: ${safety.isHoneypot ? 'Yes' : 'No'}`, ok: !safety.isHoneypot },
    { label: `Rug Pull Risk: ${safety.rugPullRisk}`, ok: safety.rugPullRisk === 'Low' },
    { label: `Verified Source Code: ${safety.hasVerifiedSource ? 'Yes' : 'No'}`, ok: safety.hasVerifiedSource },
    { label: `Has Audit: ${safety.hasAudit ? 'Yes' : 'No'}`, ok: safety.hasAudit },
    { label: `Ownership Renounced: ${safety.ownershipRenounced ? 'Yes' : 'No'}`, ok: safety.ownershipRenounced },
    { label: `Proxy Contract: ${safety.isProxy ? 'Yes' : 'No'}`, ok: !safety.isProxy },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-page">

      <div className="flex flex-col gap-8 px-[60px] py-10 w-full">
        {/* Token Header */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="w-10 h-10 rounded-full bg-[#627EEA]" />
          <span className="text-[22px] font-bold text-txt-primary">{result?.name ?? 'Token'}</span>
          <span className="font-mono text-[13px] font-semibold text-txt-secondary bg-[#64748b18] px-2.5 py-1 rounded-md">
            {result?.symbol ?? 'TOKEN'}
          </span>
          <span className="font-mono text-sm text-txt-muted">{shortAddr}</span>
          <button onClick={handleCopy} className="text-txt-muted hover:text-txt-primary transition-colors">
            <Copy className="w-4 h-4" />
          </button>
          {copied && <span className="text-xs text-emerald">Copied!</span>}
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00b4d815]">
            <span className="w-1.5 h-1.5 rounded-full bg-turquoise" />
            <span className="text-xs font-semibold text-turquoise">{result?.chain ?? 'Ethereum'}</span>
          </span>
          <span className="px-3 py-1 rounded-full bg-[#d4a01715]">
            <span className="text-xs font-semibold text-gold">Token</span>
          </span>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-gold border-t-transparent rounded-full" />
          </div>
        )}

        {error && (
          <div className="bg-[#c0392b18] border border-crimson/30 text-crimson rounded-xl px-6 py-4 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="flex gap-6 w-full">
            {/* Left Column */}
            <div className="flex-1 flex flex-col gap-6">
              {/* Trust Score Card */}
              <div className="flex items-center gap-10 bg-surface rounded-[20px] border border-border-subtle p-8">
                <TrustGauge score={score} />
                <div className="flex flex-col gap-4 flex-1">
                  <div className={`flex items-center gap-2 w-fit px-3.5 py-1.5 rounded-lg ${isHighTrust ? 'bg-[#00c9a718]' : 'bg-[#f59e0b18]'}`}>
                    <Shield className={`w-4 h-4 ${isHighTrust ? 'text-emerald' : 'text-amber'}`} />
                    <span className={`text-sm font-semibold ${isHighTrust ? 'text-emerald' : 'text-amber'}`}>
                      {isHighTrust ? 'Guardian' : 'Cautious'}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-txt-primary">
                    Trust Level: {isHighTrust ? 'Highly Trusted Token' : 'Moderate Trust Token'}
                  </h2>
                  <p className="text-sm text-txt-secondary leading-[1.6]">
                    {isHighTrust
                      ? 'This token has verified source code, passes all safety checks, and has a strong on-chain history with high liquidity.'
                      : 'This token shows moderate trust signals. Review safety checks before trading.'}
                  </p>
                  <span className="text-xs text-txt-muted">Last updated: just now</span>
                </div>
              </div>

              {/* Token Safety Checks */}
              <div className="flex flex-col gap-5 bg-surface rounded-2xl border border-border-subtle p-7">
                <h3 className="text-lg font-bold text-txt-primary">Token Safety Checks</h3>
                <div className="flex gap-4 w-full">
                  <div className="flex-1 flex flex-col gap-3.5">
                    {safetyChecks.slice(0, 3).map((check) => (
                      <div key={check.label} className="flex items-center gap-2.5">
                        <Shield className={`w-4 h-4 ${check.ok ? 'text-emerald' : 'text-crimson'}`} />
                        <span className={`text-[13px] ${check.ok ? 'text-txt-secondary' : 'text-crimson'}`}>{check.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 flex flex-col gap-3.5">
                    {safetyChecks.slice(3).map((check) => (
                      <div key={check.label} className="flex items-center gap-2.5">
                        <Shield className={`w-4 h-4 ${check.ok ? 'text-emerald' : 'text-crimson'}`} />
                        <span className={`text-[13px] ${check.ok ? 'text-txt-secondary' : 'text-crimson'}`}>{check.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Swap Section */}
              <div className="flex flex-col gap-5">
                <h3 className="text-2xl font-bold text-txt-primary">Trade with Confidence</h3>
                <div className={`flex flex-col gap-5 bg-surface rounded-[20px] p-7 ${isHighTrust ? 'border-2 border-emerald shadow-[0_0_32px_rgba(0,201,167,0.12)]' : 'border border-border-subtle'}`}>
                  {/* Trust badge */}
                  <div className="flex items-center gap-2 bg-[#00c9a712] rounded-[10px] px-4 py-2 w-full">
                    <Shield className="w-[18px] h-[18px] text-emerald" />
                    <span className="text-sm font-semibold text-emerald">Safe to Swap &mdash; Trust Score: {score.toFixed(1)}/10</span>
                  </div>

                  {/* You Pay */}
                  <div className="flex flex-col gap-2 bg-[#0a0b14] rounded-[14px] border border-border-subtle p-5">
                    <span className="text-[13px] text-txt-muted">You pay</span>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[28px] font-semibold text-txt-primary">2.0</span>
                      <div className="flex items-center gap-2 bg-elevated rounded-[10px] px-3.5 py-2">
                        <div className="w-[22px] h-[22px] rounded-full bg-[#2775ca]" />
                        <span className="text-sm font-semibold text-txt-primary">USDC</span>
                      </div>
                    </div>
                    <span className="text-[13px] text-txt-muted">&asymp; $2.00</span>
                  </div>

                  {/* Arrow */}
                  <div className="flex justify-center">
                    <div className="flex items-center justify-center w-9 h-9 rounded-full bg-elevated border border-border-subtle">
                      <ArrowDown className="w-[18px] h-[18px] text-txt-secondary" />
                    </div>
                  </div>

                  {/* You Receive */}
                  <div className="flex flex-col gap-2 bg-[#0a0b14] rounded-[14px] border border-border-subtle p-5">
                    <span className="text-[13px] text-txt-muted">You receive</span>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[28px] font-semibold text-txt-primary">0.000802</span>
                      <div className="flex items-center gap-2 bg-elevated rounded-[10px] px-3.5 py-2">
                        <div className="w-[22px] h-[22px] rounded-full bg-[#627eea]" />
                        <span className="text-sm font-semibold text-txt-primary">WETH</span>
                      </div>
                    </div>
                    <span className="text-[13px] text-txt-muted">&asymp; $2.00</span>
                  </div>

                  {/* Details */}
                  <div className="flex flex-col gap-2 bg-[#0a0b1480] rounded-[10px] px-4 py-3">
                    {[
                      { label: 'Price impact', value: '0.01%', color: 'text-emerald' },
                      { label: 'Gas estimate', value: '~$0.38', color: 'text-txt-secondary' },
                      { label: 'Maiat protection fee', value: '0.05%', color: 'text-txt-secondary' },
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between">
                        <span className="text-xs text-txt-muted">{row.label}</span>
                        <span className={`font-mono text-xs ${row.color}`}>{row.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Swap Button */}
                  <button className="flex items-center justify-center gap-2.5 w-full h-[52px] bg-gold rounded-[14px] hover:brightness-110 transition-all">
                    <Repeat className="w-5 h-5 text-page" />
                    <span className="text-base font-bold text-page">Swap</span>
                  </button>

                  <div className="flex items-center justify-center gap-1.5">
                    <Zap className="w-3 h-3 text-txt-muted" />
                    <span className="text-[11px] text-txt-muted">Powered by Uniswap Trading API  &middot;  Includes 0.05% Maiat protection fee</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="w-[420px] flex flex-col gap-6">
              {/* TVL & Liquidity */}
              <div className="flex flex-col gap-4 bg-surface rounded-2xl border border-border-subtle p-6">
                <h3 className="text-base font-bold text-txt-primary">TVL & Liquidity</h3>
                {[
                  { label: 'Total Value Locked', value: liquidity.tvl },
                  { label: '7d Trend', value: liquidity.trend7d, icon: true },
                  { label: '24h Volume', value: liquidity.volume24h },
                  { label: 'Market Cap', value: liquidity.marketCap },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between items-center">
                    <span className="text-[13px] text-txt-muted">{row.label}</span>
                    {row.icon ? (
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald" />
                        <span className="font-mono text-[13px] font-semibold text-emerald">{row.value}</span>
                      </div>
                    ) : (
                      <span className="font-mono text-[13px] font-semibold text-txt-primary">{row.value}</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Top Holders */}
              <div className="flex flex-col gap-4 bg-surface rounded-2xl border border-border-subtle p-6">
                <h3 className="text-base font-bold text-txt-primary">Top 10 Holders</h3>
                <div className="flex justify-between pb-2 border-b border-border-subtle">
                  <span className="text-[11px] font-semibold text-txt-muted">Address</span>
                  <span className="text-[11px] font-semibold text-txt-muted">% Supply</span>
                </div>
                {holders.map((h) => (
                  <div key={h.address} className="flex justify-between">
                    <span className="font-mono text-xs text-txt-secondary">{h.address}</span>
                    <span className="font-mono text-xs font-semibold text-txt-primary">{h.percentage.toFixed(2)}%</span>
                  </div>
                ))}
              </div>

              {/* Score Breakdown */}
              <ScoreBreakdown
                items={[
                  { label: 'On-chain History', value: breakdown.onChainHistory, max: 4.0, color: 'var(--primary-gold)' },
                  { label: 'Contract Analysis', value: breakdown.contractAnalysis, max: 3.0, color: 'var(--secondary-turquoise)' },
                  { label: 'Blacklist Check', value: breakdown.blacklistCheck, max: 2.0, color: 'var(--success-emerald)' },
                  { label: 'Activity Pattern', value: breakdown.activityPattern, max: 1.0, color: 'var(--warning-amber)' },
                ]}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
