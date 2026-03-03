'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Image from 'next/image'
import { Search } from 'lucide-react'
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
    <header className="fixed top-0 left-0 right-0 h-[64px] flex items-center justify-between px-6 border-b border-[#1e2035] z-50 bg-[#050508]/95 backdrop-blur-sm">
      {/* Logo */}
      <Link href="/explore" className="flex items-center gap-2.5 shrink-0 group">
        <Image src="/maiat-logo.jpg" alt="Maiat" width={32} height={32} className="w-8 h-8 rounded-lg shadow-lg shadow-[#0052FF]/20 group-hover:shadow-[#0052FF]/40 transition-shadow" />
        <span className="font-mono text-sm font-bold tracking-[4px] text-white hidden sm:block">MAIAT</span>
      </Link>

      {/* Search Bar */}
      <div className="flex-1 max-w-xl px-8">
        <form onSubmit={handleSearch} className="relative group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#475569] group-focus-within:text-[#0052FF] transition-colors" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search agents, protocols, or 0x addresses..."
            className="w-full bg-[#0d0e17] hover:bg-[#13141f] focus:bg-[#13141f] border border-[#1e2035] focus:border-[#0052FF]/50 text-sm text-[#f1f5f9] placeholder-[#475569] rounded-lg py-2 pl-10 pr-4 outline-none transition-all"
            spellCheck={false}
          />
        </form>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 shrink-0">
        <ConnectButton />
      </div>
    </header>
  )
}
