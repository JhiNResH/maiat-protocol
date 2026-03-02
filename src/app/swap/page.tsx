'use client'

import { useState } from 'react'
import {
  Wallet, ChevronDown, ArrowLeftRight, CircleCheck, Repeat, Zap
} from 'lucide-react'
import { Header } from '@/components/Header'

interface QuoteData {
  quote: {
    amountIn: string
    amountOut: string
    gasFeeUSD: string
    routeString: string
    tokenIn: string
    tokenOut: string
    chainId: number
    quoteId: string
    swapper: string
    requestId: string
    slippage: { tolerance: number }
    route: unknown[]
    gasFee: string
    permitData: Record<string, unknown> | null
  }
  trust: {
    tokenIn: { score: number; risk: string } | null
    tokenOut: { score: number; risk: string } | null
  }
}

const TOKENS = [
  { symbol: 'ETH', address: '0x0000000000000000000000000000000000000000', color: '#627eea', decimals: 18 },
  { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', color: '#2775ca', decimals: 6 },
  { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006', color: '#627eea', decimals: 18 },
]

export default function SwapPage() {
  const [swapper, setSwapper] = useState('')
  const [tokenInIdx, setTokenInIdx] = useState(0)
  const [tokenOutIdx, setTokenOutIdx] = useState(1)
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [quote, setQuote] = useState<QuoteData | null>(null)
  const [swapTx, setSwapTx] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [trustWarning, setTrustWarning] = useState<{ verdict: string; score: number; tokenSymbol: string } | null>(null)

  const tokenIn = TOKENS[tokenInIdx]
  const tokenOut = TOKENS[tokenOutIdx]

  async function handleQuote() {
    if (!swapper.trim() || !amount.trim()) return
    setLoading(true)
    setQuote(null)
    setSwapTx(null)
    setError(null)
    setTrustWarning(null)

    // Pre-flight trust check on tokenOut
    try {
      const trustRes = await fetch(`/api/v1/token/${tokenOut.address}`)
      if (trustRes.ok) {
        const trustData = await trustRes.json()
        const verdict = trustData.verdict as string | undefined
        const score = trustData.trustScore as number | undefined
        if (verdict === 'avoid') {
          setTrustWarning({ verdict: 'avoid', score: score ?? 0, tokenSymbol: tokenOut.symbol })
          setLoading(false)
          return
        }
        if (verdict === 'caution') {
          setTrustWarning({ verdict: 'caution', score: score ?? 0, tokenSymbol: tokenOut.symbol })
        }
      }
    } catch {
      // Trust check failure is non-blocking
    }

    try {
      const res = await fetch('/api/v1/swap/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          swapper: swapper.trim(),
          tokenIn: tokenIn.address,
          tokenOut: tokenOut.address,
          amount: amount.trim(),
          chainId: 8453,
        }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Failed to get quote')
      else setQuote(data)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSwap() {
    if (!quote) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quote.quote),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Failed to build swap tx')
      else setSwapTx(data.swap)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function flipTokens() {
    setTokenInIdx(tokenOutIdx)
    setTokenOutIdx(tokenInIdx)
    setQuote(null)
    setSwapTx(null)
    setTrustWarning(null)
  }

  return (
    <div className="flex flex-col min-h-screen bg-page">
      <Header />

      <div className="flex flex-col items-center gap-8 py-[60px] w-full">
        <h1 className="text-[36px] font-bold text-txt-primary">Trust-Gated Swap</h1>
        <p className="text-base text-txt-secondary">Swap tokens with on-chain trust intelligence. Every trade is scored.</p>

        {/* Swap Card */}
        <div className="flex flex-col gap-4 w-[480px] bg-surface rounded-[20px] border border-border-subtle p-7 shadow-[0_0_60px_rgba(212,160,23,0.06)]">
          {/* Wallet Address */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-txt-muted tracking-[0.5px]">Wallet Address</span>
            <div className="flex items-center gap-2 bg-elevated rounded-[10px] border border-border-subtle px-4 py-3">
              <Wallet className="w-4 h-4 text-txt-muted" />
              <input
                type="text"
                value={swapper}
                onChange={(e) => setSwapper(e.target.value)}
                placeholder="0x..."
                className="bg-transparent font-mono text-sm text-txt-primary placeholder-txt-muted/50 outline-none flex-1"
                spellCheck={false}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="w-full h-px bg-border-subtle" />

          {/* Token Pair */}
          <div className="flex items-center gap-3">
            <div className="flex-1 flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-txt-muted tracking-[0.5px]">You Pay</span>
              <div className="flex items-center justify-between bg-elevated rounded-[10px] border border-border-subtle px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-[22px] h-[22px] rounded-full" style={{ backgroundColor: tokenIn.color }} />
                  <span className="text-sm font-semibold text-txt-primary">{tokenIn.symbol}</span>
                </div>
                <ChevronDown className="w-4 h-4 text-txt-muted" />
              </div>
            </div>
            <button
              onClick={flipTokens}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-elevated border border-border-subtle mt-5 hover:border-gold/50 transition-colors"
            >
              <ArrowLeftRight className="w-4 h-4 text-gold" />
            </button>
            <div className="flex-1 flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-txt-muted tracking-[0.5px]">You Receive</span>
              <div className="flex items-center justify-between bg-elevated rounded-[10px] border border-border-subtle px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-[22px] h-[22px] rounded-full" style={{ backgroundColor: tokenOut.color }} />
                  <span className="text-sm font-semibold text-txt-primary">{tokenOut.symbol}</span>
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
            <span className="text-[13px] text-txt-muted">&asymp; 0.00 {tokenOut.symbol}</span>
          </div>

          {/* Trust Badges */}
          <div className="flex gap-2.5">
            <div className="flex-1 flex items-center gap-2 bg-[#00c9a710] border border-[#00c9a730] rounded-[10px] px-3.5 py-2.5">
              <CircleCheck className="w-3.5 h-3.5 text-emerald" />
              <span className="text-xs font-semibold text-emerald">{tokenIn.symbol}  &check;  8.5/10</span>
            </div>
            <div className="flex-1 flex items-center gap-2 bg-[#00c9a710] border border-[#00c9a730] rounded-[10px] px-3.5 py-2.5">
              <CircleCheck className="w-3.5 h-3.5 text-emerald" />
              <span className="text-xs font-semibold text-emerald">{tokenOut.symbol}  &check;  9.2/10</span>
            </div>
          </div>

          {/* Gas/Route */}
          <div className="flex justify-between">
            <span className="text-xs text-txt-muted">Est. Gas: $0.01</span>
            <span className="text-xs text-txt-muted">Route: UniswapX</span>
          </div>

          {/* Trust warning */}
          {trustWarning?.verdict === 'avoid' && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5">
              <span className="text-base">🚫</span>
              <span><strong>{trustWarning.tokenSymbol}</strong> flagged as high risk (score {trustWarning.score}/100). Swap disabled for your protection.</span>
            </div>
          )}
          {trustWarning?.verdict === 'caution' && (
            <div className="flex items-center gap-2 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2.5">
              <span className="text-base">⚠️</span>
              <span><strong>{trustWarning.tokenSymbol}</strong> has a low trust score ({trustWarning.score}/100). Proceed with caution.</span>
            </div>
          )}

          {error && <div className="text-xs text-crimson bg-[#c0392b12] rounded-lg px-3 py-2">{error}</div>}

          {/* Quote result */}
          {quote && !swapTx && (
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-txt-muted">Output:</span>
                <span className="font-mono text-emerald">{quote.quote.amountOut}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-txt-muted">Gas:</span>
                <span className="font-mono text-txt-secondary">${quote.quote.gasFeeUSD}</span>
              </div>
            </div>
          )}

          {/* Swap Button */}
          <button
            onClick={quote && !swapTx ? handleSwap : handleQuote}
            disabled={loading || !swapper.trim() || !amount.trim() || trustWarning?.verdict === 'avoid'}
            className="flex items-center justify-center gap-2.5 w-full h-[52px] bg-gold rounded-[14px] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Repeat className="w-5 h-5 text-page" />
            <span className="text-base font-bold text-page">
              {loading ? (quote ? 'Building Tx...' : 'Getting Quote...') : (quote && !swapTx ? 'Execute Swap' : 'Swap')}
            </span>
          </button>

          {/* Powered by */}
          <div className="flex items-center justify-center gap-1.5">
            <Zap className="w-3 h-3 text-txt-muted" />
            <span className="text-[11px] text-txt-muted">Powered by Uniswap Trading API  &middot;  0.05% Maiat fee</span>
          </div>
        </div>

        {/* Transaction Result */}
        {swapTx && (
          <div className="flex flex-col w-[480px] bg-[#0d0e1a] rounded-2xl border border-border-subtle overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle">
              <div className="w-2 h-2 rounded-full bg-gold" />
              <span className="text-[13px] font-semibold text-gold-light">Sign this transaction with your wallet</span>
            </div>
            <div className="flex flex-col gap-0.5 px-5 py-4">
              <code className="font-mono text-xs text-txt-secondary">{'{'}</code>
              {Object.entries(swapTx).slice(0, 6).map(([key, val]) => (
                <code key={key} className="font-mono text-xs text-txt-muted">
                  {'  '}&quot;{key}&quot;: {JSON.stringify(val)},
                </code>
              ))}
              <code className="font-mono text-xs text-txt-secondary">{'}'}</code>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
