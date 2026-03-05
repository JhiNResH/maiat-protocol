'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'
import Image from 'next/image'
import { Search, Radar, FileText, Trophy } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { ConnectButton } from './ConnectButton'

function HeaderContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState('')

  const isLeaderboard = searchParams.get('tab') === 'leaderboard'

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return

    if (pathname === '/monitor') {
      // If we are already on monitor, just update the URL query so the map can react
      router.push(`/monitor?q=${encodeURIComponent(q)}`)
    } else {
      router.push(`/explore?q=${encodeURIComponent(q)}`)
    }
    setQuery('')
  }

  return (
    <header className="fixed top-0 left-0 right-0 h-[64px] flex items-center justify-between px-6 border-b border-[#1e2035] z-50 bg-[#050508]/95 backdrop-blur-sm">
      {/* Logo */}
      <Link href="/explore" className="flex items-center gap-2.5 shrink-0 group">
        <Image src="/maiat-logo.jpg" alt="Maiat" width={32} height={32} className="w-8 h-8 rounded-lg shadow-lg shadow-[#3b82f6]/20 group-hover:shadow-[#3b82f6]/40 transition-shadow" />
        <span className="font-mono text-sm font-bold tracking-[4px] text-white hidden sm:block">MAIAT</span>
      </Link>

      {/* Search Bar */}
      <div className="flex-1 max-w-xl pr-8 mx-6">
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

export function Header() {
  return (
    <Suspense fallback={<header className="fixed top-0 left-0 right-0 h-[64px] border-b border-[#1e2035] z-50 bg-[#050508]/95 backdrop-blur-sm" />}>
      <HeaderContent />
    </Suspense>
  )
}
