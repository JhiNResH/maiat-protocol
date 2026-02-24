'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Header } from '@/components/Header'
import { TrustGauge } from '@/components/TrustGauge'
import { ScoreBreakdown } from '@/components/ScoreBreakdown'
import {
  Copy, ShieldCheck, Shield, FileCheck, Ban, CircleCheck,
  ArrowLeftRight, Repeat, Zap, ChevronDown
} from 'lucide-react'

interface ScoreResult {
  address: string
  score: number
  risk: string
  type: string
  flags: string[]
  details: {
    txCount: number
    isContract: boolean
    isKnownScam: boolean
    walletAge?: string
    balance?: string
    lastActive?: string
  }
  breakdown?: {
    onChainHistory: number
    contractAnalysis: number
    blacklistCheck: number
    activityPattern: number
  }
}

function tierLabel(score: number) {
  if (score > 700) return { label: 'Guardian', color: 'text-emerald', bg: 'bg-[#00c9a718]', icon: ShieldCheck }
  if (score > 400) return { label: 'Cautious', color: 'text-amber', bg: 'bg-[#f59e0b18]', icon: Shield }
  if (score > 100) return { label: 'Risky', color: 'text-crimson', bg: 'bg-[#c0392b18]', icon: Shield }
  return { label: 'Unscored', color: 'text-txt-muted', bg: 'bg-[#64748b18]', icon: Shield }
}

function trustDescription(score: number) {
  if (score > 700) return 'This address demonstrates strong on-chain history, verified contract interactions, and clean blacklist records.'
  if (score > 400) return 'This address shows moderate on-chain activity. Some risk factors detected. Proceed with caution.'
  if (score > 100) return 'This address has limited history or flagged risk indicators. Exercise extreme caution with any interactions.'
  return 'This address has not been scored yet. No trust data is available.'
}

