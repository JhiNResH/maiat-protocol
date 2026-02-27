'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import Link from 'next/link'

export default function PassportIndexPage() {
  const router = useRouter()
  const { authenticated, user, login } = usePrivy()
  const [manualAddr, setManualAddr] = useState('')
  const [error, setError] = useState('')

  // Auto-redirect if wallet is already connected
  useEffect(() => {
    if (authenticated && user?.wallet?.address) {
      router.push(`/passport/${user.wallet.address}`)
    }
  }, [authenticated, user, router])

  const handleLookup = () => {
    const val = manualAddr.trim()
    if (/^0x[a-fA-F0-9]{40}$/.test(val)) {
      router.push(`/passport/${val}`)
    } else {
      setError('Enter a valid 0x wallet address')
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col">
      <header className="border-b border-[#1a1a1a] px-6 py-4 flex items-center justify-between">
        <Link href="/explore" className="text-[#0052FF] font-mono font-bold text-sm tracking-wider">MAIAT</Link>
        <span className="font-mono text-xs text-gray-600">// TRUST PASSPORT</span>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm space-y-6">

          <div className="text-center">
            <h1 className="text-white font-mono font-bold text-xl mb-2">Trust Passport</h1>
            <p className="text-gray-500 font-mono text-xs leading-relaxed">
              Your on-chain reputation score, review history,<br />
              and trust level in the Maiat network.
            </p>
          </div>

          {/* Connect wallet */}
          <div className="bg-[#111] border border-[#222] rounded-xl p-6 text-center">
            <p className="text-gray-400 font-mono text-sm mb-4">View your passport</p>
            <button
              onClick={login}
              className="w-full bg-[#0052FF] hover:bg-[#0040CC] text-white font-mono font-bold text-sm py-3 rounded-lg transition-colors"
            >
              Connect Wallet
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[#222]" />
            <span className="text-gray-600 font-mono text-xs">or look up any wallet</span>
            <div className="flex-1 h-px bg-[#222]" />
          </div>

          {/* Manual lookup */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={manualAddr}
                onChange={e => { setManualAddr(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleLookup()}
                placeholder="0x wallet address…"
                className="flex-1 bg-[#111] border border-[#333] focus:border-[#0052FF] text-white font-mono text-sm px-4 py-2.5 rounded-lg outline-none transition-colors placeholder:text-gray-600"
              />
              <button
                onClick={handleLookup}
                className="border border-[#333] hover:border-[#555] text-gray-300 font-mono text-sm px-4 py-2.5 rounded-lg transition-colors"
              >
                →
              </button>
            </div>
            {error && <p className="text-red-400 font-mono text-xs">{error}</p>}
          </div>

        </div>
      </main>
    </div>
  )
}
