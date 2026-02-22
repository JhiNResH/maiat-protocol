'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Search, SquarePen } from 'lucide-react'
import { usePrivy } from '@privy-io/react-auth'
import { SearchModal } from './search/SearchModal'
import { ThemeToggle } from './ThemeToggle'

export function TopNav() {
  const pathname = usePathname()
  const { authenticated, user, login, logout } = usePrivy()
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  // ⌘K shortcut to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <header className="sticky top-0 z-50 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--border)] h-[65px]">
      <div className="h-full px-6 flex items-center justify-between">
        {/* Left: Logo */}
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="relative w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center">
              <Image
                src="/logo-light.png"
                alt="MAIAT"
                width={40}
                height={40}
                className="object-contain"
                priority
              />
            </div>
            <span className="text-[22px] font-bold tracking-wide text-[#d9d4e8] font-['Cinzel_Decorative'] hidden sm:block">
              MAIAT
              <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-purple-500 mb-1"></span>
            </span>
          </Link>
        </div>

        {/* Center: Search Bar (placeholder - will add modal later) */}
        <div className="absolute left-1/2 -translate-x-1/2 w-full max-w-[480px] hidden md:block">
          <button
            onClick={() => setIsSearchOpen(true)}
            className="w-full relative group"
          >
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b6b70] group-hover:text-purple-500 transition-colors">
              <Search className="w-4 h-4" />
            </div>
            <div className="w-full bg-[#111113] border border-[#1f1f23] rounded-lg py-2.5 pl-10 pr-4 text-sm text-left text-[#6b6b70] hover:border-purple-500/50 hover:bg-[#0d0d0e] transition-all">
              Search projects, reviews...
            </div>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-[#2a2a2e] bg-[#1a1a1d] px-1.5 font-mono text-[10px] font-medium text-[#adadb0]">
                ⌘K
              </kbd>
            </div>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {/* API Docs */}
          <Link
            href="/docs"
            className="hidden sm:flex items-center px-3 py-2 rounded-lg text-[13px] font-medium text-[#adadb0] hover:text-white hover:bg-[#1a1a1d] transition-colors"
          >
            API Docs
          </Link>

          {/* Write Review Button */}
          <Link
            href="/review"
            className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[13px] font-medium transition-colors"
          >
            <SquarePen className="w-4 h-4" />
            <span>Write</span>
          </Link>

          {/* Auth Button */}
          {authenticated ? (
            <div className="flex items-center gap-2">
              <Link
                href={`/users/${user?.wallet?.address}`}
                className="hidden sm:block px-3 py-2 bg-[#111113] border border-[#1f1f23] rounded-lg text-sm text-[#adadb0] hover:text-white hover:border-purple-500/50 transition-colors"
              >
                {user?.wallet?.address?.slice(0, 6)}...{user?.wallet?.address?.slice(-4)}
              </Link>
              <button
                onClick={logout}
                className="px-3 py-2 text-sm text-[#6b6b70] hover:text-white transition-colors"
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={login}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Sign In
            </button>
          )}
        </div>
      </div>

      {/* Search Modal */}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </header>
  )
}
