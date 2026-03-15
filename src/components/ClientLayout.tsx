'use client'

import { Suspense, ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { PrivyProvider } from '@/components/PrivyProvider'
import { ThemeProvider } from '@/components/ThemeProvider'
import MeshBackground from '@/components/MeshBackground'
import Footer from '@/components/Footer'

// Dynamically import TopNavbar to avoid Privy hooks during SSR
const TopNavbar = dynamic(
  () => import('@/components/TopNavbar'),
  { ssr: false }
)

export function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider>
      <ThemeProvider>
        <div className="min-h-screen transition-colors duration-700 bg-[#FDFDFB] text-black dark:bg-[#0A0A0A] dark:text-white">
          <MeshBackground />
          <Suspense fallback={null}>
            <TopNavbar />
          </Suspense>
          <main className="w-full min-h-screen pt-24">
            {children}
          </main>
          <Footer />
        </div>
      </ThemeProvider>
    </PrivyProvider>
  )
}
