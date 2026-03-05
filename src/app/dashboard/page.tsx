'use client'

import React, { Suspense } from 'react'
import dynamic from 'next/dynamic'

// Dynamically import DashboardView to avoid Privy hooks during SSR
const DashboardView = dynamic(
  () => import('@/components/DashboardView').then(mod => mod.DashboardView),
  { ssr: false }
)

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#030303] flex items-center justify-center text-[#d4a017] font-mono uppercase tracking-widest">Loading Passport...</div>}>
      <DashboardView />
    </Suspense>
  )
}