export default function AddressDetailPage() {
  const params = useParams()
  const address = params.address as string
  const [result, setResult] = useState<ScoreResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function fetchScore() {
      try {
        const res = await fetch(`/api/v1/score/${address}`)
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Failed to fetch score')
        } else {
          setResult(data)
        }
      } catch {
        setError('Network error. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    fetchScore()
  }, [address])

  function handleCopy() {
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shortAddr = `${address.slice(0, 12)}...${address.slice(-6)}`
  const score = result?.score ?? 0
  const tier = tierLabel(score)
  const TierIcon = tier.icon

  const breakdown = result?.breakdown ?? {
    onChainHistory: Math.round(score * 0.4),
    contractAnalysis: Math.round(score * 0.31),
    blacklistCheck: Math.round(score * 0.21),
    activityPattern: Math.round(score * 0.08),
  }

  const flags = result?.flags ?? []
  const isHighTrust = score > 700
  const isMedTrust = score > 400 && score <= 700
  const flagColor = isHighTrust ? 'text-emerald' : isMedTrust ? 'text-amber' : 'text-crimson'
  const flagBg = isHighTrust ? 'bg-[#00c9a712]' : isMedTrust ? 'bg-[#f59e0b12]' : 'bg-[#c0392b12]'

  return (
    <div className="flex flex-col min-h-screen bg-page">
      <Header />

      <div className="flex flex-col gap-8 px-[60px] py-10 w-full">
        {/* Address Header */}
        <div className="flex items-center gap-4 w-full">
          <span className="font-mono text-[22px] font-semibold text-txt-primary">{shortAddr}</span>
          <button onClick={handleCopy} className="text-txt-muted hover:text-txt-primary transition-colors">
            <Copy className="w-[18px] h-[18px]" />
          </button>
          {copied && <span className="text-xs text-emerald">Copied!</span>}
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00b4d815]">
            <span className="w-1.5 h-1.5 rounded-full bg-turquoise" />
            <span className="text-xs font-semibold text-turquoise">Base</span>
          </span>
          <span className="px-3 py-1 rounded-full bg-[#d4a01715]">
            <span className="text-xs font-semibold text-gold">{result?.type === 'contract' ? 'Contract' : 'Wallet'}</span>
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

        {result && (
          <div className="flex gap-6 w-full">
            {/* Left Column */}
            <div className="flex-1 flex flex-col gap-6">
              {/* Trust Score Card */}
              <div className="flex items-center gap-10 bg-surface rounded-[20px] border border-border-subtle p-8">
                <TrustGauge score={score} />
                <div className="flex flex-col gap-4 flex-1">
                  <div className={`flex items-center gap-2 w-fit px-3.5 py-1.5 rounded-lg ${tier.bg}`}>
                    <TierIcon className={`w-4 h-4 ${tier.color}`} />
                    <span className={`text-sm font-semibold ${tier.color}`}>{tier.label}</span>
                  </div>
                  <h2 className="text-xl font-bold text-txt-primary">
                    Trust Level: {score > 700 ? 'Highly Trusted' : score > 400 ? 'Moderate Trust' : score > 100 ? 'Low Trust' : 'Unscored'}
                  </h2>
                  <p className="text-sm text-txt-secondary leading-[1.6]">{trustDescription(score)}</p>
                  <span className="text-xs text-txt-muted">Last updated: just now</span>
                </div>
              </div>

              {/* Swap Card */}
              <div className="flex flex-col gap-4">
                <h3 className="text-2xl font-bold text-txt-primary">Trade with Confidence</h3>
                <SwapCard address={address} score={score} />
              </div>
            </div>

            {/* Right Column */}
            <div className="w-[420px] flex flex-col gap-6">
              {/* Status Flags */}
              <div className="flex flex-col gap-4 bg-surface rounded-2xl border border-border-subtle p-6">
                <h3 className="text-base font-bold text-txt-primary">Status Flags</h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    { icon: Shield, label: flags.includes('verified') ? 'Verified' : 'Unverified', positive: !flags.includes('unverified') },
                    { icon: FileCheck, label: flags.includes('has_audit') ? 'Has Audit' : 'No Audit', positive: flags.includes('has_audit') || isHighTrust },
                    { icon: Ban, label: result.details.isKnownScam ? 'Blacklisted' : 'Not Blacklisted', positive: !result.details.isKnownScam },
                    { icon: Shield, label: 'No Honeypot', positive: isHighTrust },
                  ].map((flag) => (
                    <div
                      key={flag.label}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${flag.positive ? flagBg : 'bg-[#c0392b12]'}`}
                    >
                      <flag.icon className={`w-3.5 h-3.5 ${flag.positive ? flagColor : 'text-crimson'}`} />
                      <span className={`text-xs font-medium ${flag.positive ? flagColor : 'text-crimson'}`}>{flag.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Score Breakdown */}
              <ScoreBreakdown
                items={[
                  { label: 'On-chain History', value: breakdown.onChainHistory, max: 400, color: 'var(--primary-gold)' },
                  { label: 'Contract Analysis', value: breakdown.contractAnalysis, max: 300, color: 'var(--secondary-turquoise)' },
                  { label: 'Blacklist Check', value: breakdown.blacklistCheck, max: 200, color: 'var(--success-emerald)' },
                  { label: 'Activity Pattern', value: breakdown.activityPattern, max: 100, color: 'var(--warning-amber)' },
                ]}
              />

              {/* Address Details */}
              <div className="flex flex-col gap-4 bg-surface rounded-2xl border border-border-subtle p-6">
                <h3 className="text-base font-bold text-txt-primary">Address Details</h3>
                {[
                  { label: 'Wallet Age', value: result.details.walletAge ?? 'Unknown' },
                  { label: 'Transaction Count', value: result.details.txCount.toLocaleString() },
                  { label: 'Balance', value: result.details.balance ?? 'N/A' },
                  { label: 'Last Active', value: result.details.lastActive ?? 'N/A' },
                  { label: 'Is Contract', value: result.details.isContract ? 'Yes' : 'No', color: result.details.isContract ? undefined : 'text-emerald' },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between">
                    <span className="text-[13px] text-txt-muted">{row.label}</span>
                    <span className={`font-mono text-[13px] ${row.color ?? 'text-txt-primary'}`}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* Embedded Swap Card for Address Detail */
function SwapCard({ address, score }: { address: string; score: number }) {
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [quoteResult, setQuoteResult] = useState<{ amountOut: string; gasFeeUSD: string; routeString: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleQuote() {
    if (!amount.trim()) return
    setLoading(true)
    setError(null)
    setQuoteResult(null)
    try {
      const res = await fetch('/api/v1/swap/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          swapper: address,
          tokenIn: '0x0000000000000000000000000000000000000000',
          tokenOut: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          amount: amount.trim(),
          chainId: 8453,
        }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Failed')
      else setQuoteResult(data.quote)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 bg-surface rounded-[20px] border border-border-subtle p-6 shadow-[0_0_40px_rgba(212,160,23,0.08)]">
      {/* Token Pair */}
      <div className="flex items-center gap-3 w-full">
        <div className="flex-1 flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-txt-muted tracking-[0.5px]">You Pay</span>
          <div className="flex items-center justify-between bg-elevated rounded-[10px] border border-border-subtle px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <div className="w-[22px] h-[22px] rounded-full bg-[#627eea]" />
              <span className="text-sm font-semibold text-txt-primary">ETH</span>
            </div>
            <ChevronDown className="w-4 h-4 text-txt-muted" />
          </div>
        </div>
        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-elevated border border-border-subtle mt-5">
          <ArrowLeftRight className="w-4 h-4 text-gold" />
        </div>
        <div className="flex-1 flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-txt-muted tracking-[0.5px]">You Receive</span>
          <div className="flex items-center justify-between bg-elevated rounded-[10px] border border-border-subtle px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <div className="w-[22px] h-[22px] rounded-full bg-[#2775ca]" />
              <span className="text-sm font-semibold text-txt-primary">USDC</span>
            </div>
            <ChevronDown className="w-4 h-4 text-txt-muted" />
          </div>
        </div>
      </div>

      {/* Amount */}
      <div className="flex flex-col gap-2 bg-[#0a0b14] rounded-[14px] border border-border-subtle p-5">
        <span className="text-[11px] font-semibold text-txt-muted tracking-[0.5px]">Amount</span>
        <input
          type="text"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.0"
          className="bg-transparent font-mono text-[32px] font-semibold text-txt-primary placeholder-txt-primary/40 outline-none"
        />
        <span className="text-[13px] text-txt-muted">&asymp; 0.00 USDC</span>
      </div>

      {/* Trust badges */}
      <div className="flex gap-2.5">
        <div className="flex-1 flex items-center gap-2 bg-[#00c9a710] border border-[#00c9a730] rounded-[10px] px-3.5 py-2.5">
          <CircleCheck className="w-3.5 h-3.5 text-emerald" />
          <span className="text-xs font-semibold text-emerald">ETH  &check;  8.5/10</span>
        </div>
        <div className="flex-1 flex items-center gap-2 bg-[#00c9a710] border border-[#00c9a730] rounded-[10px] px-3.5 py-2.5">
          <CircleCheck className="w-3.5 h-3.5 text-emerald" />
          <span className="text-xs font-semibold text-emerald">USDC  &check;  9.2/10</span>
        </div>
      </div>

      {/* Gas/Route */}
      <div className="flex justify-between">
        <span className="text-xs text-txt-muted">Est. Gas: $0.01</span>
        <span className="text-xs text-txt-muted">Route: UniswapX</span>
      </div>

      {error && <div className="text-xs text-crimson">{error}</div>}
      {quoteResult && (
        <div className="text-xs text-emerald font-mono">
          Output: {quoteResult.amountOut} | Gas: ${quoteResult.gasFeeUSD}
        </div>
      )}

      {/* Swap Button */}
      <button
        onClick={handleQuote}
        disabled={loading || !amount.trim()}
        className="flex items-center justify-center gap-2.5 w-full h-[52px] bg-gold rounded-[14px] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        <Repeat className="w-5 h-5 text-page" />
        <span className="text-base font-bold text-page">{loading ? 'Getting Quote...' : 'Swap'}</span>
      </button>

      {/* Powered by */}
      <div className="flex items-center justify-center gap-1.5">
        <Zap className="w-3 h-3 text-txt-muted" />
        <span className="text-[11px] text-txt-muted">Powered by Uniswap Trading API  &middot;  0.05% Maiat fee</span>
      </div>
    </div>
  )
}

