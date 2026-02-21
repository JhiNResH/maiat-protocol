'use client'

import { useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { ArrowDown, Shield, AlertTriangle, Loader2, Settings, ChevronDown, X, Check } from 'lucide-react'
import Link from 'next/link'

const POPULAR_TOKENS = [
  { symbol: 'ETH', name: 'Ethereum', address: '0x0000000000000000000000000000000000000000', decimals: 18, color: '#627EEA' },
  { symbol: 'USDC', name: 'USD Coin', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, color: '#2775CA' },
  { symbol: 'WETH', name: 'Wrapped ETH', address: '0x4200000000000000000000000000000000000006', decimals: 18, color: '#627EEA' },
  { symbol: 'DAI', name: 'Dai', address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', decimals: 18, color: '#F5AC37' },
  { symbol: 'cbBTC', name: 'Coinbase BTC', address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', decimals: 8, color: '#F7931A' },
  { symbol: 'AERO', name: 'Aerodrome', address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631', decimals: 18, color: '#0052FF' },
  { symbol: 'DEGEN', name: 'Degen', address: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed', decimals: 18, color: '#A855F7' },
  { symbol: 'USDT', name: 'Tether', address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', decimals: 6, color: '#26A17B' },
]

function TokenIcon({ symbol, color, size = 32 }: { symbol: string; color: string; size?: number }) {
  return (
    <div
      style={{ width: size, height: size, background: color, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
    >
      <span style={{ color: 'white', fontWeight: 700, fontSize: size * 0.35, letterSpacing: '-0.5px' }}>
        {symbol.slice(0, 2)}
      </span>
    </div>
  )
}

function TokenSelectModal({
  open,
  onClose,
  onSelect,
  exclude,
}: {
  open: boolean
  onClose: () => void
  onSelect: (t: typeof POPULAR_TOKENS[0]) => void
  exclude: string
}) {
  const [search, setSearch] = useState('')
  if (!open) return null
  const filtered = POPULAR_TOKENS.filter(
    t => t.symbol !== exclude && (
      t.symbol.toLowerCase().includes(search.toLowerCase()) ||
      t.name.toLowerCase().includes(search.toLowerCase())
    )
  )
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm rounded-3xl border border-[#2a2a2e] overflow-hidden"
        style={{ background: '#191919' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <span className="text-white font-semibold text-lg">Select token</span>
          <button onClick={onClose} className="text-[#6b6b70] hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name or address"
            className="w-full px-4 py-3 rounded-2xl text-sm text-white placeholder-[#6b6b70] outline-none border border-[#2a2a2e] focus:border-[#3a3a3e] transition-colors"
            style={{ background: '#0a0a0b' }}
          />
        </div>

        {/* Token List */}
        <div className="px-2 pb-4 max-h-[320px] overflow-y-auto">
          {filtered.map(t => (
            <button
              key={t.symbol}
              onClick={() => { onSelect(t); onClose() }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-white/5 transition-colors text-left"
            >
              <TokenIcon symbol={t.symbol} color={t.color} size={36} />
              <div>
                <div className="text-white font-semibold text-sm">{t.symbol}</div>
                <div className="text-[#6b6b70] text-xs">{t.name}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

interface QuoteResult {
  allowed: boolean
  trustScore?: number
  riskLevel?: string
  warning?: string
  quote?: any
  error?: string
}

export default function SwapPage() {
  const { authenticated, user, login, logout } = usePrivy()
  const [tokenIn, setTokenIn] = useState(POPULAR_TOKENS[0])
  const [tokenOut, setTokenOut] = useState(POPULAR_TOKENS[1])
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<QuoteResult | null>(null)
  const [modalFor, setModalFor] = useState<'in' | 'out' | null>(null)

  const address = user?.wallet?.address

  const handleQuote = async () => {
    if (!amount || !address) return
    setLoading(true)
    setResult(null)
    try {
      const amountWei = BigInt(Math.floor(parseFloat(amount) * (10 ** tokenIn.decimals))).toString()
      const res = await fetch('/api/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenIn: tokenIn.address,
          tokenOut: tokenOut.address,
          amount: amountWei,
          chainId: 8453,
          swapper: address,
          type: 'EXACT_INPUT',
        }),
      })
      const data = await res.json()
      setResult(data)
    } catch (e: any) {
      setResult({ allowed: false, error: e.message })
    } finally {
      setLoading(false)
    }
  }

  const swapTokens = () => {
    const temp = tokenIn
    setTokenIn(tokenOut)
    setTokenOut(temp)
    setResult(null)
  }

  const outputAmount = result?.quote?.quote?.output?.amount
    ? (Number(result.quote.quote.output.amount) / (10 ** tokenOut.decimals)).toFixed(4)
    : ''

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex flex-col items-center justify-start pt-24 px-4">
      <TokenSelectModal
        open={modalFor === 'in'}
        onClose={() => setModalFor(null)}
        onSelect={t => { setTokenIn(t); setResult(null) }}
        exclude={tokenOut.symbol}
      />
      <TokenSelectModal
        open={modalFor === 'out'}
        onClose={() => setModalFor(null)}
        onSelect={t => { setTokenOut(t); setResult(null) }}
        exclude={tokenIn.symbol}
      />

      <div className="w-full max-w-[480px]">
        {/* Tabs */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1 bg-[#111113] rounded-2xl p-1">
            <button className="px-4 py-2 rounded-xl bg-[#1f1f23] text-white text-sm font-semibold">Swap</button>
            <Link href="/m/ai-agents">
              <button className="px-4 py-2 rounded-xl text-[#6b6b70] hover:text-white text-sm font-semibold transition-colors">Explore</button>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            {authenticated ? (
              <button onClick={logout} className="px-3 py-1.5 rounded-xl bg-[#1f1f23] text-xs font-mono text-zinc-300 hover:bg-[#2a2a2e] transition-colors">
                {address ? `${address.slice(0,6)}...${address.slice(-4)}` : 'Connected'}
              </button>
            ) : (
              <button onClick={login} className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white transition-colors">
                Connect
              </button>
            )}
            <button className="p-2 rounded-xl hover:bg-white/5 text-[#6b6b70] hover:text-white transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Card */}
        <div className="rounded-3xl border border-[#1f1f23] p-2" style={{ background: '#111113' }}>
          {/* Token In */}
          <div className="rounded-2xl p-4 mb-1" style={{ background: '#191919' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[#6b6b70] text-sm">You pay</span>
              {address && (
                <span className="text-[#6b6b70] text-xs">Balance: —</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={amount}
                onChange={e => { setAmount(e.target.value); setResult(null) }}
                placeholder="0"
                className="flex-1 bg-transparent text-4xl font-semibold text-white outline-none placeholder-[#2a2a2e] min-w-0"
                style={{ WebkitAppearance: 'none' }}
              />
              <button
                onClick={() => setModalFor('in')}
                className="flex items-center gap-2 px-3 py-2 rounded-2xl font-semibold text-white text-sm transition-all hover:opacity-80 flex-shrink-0"
                style={{ background: tokenIn.color + '22', border: `1px solid ${tokenIn.color}44` }}
              >
                <TokenIcon symbol={tokenIn.symbol} color={tokenIn.color} size={22} />
                {tokenIn.symbol}
                <ChevronDown className="w-4 h-4 text-[#6b6b70]" />
              </button>
            </div>
            {amount && (
              <div className="text-[#6b6b70] text-sm mt-2">≈ $—</div>
            )}
          </div>

          {/* Swap arrow */}
          <div className="flex justify-center -my-1 relative z-10">
            <button
              onClick={swapTokens}
              className="w-10 h-10 rounded-2xl border-2 border-[#111113] flex items-center justify-center hover:scale-110 transition-transform"
              style={{ background: '#1f1f23' }}
            >
              <ArrowDown className="w-4 h-4 text-[#6b6b70]" />
            </button>
          </div>

          {/* Token Out */}
          <div className="rounded-2xl p-4 mt-1" style={{ background: '#191919' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[#6b6b70] text-sm">You receive</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex-1 text-4xl font-semibold min-w-0 truncate" style={{ color: outputAmount ? 'white' : '#2a2a2e' }}>
                {outputAmount || '0'}
              </span>
              <button
                onClick={() => setModalFor('out')}
                className="flex items-center gap-2 px-3 py-2 rounded-2xl font-semibold text-white text-sm transition-all hover:opacity-80 flex-shrink-0"
                style={{ background: tokenOut.color + '22', border: `1px solid ${tokenOut.color}44` }}
              >
                <TokenIcon symbol={tokenOut.symbol} color={tokenOut.color} size={22} />
                {tokenOut.symbol}
                <ChevronDown className="w-4 h-4 text-[#6b6b70]" />
              </button>
            </div>
            {outputAmount && (
              <div className="text-[#6b6b70] text-sm mt-2">≈ $—</div>
            )}
          </div>

          {/* Trust Score Banner (inside card) */}
          {result && (
            <div className={`mt-2 mx-0 rounded-2xl p-3 flex items-start gap-3 ${
              result.allowed
                ? result.warning
                  ? 'bg-yellow-500/10 border border-yellow-500/20'
                  : 'bg-green-500/10 border border-green-500/20'
                : 'bg-red-500/10 border border-red-500/20'
            }`}>
              {result.allowed ? (
                result.warning
                  ? <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                  : <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
              ) : (
                <Shield className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-semibold ${
                    result.allowed
                      ? result.warning ? 'text-yellow-400' : 'text-green-400'
                      : 'text-red-400'
                  }`}>
                    {result.allowed ? (result.warning ? 'Proceed with caution' : 'Safe to swap') : 'Swap blocked'}
                  </span>
                  {result.trustScore !== undefined && (
                    <span className="text-[#6b6b70] text-xs flex-shrink-0">
                      Trust {result.trustScore}/100
                    </span>
                  )}
                </div>
                {(result.warning || result.error) && (
                  <p className="text-xs text-[#8b8b90] mt-1">{result.warning || result.error}</p>
                )}
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="mt-2">
            {!authenticated ? (
              <button
                onClick={login}
                className="w-full py-4 rounded-2xl font-bold text-base text-white transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
              >
                Connect Wallet
              </button>
            ) : (
              <button
                onClick={handleQuote}
                disabled={loading || !amount}
                className="w-full py-4 rounded-2xl font-bold text-base text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{
                  background: result?.allowed
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Checking trust score...
                  </>
                ) : result?.allowed ? (
                  `Swap ${tokenIn.symbol} → ${tokenOut.symbol}`
                ) : (
                  'Get quote'
                )}
              </button>
            )}
          </div>
        </div>

        {/* Trust layer info */}
        <div className="mt-3 flex items-center justify-center gap-2 text-[#4b4b50] text-xs">
          <Shield className="w-3 h-3" />
          <span>Trust-gated by Maiat · Powered by Uniswap API on Base</span>
        </div>
      </div>
    </div>
  )
}
