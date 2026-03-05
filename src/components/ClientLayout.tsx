'use client'

import { Suspense, ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { PrivyProvider } from '@/components/PrivyProvider'

// Dynamically import Sidebar and Header to avoid Privy hooks during SSR
const Sidebar = dynamic(
  () => import('@/components/Sidebar').then(mod => mod.Sidebar),
  { ssr: false }
)

export function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider>
      <div className="flex flex-col min-h-screen">
        <div className="flex flex-1 pt-[64px]">
          <Suspense fallback={<div className="w-[220px] bg-[#050508] border-r border-[#1e2035]" />}>
            <Sidebar />
          </Suspense>
          <main className="flex-1 lg:pl-[220px] w-full">
            {children}
          </main>
        </div>
      </div>
    </PrivyProvider>
  )
}
