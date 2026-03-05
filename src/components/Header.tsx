'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import Image from 'next/image'
import { Search, Radar, FileText, Trophy } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { ConnectButton } from './ConnectButton'

export function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState('')

  const isLeaderboard = searchParams.get('tab') === 'leaderboard'

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
        <Image src="/maiat-logo.jpg" alt="Maiat" width={32} height={32} className="w-8 h-8 rounded-lg shadow-lg shadow-[#3b82f6]/20 group-hover:shadow-[#3b82f6]/40 transition-shadow" />
        <span className="font-mono text-sm font-bold tracking-[4px] text-white hidden sm:block">MAIAT</span>
      </Link>

      {/* Main Nav */}
      <nav className="hidden md:flex items-center gap-1 mx-6 bg-[#0d0e17] rounded-lg p-1 border border-[#1e2035]">
        <Link 
          href="/explore" 
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-mono font-bold tracking-widest transition-colors ${pathname === '/explore' && !isLeaderboard ? 'bg-[#3b82f6]/10 text-[#3b82f6]' : 'text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#13141f]'}`}
        >
          <FileText className="w-3.5 h-3.5" />
          EXPLORE
        </Link>
        <Link 
          href="/explore?tab=leaderboard" 
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-mono font-bold tracking-widest transition-colors ${isLeaderboard ? 'bg-[#FFD700]/10 text-[#FFD700]' : 'text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#13141f]'}`}
        >
          <Trophy className="w-3.5 h-3.5" />
          TOP
        </Link>
        <Link 
          href="/monitor" 
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-mono font-bold tracking-widest transition-colors ${pathname === '/monitor' ? 'bg-[#00F0FF]/10 text-[#00F0FF]' : 'text-[#94a3b8] hover:text-[#00F0FF] hover:bg-[#00F0FF]/5'}`}
        >
          <Radar className="w-3.5 h-3.5" />
          MONITOR
        </Link>
      </nav>

      {/* Search Bar */}
      <div className="flex-1 max-w-xl pr-8">
        <form onSubmit={handleSearch} className="relative group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#475569] group-focus-within:text-[#3b82f6] transition-colors" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search agents, protocols, or 0x addresses..."
            className="w-full bg-[#0d0e17] hover:bg-[#13141f] focus:bg-[#13141f] border border-[#1e2035] focus:border-[#3b82f6]/50 text-sm text-[#f1f5f9] placeholder-[#475569] rounded-lg py-2 pl-10 pr-4 outline-none transition-all"
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
