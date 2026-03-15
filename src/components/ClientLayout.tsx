'use client'

import { Suspense, ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { PrivyProvider } from '@/components/PrivyProvider'
import { ThemeProvider } from '@/components/ThemeProvider'

// Dynamically import TopNavbar to avoid Privy hooks during SSR
const TopNavbar = dynamic(
  () => import('@/components/TopNavbar'),
  { ssr: false }
)

export function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider>
      <ThemeProvider>
        <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-color)', transition: 'background-color 0.5s ease, color 0.5s ease' }}>
          <Suspense fallback={null}>
            <TopNavbar />
          </Suspense>
          <main className="w-full min-h-screen pt-24">
            {children}
          </main>
        </div>
      </ThemeProvider>
    </PrivyProvider>
  )
}
