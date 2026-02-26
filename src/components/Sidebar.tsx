'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Compass,
  LayoutDashboard,
  FileText,
  Search,
  Repeat2,
  PanelLeftClose,
  ChevronDown,
  Cpu,
  Coins,
  Zap,
} from 'lucide-react'

interface SidebarProps {
  collapsed: boolean
  setCollapsed: (v: boolean) => void
}

const NAV_ITEMS = [
  { href: '/explore', icon: Compass, label: 'Explore' },
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/swap', icon: Repeat2, label: 'Swap' },
  { href: '/docs', icon: FileText, label: 'API Docs' },
]

const CATEGORIES = [
  { slug: 'ai-agents', icon: Cpu, label: 'AI Agents' },
  { slug: 'defi', icon: Coins, label: 'DeFi' },
  { slug: 'infrastructure', icon: Zap, label: 'Infrastructure' },
]

export function Sidebar({ collapsed, setCollapsed }: SidebarProps) {
  const pathname = usePathname()
  const [catOpen, setCatOpen] = useState(true)

  if (collapsed) return null

  return (
    <aside className="fixed top-[65px] left-0 h-[calc(100vh-65px)] w-[240px] flex flex-col bg-[#0c0c0e] border-r border-[#1f1f23] z-40 hidden md:flex overflow-hidden">
      {/* Collapse button */}
      <div className="flex items-center justify-end px-3 pt-4 pb-2 shrink-0">
        <button
          onClick={() => setCollapsed(true)}
          className="p-1.5 text-[#6b6b70] hover:text-white hover:bg-[#1a1a1e] rounded-md transition-colors"
          title="Collapse sidebar"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Nav links */}
      <nav className="flex flex-col gap-0.5 px-2 shrink-0">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? 'bg-gold/10 text-gold border border-gold/20'
                  : 'text-[#adadb0] hover:bg-[#1a1a1e] hover:text-white border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Score lookup */}
      <div className="px-2 mt-2 shrink-0">
        <Link
          href="/score"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
            pathname.startsWith('/score')
              ? 'bg-gold/10 text-gold border border-gold/20'
              : 'text-[#adadb0] hover:bg-[#1a1a1e] hover:text-white border border-transparent'
          }`}
        >
          <Search className="w-4 h-4 shrink-0" />
          Score Lookup
        </Link>
      </div>

      <div className="h-px bg-[#1f1f23] mx-3 my-3 shrink-0" />

      {/* Categories */}
      <div className="px-2 shrink-0">
        <button
          onClick={() => setCatOpen(!catOpen)}
          className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold text-[#6b6b70] uppercase tracking-widest hover:text-[#adadb0] transition-colors"
        >
          <span>Categories</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${catOpen ? '' : '-rotate-90'}`} />
        </button>

        {catOpen && (
          <div className="flex flex-col gap-0.5 mt-1">
            {CATEGORIES.map(({ slug, icon: Icon, label }) => (
              <Link
                key={slug}
                href={`/explore?cat=${slug}`}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#adadb0] hover:bg-[#1a1a1e] hover:text-white transition-all border border-transparent"
              >
                <Icon className="w-3.5 h-3.5 shrink-0 text-[#6b6b70]" />
                {label}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Footer */}
      <div className="shrink-0 px-3 py-4 border-t border-[#1f1f23]">
        <p className="text-[10px] text-[#4a4a4e] text-center font-mono">
          Maiat Protocol · Base
        </p>
      </div>
    </aside>
  )
}
