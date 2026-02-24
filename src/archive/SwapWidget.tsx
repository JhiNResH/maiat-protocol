'use client'

import { useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { ArrowDown, Shield, AlertTriangle, Loader2, ChevronDown, X, Check } from 'lucide-react'

const TOKENS = [
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
    <div style={{ width: size, height: size, background: color, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ color: 'white', fontWeight: 700, fontSize: size * 0.35 }}>{symbol.slice(0, 2)}</span>
    </div>
  )
}

function TokenModal({ open, onClose, onSelect, exclude }: { open: boolean; onClose: () => void; onSelect: (t: typeof TOKENS[0]) => void; exclude: string }) {
  const [search, setSearch] = useState('')
  if (!open) return null
  const filtered = TOKENS.filter(t => t.symbol !== exclude && (t.symbol.toLowerCase().includes(search.toLowerCase()) || t.name.toLowerCase().includes(search.toLowerCase())))
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm rounded-3xl border border-gray-700 dark:border-[#2a2a2e] overflow-hidden bg-white dark:bg-[#191919]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <span className="text-gray-900 dark:text-white font-semibold text-lg">Select token</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 dark:hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-4 pb-3">
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or address"
            className="w-full px-4 py-3 rounded-2xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#6b6b70] outline-none border border-gray-200 dark:border-[#2a2a2e] bg-gray-50 dark:bg-[#0a0a0b]" />
        </div>
        <div className="px-2 pb-4 max-h-[320px] overflow-y-auto">
          {filtered.map(t => (
            <button key={t.symbol} onClick={() => { onSelect(t); onClose() }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-left">
              <TokenIcon symbol={t.symbol} color={t.color} size={36} />
              <div>
                <div className="text-gray-900 dark:text-white font-semibold text-sm">{t.symbol}</div>
                <div className="text-gray-500 dark:text-[#6b6b70] text-xs">{t.name}</div>
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
  tokenName?: string
  tokenReviews?: number
  tokenRating?: number
  riskLevel?: string
  warning?: string
  quote?: any
  error?: string
  userReputation?: {
    trustLevel: string
    reputationScore: number
    scarabPoints: number
    totalReviews: number
    feeTier: number
    feeDiscount: string
  }
  fees?: {
    baseFee: string
    effectiveFee: string
    discount: string
    saved: string | null
  }
}

export function SwapWidget() {
  const { authenticated, user, login, logout } = usePrivy()
  const [tokenIn, setTokenIn] = useState(TOKENS[0])
  const [tokenOut, setTokenOut] = useState(TOKENS[1])
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<QuoteResult | null>(null)
  const [modalFor, setModalFor] = useState<'in' | 'out' | null>(null)
  const address = user?.wallet?.address

  const handleQuote = async () => {
    if (!amount || !address) return
    setLoading(true); setResult(null)
    try {
      const amountWei = BigInt(Math.floor(parseFloat(amount) * (10 ** tokenIn.decimals))).toString()
      const res = await fetch('/api/swap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tokenIn: tokenIn.address, tokenOut: tokenOut.address, amount: amountWei, chainId: 8453, swapper: address, type: 'EXACT_INPUT' }) })
      setResult(await res.json())
    } catch (e: any) { setResult({ allowed: false, error: e.message }) }
    finally { setLoading(false) }
  }

  const swapTokens = () => { setTokenIn(tokenOut); setTokenOut(tokenIn); setResult(null) }
  const outputAmount = result?.quote?.quote?.output?.amount ? (Number(result.quote.quote.output.amount) / (10 ** tokenOut.decimals)).toFixed(4) : ''

  return (
    <div className="flex flex-col items-center py-6">
      <TokenModal open={modalFor === 'in'} onClose={() => setModalFor(null)} onSelect={t => { setTokenIn(t); setResult(null) }} exclude={tokenOut.symbol} />
      <TokenModal open={modalFor === 'out'} onClose={() => setModalFor(null)} onSelect={t => { setTokenOut(t); setResult(null) }} exclude={tokenIn.symbol} />

      <div className="w-full max-w-[480px]">
        {/* Wallet */}
        <div className="flex justify-end mb-3">
          {authenticated ? (
            <button onClick={logout} className="px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-[#1f1f23] text-xs font-mono text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-[#2a2a2e] transition-colors">
              {address ? `${address.slice(0,6)}...${address.slice(-4)}` : 'Connected'}
            </button>
          ) : (
            <button onClick={login} className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white transition-colors">
              Connect Wallet
            </button>
          )}
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-gray-200 dark:border-[#1f1f23] p-2 bg-gray-50 dark:bg-[#111113]">
          {/* In */}
          <div className="rounded-2xl p-4 mb-1 bg-white dark:bg-[#191919]">
            <div className="text-gray-400 dark:text-[#6b6b70] text-sm mb-3">You pay</div>
            <div className="flex items-center gap-3">
              <input type="number" value={amount} onChange={e => { setAmount(e.target.value); setResult(null) }} placeholder="0"
                className="flex-1 bg-transparent text-4xl font-semibold text-gray-900 dark:text-white outline-none placeholder-gray-300 dark:placeholder-[#2a2a2e] min-w-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
              <button onClick={() => setModalFor('in')}
                className="flex items-center gap-2 px-3 py-2 rounded-2xl font-semibold text-gray-900 dark:text-white text-sm hover:opacity-80 shrink-0"
                style={{ background: tokenIn.color + '18', border: `1px solid ${tokenIn.color}33` }}>
                <TokenIcon symbol={tokenIn.symbol} color={tokenIn.color} size={22} />
                {tokenIn.symbol}
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center -my-1 relative z-10">
            <button onClick={swapTokens} className="w-10 h-10 rounded-2xl border-2 border-gray-50 dark:border-[#111113] bg-gray-100 dark:bg-[#1f1f23] flex items-center justify-center hover:scale-110 transition-transform">
              <ArrowDown className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          {/* Out */}
          <div className="rounded-2xl p-4 mt-1 bg-white dark:bg-[#191919]">
            <div className="text-gray-400 dark:text-[#6b6b70] text-sm mb-3">You receive</div>
            <div className="flex items-center gap-3">
              <span className={`flex-1 text-4xl font-semibold min-w-0 truncate ${outputAmount ? 'text-gray-900 dark:text-white' : 'text-gray-300 dark:text-[#2a2a2e]'}`}>
                {outputAmount || '0'}
              </span>
              <button onClick={() => setModalFor('out')}
                className="flex items-center gap-2 px-3 py-2 rounded-2xl font-semibold text-gray-900 dark:text-white text-sm hover:opacity-80 shrink-0"
                style={{ background: tokenOut.color + '18', border: `1px solid ${tokenOut.color}33` }}>
                <TokenIcon symbol={tokenOut.symbol} color={tokenOut.color} size={22} />
                {tokenOut.symbol}
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Trust Score + Reputation Result */}
          {result && (
            <div className="mt-2 space-y-1.5">
              {/* Token Trust */}
              <div className={`rounded-2xl p-3 ${
                result.allowed ? result.warning ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-green-500/10 border border-green-500/20'
                : 'bg-red-500/10 border border-red-500/20'}`}>
                <div className="flex items-center gap-2 mb-1">
                  {result.allowed ? (result.warning ? <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0" /> : <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />) : <Shield className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                  <span className={`text-sm font-semibold ${result.allowed ? result.warning ? 'text-yellow-400' : 'text-green-400' : 'text-red-400'}`}>
                    {result.tokenName || 'Token'}: {result.trustScore}/100
                  </span>
                  {result.tokenReviews !== undefined && (
                    <span className="text-gray-500 dark:text-[#6b6b70] text-[10px] ml-auto">{result.tokenReviews} reviews · {(result.tokenRating || 0).toFixed(1)}★</span>
                  )}
                </div>
                {(result.warning || result.error) && <p className="text-[11px] text-gray-500 dark:text-[#8b8b90] pl-5">{result.warning || result.error}</p>}
              </div>

              {/* User Reputation + Fees */}
              {result.userReputation && result.fees && (
                <div className="rounded-2xl p-3 bg-blue-500/5 border border-blue-500/15">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                        {result.userReputation.trustLevel.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-[#8b8b90]">
                        Rep: {result.userReputation.reputationScore} · 🪲 {result.userReputation.scarabPoints}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-gray-500 dark:text-[#6b6b70]">
                      Fee: <span className={result.userReputation.feeTier < 0.5 ? 'text-green-400' : 'text-gray-300 dark:text-white'}>{result.fees.effectiveFee}</span>
                      {result.fees.saved && <span className="text-green-400 ml-1">({result.fees.saved})</span>}
                    </span>
                    <span className="text-gray-500 dark:text-[#6b6b70]">{result.fees.discount}</span>
                  </div>
                  {result.userReputation.trustLevel === 'new' && (
                    <p className="text-[10px] text-gray-500 dark:text-[#6b6b70] mt-1.5">💡 Write reviews to earn Scarab points and unlock lower fees</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Button */}
          <div className="mt-2">
            {!authenticated ? (
              <button onClick={login} className="w-full py-4 rounded-2xl font-bold text-base text-white transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}>Connect Wallet</button>
            ) : (
              <button onClick={handleQuote} disabled={loading || !amount}
                className="w-full py-4 rounded-2xl font-bold text-base text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ background: result?.allowed ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}>
                {loading ? <><Loader2 className="w-5 h-5 animate-spin" />Checking trust score...</>
                  : result?.allowed ? `Swap ${tokenIn.symbol} → ${tokenOut.symbol}` : !amount ? 'Enter an amount' : 'Get Quote'}
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-center gap-2 text-gray-400 dark:text-[#4b4b50] text-xs font-mono">
          <Shield className="w-3 h-3" />
          <span>Trust-gated · Uniswap API on Base · Score {'<'}30 blocked</span>
        </div>
      </div>
    </div>
  )
}
