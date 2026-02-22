'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Trophy,
  PanelLeftClose,
  ChevronDown,
} from 'lucide-react'

interface SidebarProps {
  collapsed: boolean
  setCollapsed: (v: boolean) => void
}

const categories = [
  { slug: 'ai-agents', name: 'm/ ai-agents' },
  { slug: 'defi', name: 'm/ defi' },
]

export function Sidebar({ collapsed, setCollapsed }: SidebarProps) {
  const pathname = usePathname()
  const [categoriesOpen, setCategoriesOpen] = useState(true)

  if (collapsed) return null

  return (
    <aside className="fixed top-[65px] left-0 h-[calc(100vh-65px)] w-[260px] bg-[#111113] border-r border-[#1f1f23] overflow-y-auto z-40 hidden md:block transition-all scrollbar-thin scrollbar-thumb-[#2a2a2e] scrollbar-track-transparent">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-4 pb-3 pt-5">
        <button
          onClick={() => setCollapsed(true)}
          className="p-2 text-[#6b6b70] hover:bg-[#0d0d0e] hover:text-white rounded-lg transition-colors"
        >
          <PanelLeftClose className="w-[18px] h-[18px]" />
        </button>
      </div>

      {/* Main Navigation */}
      <div className="mb-2">
        <div className="flex flex-col">
          <Link
            href="/"
            className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium border-l-[3px] transition-colors ${
              pathname === '/'
                ? 'bg-purple-500/10 text-purple-400 border-purple-500'
                : 'border-transparent text-[#adadb0] hover:bg-purple-500/5 hover:text-white'
            }`}
          >
            <Home className="w-[18px] h-[18px]" />
            <span>Home</span>
          </Link>
          <Link
            href="/leaderboard"
            className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium border-l-[3px] transition-colors ${
              pathname === '/leaderboard'
                ? 'bg-purple-500/10 text-purple-400 border-purple-500'
                : 'border-transparent text-[#adadb0] hover:bg-purple-500/5 hover:text-white'
            }`}
          >
            <Trophy className="w-[18px] h-[18px]" />
            <span>Global Leaderboard</span>
          </Link>
        </div>
      </div>

      <div className="h-px bg-[#1f1f23] mx-4 my-3" />

      {/* Categories */}
      <div className="mb-2">
        <button
          onClick={() => setCategoriesOpen(!categoriesOpen)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-[10px] font-semibold text-[#6b6b70] uppercase tracking-wide hover:text-[#adadb0]"
        >
          <span>Categories</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${
              !categoriesOpen ? '-rotate-90' : ''
            }`}
          />
        </button>

        {categoriesOpen && (
          <div className="flex flex-col">
            {categories.map((cat) => {
              const isActive = pathname === `/m/${cat.slug}`
              return (
                <Link
                  key={cat.slug}
                  href={`/m/${cat.slug}`}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium border-l-[3px] transition-colors ${
                    isActive
                      ? 'bg-purple-500/10 text-purple-400 border-purple-500'
                      : 'border-transparent text-[#adadb0] hover:bg-purple-500/5 hover:text-white'
                  }`}
                >
                  <span>{cat.name}</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <div className="h-px bg-[#1f1f23] mx-4 my-3" />

      {/* Footer Info */}
      <div className="px-4 py-4 text-[10px] text-[#6b6b70]">
        <p className="mb-2">Maiat — Trust Layer for AI Agents</p>
        <p className="text-[#4a4a4e]">Powered by 0G Compute + Kite AI • BSC verified</p>
      </div>
    </aside>
  )
}
