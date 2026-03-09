'use client'

import { Suspense } from 'react'

export function HeaderContentInternal() {
  return (
    <header className="fixed top-0 right-0 lg:left-[220px] left-0 z-[50] bg-[var(--bg-page)]/80 backdrop-blur-xl border-b border-white/5 h-[65px]">
      <div className="h-full px-6 flex items-center justify-end gap-4">
        {/* Header is now minimalist with no actions, all moved to Sidebar */}
      </div>
    </header>
  )
}

export function Header() {
  return (
    <Suspense fallback={<header className="fixed top-0 right-0 lg:left-[220px] left-0 z-[50] bg-[var(--bg-page)] border-b border-white/5 h-[65px]" />}>
      <HeaderContentInternal />
    </Suspense>
  )
}
