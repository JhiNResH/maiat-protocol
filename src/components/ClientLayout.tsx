'use client'

import { Suspense, ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { PrivyProvider } from '@/components/PrivyProvider'

// Dynamically import Sidebar to avoid Privy hooks during SSR
const Sidebar = dynamic(
  () => import('@/components/Sidebar').then(mod => mod.Sidebar),
  { ssr: false }
)

export function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider>
      <div className="flex min-h-screen">
        <Suspense fallback={<div className="w-[220px] bg-[var(--bg-page)] border-r border-[#1e2035]" />}>
          <Sidebar />
        </Suspense>
        
        {/* Main content now occupies the full height, no global header space */}
        <main className="flex-1 lg:pl-[220px] w-full min-h-screen">
          {children}
        </main>
      </div>
    </PrivyProvider>
  )
}
