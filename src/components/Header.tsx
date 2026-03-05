'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'
import Image from 'next/image'
import { Search } from 'lucide-react'
import dynamic from 'next/dynamic'

// Dynamically import HeaderContent to avoid calling Privy hooks during SSR
const HeaderContent = dynamic(
  () => import('./Header').then(mod => mod.HeaderContentInternal),
  { ssr: false }
)

export function HeaderContentInternal() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchValue, setSearchValue] = useState(searchParams.get('q') || '')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchValue.trim()) {
      router.replace(`/agent?q=${encodeURIComponent(searchValue.trim())}`, { scroll: false })
    }
  }

  // Lazy import ConnectButton to avoid any further Privy SSR issues
  const ConnectButton = dynamic(
    () => import('./ConnectButton').then(mod => mod.ConnectButton),
    { ssr: false }
  )

  return (
    <header className="fixed top-0 left-0 right-0 h-[64px] border-b border-[#1e2035] z-50 bg-[#050508]/95 backdrop-blur-sm">
      <div className="h-full px-4 lg:px-6 flex items-center justify-between gap-4 max-w-[2000px] mx-auto">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group shrink-0">
          <div className="relative w-8 h-8 overflow-hidden transition-colors">
            <Image
              src="/logo-dark.jpg"
              alt="Maiat"
              fill
              className="object-cover"
            />
          </div>
          <span className="text-lg font-bold tracking-tighter text-white hidden sm:inline-block">
            MAIAT
          </span>
        </Link>

        {/* Search & Actions */}
        <div className="flex items-center gap-3 flex-1 justify-end max-w-xl">
          <form onSubmit={handleSearch} className="relative w-full group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-muted group-focus-within:text-gold transition-colors" />
            <input
              type="text"
              placeholder="Search by name or 0x..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-gold/50 focus:bg-white/[0.05] transition-all shadow-inner"
            />
          </form>

          <ConnectButton />
        </div>
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
