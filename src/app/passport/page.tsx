'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { Header } from '@/components/Header'
import { Search, Shield, Zap, Globe, ArrowRight, Check, AlertCircle, Loader2 } from 'lucide-react'

type SearchState = 'idle' | 'searching' | 'available' | 'taken' | 'error'

interface PassportResult {
  ensName: string
  ensFullName: string
  walletAddress: string | null
  name: string | null
  trustScore: number
  verdict: string
  type: string
  status: string
  passportUrl: string
  scarabBalance: number
  totalQueries: number
}

export default function PassportIndexPage() {
  const router = useRouter()
  const { authenticated, login } = usePrivy()
  const { wallets } = useWallets()
  const externalWallet = wallets.find(w => w.walletClientType !== 'privy')

  const [query, setQuery] = useState('')
  const [searchState, setSearchState] = useState<SearchState>('idle')
  const [result, setResult] = useState<PassportResult | null>(null)
  const [registering, setRegistering] = useState(false)
  const [regResult, setRegResult] = useState<PassportResult | null>(null)
  const [stats, setStats] = useState({ total: 0, claimed: 0 })

  // Fetch stats
  useEffect(() => {
    fetch('/api/v1/passport/register?stats=true')
      .catch(() => {})
  }, [])

  const handleSearch = useCallback(async () => {
    const q = query.trim().toLowerCase().replace(/\.maiat\.eth$/, '')
    if (q.length < 3) return

    setSearchState('searching')
    setResult(null)

    try {
      const res = await fetch(`/api/v1/passport/lookup?q=${encodeURIComponent(q)}`)
      if (res.status === 404) {
        setSearchState('available')
      } else if (res.ok) {
        const data = await res.json()
        setResult(data.passport)
        setSearchState('taken')
      } else {
        setSearchState('error')
      }
    } catch {
      setSearchState('error')
    }
  }, [query])

  const handleRegister = async () => {
    if (!authenticated) {
      login()
      return
    }

    const wallet = externalWallet?.address || wallets[0]?.address
    if (!wallet) {
      login()
      return
    }

    setRegistering(true)
    try {
      const ensName = query.trim().toLowerCase().replace(/\.maiat\.eth$/, '')
      const res = await fetch('/api/v1/passport/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Maiat-Client': `web:${wallet.slice(0, 10)}`,
        },
        body: JSON.stringify({
          ensName,
          walletAddress: wallet,
          type: 'human',
        }),
      })
      const data = await res.json()
      if (res.ok && data.passport) {
        setRegResult(data.passport)
      }
    } catch (err) {
      console.error('Registration failed:', err)
    } finally {
      setRegistering(false)
    }
  }

  const verdictColor = (v: string) => {
    switch (v) {
      case 'trusted': return '#34D399'
      case 'proceed': return '#3B82F6'
      case 'caution': return '#FBBF24'
      case 'avoid': return '#EF4444'
      default: return '#9CA3AF'
    }
  }

  // Registration success view
  if (regResult) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex flex-col text-[#E5E5E5]">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center px-4 pb-16">
          <div className="w-full max-w-md space-y-6">

            <div className="text-center">
              <div className="text-4xl mb-3">🛡️</div>
              <h1 className="text-white font-mono font-bold text-xl mb-2">Passport Created</h1>
              <p className="text-emerald-400 font-mono text-sm">
                {regResult.ensFullName}
              </p>
            </div>

            <div className="bg-[var(--bg-surface)] border border-emerald-500/30 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-mono text-xs">ENS Name</span>
                <span className="text-white font-mono text-sm font-bold">{regResult.ensFullName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-mono text-xs">Trust Score</span>
                <span className="font-mono text-sm font-bold" style={{ color: verdictColor(regResult.verdict) }}>
                  {regResult.trustScore}/100
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-mono text-xs">Scarab</span>
                <span className="text-white font-mono text-sm">🪲 {regResult.scarabBalance}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-mono text-xs">Status</span>
                <span className="text-emerald-400 font-mono text-xs font-bold uppercase">{regResult.status}</span>
              </div>
            </div>

            <button
              onClick={() => router.push(`/passport/${regResult.ensName}`)}
              className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white font-mono font-bold text-sm py-3 rounded-lg transition-colors"
            >
              View Passport →
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)] flex flex-col text-[#E5E5E5]">
      <Header />

      <main className="flex-1 flex flex-col items-center px-4 pb-16">

        {/* Hero */}
        <div className="w-full max-w-2xl mt-16 mb-10 text-center">
          <h1 className="text-white font-mono font-bold text-3xl sm:text-4xl mb-3 tracking-tight">
            maiat.eth
          </h1>
          <p className="text-gray-500 font-mono text-sm leading-relaxed max-w-md mx-auto">
            Your agent&apos;s verifiable identity.<br />
            One name. Trust score. On-chain reputation.
          </p>
        </div>

        {/* Search */}
        <div className="w-full max-w-lg mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 w-4 h-4" />
            <input
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setSearchState('idle'); setResult(null) }}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search or register a name..."
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] focus:border-[#3b82f6] text-white font-mono text-sm pl-11 pr-4 py-4 rounded-xl outline-none transition-colors placeholder:text-gray-600"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-700 font-mono text-xs">
              .maiat.eth
            </span>
          </div>

          {query.trim().length >= 3 && (
            <button
              onClick={handleSearch}
              disabled={searchState === 'searching'}
              className="mt-3 w-full bg-[#3b82f6] hover:bg-[#2563eb] disabled:opacity-50 text-white font-mono font-bold text-sm py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {searchState === 'searching' ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Searching...</>
              ) : (
                <>Search</>
              )}
            </button>
          )}

          {/* Search Results */}
          {searchState === 'available' && (
            <div className="mt-4 bg-[var(--bg-surface)] border border-emerald-500/30 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400 font-mono text-sm font-bold">
                  {query.trim().toLowerCase()}.maiat.eth is available
                </span>
              </div>
              <button
                onClick={handleRegister}
                disabled={registering}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-mono font-bold text-sm py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {registering ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Registering...</>
                ) : authenticated ? (
                  <>Register — Free</>
                ) : (
                  <>Connect Wallet to Register</>
                )}
              </button>
            </div>
          )}

          {searchState === 'taken' && result && (
            <div className="mt-4 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-400 font-mono text-sm">
                    {result.ensFullName}
                  </span>
                </div>
                <span
                  className="text-xs font-bold font-mono px-2 py-1 rounded-md"
                  style={{
                    color: verdictColor(result.verdict),
                    backgroundColor: `${verdictColor(result.verdict)}15`,
                    border: `1px solid ${verdictColor(result.verdict)}30`,
                  }}
                >
                  {result.verdict.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center">
                  <p className="text-[10px] font-mono text-gray-600 uppercase">Trust</p>
                  <p className="text-lg font-bold font-mono" style={{ color: verdictColor(result.verdict) }}>
                    {result.trustScore}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-mono text-gray-600 uppercase">Queries</p>
                  <p className="text-lg font-bold font-mono text-white">{result.totalQueries}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-mono text-gray-600 uppercase">Scarab</p>
                  <p className="text-lg font-bold font-mono text-white">🪲 {result.scarabBalance}</p>
                </div>
              </div>

              <button
                onClick={() => router.push(result.passportUrl.replace('https://app.maiat.io', ''))}
                className="w-full border border-[var(--border-default)] hover:border-[#3b82f6] text-white font-mono text-sm py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                View Passport <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Features Grid */}
        <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5">
            <Shield className="w-5 h-5 text-[#3b82f6] mb-3" />
            <h3 className="text-white font-mono text-sm font-bold mb-1">Trust Score</h3>
            <p className="text-gray-600 font-mono text-[10px] leading-relaxed">
              0-100 score from on-chain behavior, Wadjet ML, and outcome history.
            </p>
          </div>
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5">
            <Globe className="w-5 h-5 text-emerald-400 mb-3" />
            <h3 className="text-white font-mono text-sm font-bold mb-1">ENS Identity</h3>
            <p className="text-gray-600 font-mono text-[10px] leading-relaxed">
              name.maiat.eth — resolvable in MetaMask, Rainbow, any ENS app.
            </p>
          </div>
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5">
            <Zap className="w-5 h-5 text-amber-400 mb-3" />
            <h3 className="text-white font-mono text-sm font-bold mb-1">Scarab 🪲</h3>
            <p className="text-gray-600 font-mono text-[10px] leading-relaxed">
              Earn by reporting outcomes, maintaining streaks, and referring agents.
            </p>
          </div>
        </div>

        {/* For Agents CTA */}
        <div className="w-full max-w-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="text-2xl">🤖</div>
            <div className="flex-1">
              <h3 className="text-white font-mono text-sm font-bold mb-1">For AI Agents</h3>
              <p className="text-gray-500 font-mono text-[10px] leading-relaxed mb-3">
                Register via API. One call → Passport + ENS subdomain + trust score.
              </p>
              <div className="bg-[var(--bg-page)] rounded-lg p-3 font-mono text-[10px] text-gray-400 overflow-x-auto">
                <span className="text-emerald-400">POST</span>{' '}
                <span className="text-white">/api/v1/passport/register</span><br />
                <span className="text-gray-600">Header:</span>{' '}
                <span className="text-amber-400">X-Maiat-Client: your-agent-id</span><br />
                <span className="text-gray-600">Body:</span>{' '}
                <span className="text-gray-400">{'{ "ensName": "myagent", "walletAddress": "0x..." }'}</span><br />
                <br />
                <span className="text-gray-600">→</span>{' '}
                <span className="text-white">myagent.maiat.eth</span>{' '}
                <span className="text-gray-600">+ passport + 10 🪲</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer stats */}
        <div className="text-center text-gray-700 font-mono text-[10px]">
          Powered by NameStone CCIP-Read · Zero gas · Same architecture as uni.eth
        </div>

      </main>
    </div>
  )
}
