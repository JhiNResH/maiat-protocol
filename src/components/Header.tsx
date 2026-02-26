'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Feather, Search } from 'lucide-react'
import { ConnectButton } from './ConnectButton'

export function Header() {
  const router = useRouter()
  const [query, setQuery] = useState('')

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    router.push(`/explore?q=${encodeURIComponent(q)}`)
    setQuery('')
  }

  return (
    <header className="fixed top-0 left-0 right-0 h-[73px] flex items-center justify-between px-6 border-b border-[#1a1a1b] z-50 bg-[#030303]">
      {/* Logo */}
      <Link href="/explore" className="flex items-center gap-2.5 shrink-0">
        <div className="w-10 h-10 bg-gold rounded-full flex items-center justify-center shadow-lg shadow-gold/10">
          <Feather className="w-6 h-6 text-black" />
        </div>
        <span className="font-mono text-xl font-bold tracking-[3px] text-[#d7dadc] hidden sm:block">MAIAT</span>
      </Link>

      {/* Search Bar (Reddit Style) */}
      <div className="flex-1 max-w-2xl px-8">
        <form onSubmit={handleSearch} className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#818384] group-focus-within:text-gold transition-colors" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search communities, agents, or addresses..."
            className="w-full bg-[#1a1a1b] hover:bg-[#272729] focus:bg-[#272729] border border-[#343536] focus:border-[#d7dadc] text-sm text-[#d7dadc] placeholder-[#818384] rounded-full py-2.5 pl-11 pr-4 outline-none transition-all font-mono"
            spellCheck={false}
          />
        </form>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-4 shrink-0">
        <ConnectButton />
      </div>
    </header>
  )
}
