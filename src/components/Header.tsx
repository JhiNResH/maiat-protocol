'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Feather, Search, Github } from 'lucide-react'

export function Header() {
  const router = useRouter()
  const [query, setQuery] = useState('')

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    if (q.startsWith('0x') && q.length === 42) {
      router.push(`/score/${q}`)
    } else {
      router.push(`/score/${q}`)
    }
    setQuery('')
  }

  return (
    <header className="flex items-center justify-between px-[60px] py-5 border-b border-border-subtle w-full">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5">
        <Feather className="w-7 h-7 text-gold" />
        <span className="font-mono text-xl font-bold tracking-[3px] text-txt-primary">MAIAT</span>
      </Link>

      {/* Nav Links */}
      <nav className="flex items-center gap-8">
        <form onSubmit={handleSearch} className="flex items-center gap-2 rounded-lg border border-border-subtle px-3.5 py-2">
          <Search className="w-4 h-4 text-txt-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search address..."
            className="bg-transparent text-[13px] text-txt-primary placeholder-txt-muted outline-none w-[140px]"
            spellCheck={false}
          />
        </form>
        <Link href="/" className="text-sm font-medium text-txt-secondary hover:text-txt-primary transition-colors">
          Explore
        </Link>
        <Link href="/docs" className="text-sm font-medium text-txt-secondary hover:text-txt-primary transition-colors">
          API Docs
        </Link>
        <a
          href="https://github.com/JhiNResH/maiat"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm font-medium text-txt-secondary hover:text-txt-primary transition-colors"
        >
          <Github className="w-[18px] h-[18px]" />
          GitHub
        </a>
      </nav>
    </header>
  )
}
