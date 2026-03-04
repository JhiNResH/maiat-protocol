'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/Header'

const POPULAR = [
  { name: 'Uniswap', address: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD', chain: 'Base' },
  { name: 'Aave V3', address: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5', chain: 'Base' },
  { name: 'Aerodrome', address: '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43', chain: 'Base' },
  { name: 'AIXBT', address: '0x4f9Fd6Be4a90f2620860d680c0d4d5Fb53d1a825', chain: 'Base' },
  { name: 'Virtuals Protocol', address: '0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b', chain: 'Base' },
]

export default function ReviewIndexPage() {
  const router = useRouter()
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  const handleGo = () => {
    const val = input.trim()
    if (!val) return
    if (/^0x[a-fA-F0-9]{40}$/.test(val)) {
      router.push(`/review/${val}`)
    } else {
      setError('Enter a valid 0x contract address')
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col text-[#E5E5E5]">
      <Header />

      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md">
          <h1 className="text-white font-mono font-bold text-xl mb-2 text-center">
            Review a Project
          </h1>
          <p className="text-gray-500 font-mono text-xs text-center mb-8">
            Paste a contract address to leave a trust review.<br />
            Only wallets with on-chain interaction history can submit.
          </p>

          {/* Input */}
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={input}
              onChange={e => { setInput(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleGo()}
              placeholder="0x contract address…"
              className="flex-1 bg-[#111] border border-[#333] focus:border-[#EF4444] text-white font-mono text-sm px-4 py-3 rounded-lg outline-none transition-colors placeholder:text-gray-600"
            />
            <button
              onClick={handleGo}
              className="bg-[#EF4444] hover:bg-[#DC2626] text-white font-mono font-bold text-sm px-5 py-3 rounded-lg transition-colors"
            >
              GO →
            </button>
          </div>
          {error && <p className="text-slate-400 font-mono text-xs mb-4">{error}</p>}

          {/* Popular */}
          <div className="mt-8">
            <p className="text-gray-600 font-mono text-xs mb-3">// POPULAR PROJECTS</p>
            <div className="flex flex-col gap-2">
              {POPULAR.map(p => (
                <Link
                  key={p.address}
                  href={`/review/${p.address}`}
                  className="flex items-center justify-between bg-[#111] border border-[#222] hover:border-[#333] rounded-lg px-4 py-3 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded bg-[#1a1a1a] border border-[#333] flex items-center justify-center text-xs font-bold text-gray-400">
                      {p.name.charAt(0)}
                    </div>
                    <span className="text-white font-mono text-sm">{p.name}</span>
                    <span className="text-xs font-mono text-[#EF4444] border border-[#EF4444]/30 px-1.5 py-0.5 rounded">
                      {p.chain}
                    </span>
                  </div>
                  <span className="text-gray-600 group-hover:text-gray-400 font-mono text-xs transition-colors">
                    Review →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
