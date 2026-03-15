'use client'

import { Suspense, ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { PrivyProvider } from '@/components/PrivyProvider'
import { ThemeProvider, useTheme } from '@/components/ThemeProvider'
import Footer from '@/components/Footer'
import { motion } from 'framer-motion'

// Dynamically import TopNavbar to avoid Privy hooks during SSR
const TopNavbar = dynamic(
  () => import('@/components/TopNavbar'),
  { ssr: false }
)

function InnerLayout({ children }: { children: ReactNode }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div className={`min-h-screen relative overflow-hidden transition-colors duration-700 ${isDark ? 'bg-[#0A0A0A] text-white' : 'bg-[#FDFDFB] text-black'}`}>
      {/* Atmospheric Backgrounds — matches passport-ens exactly */}
      <motion.div
        animate={{ scale: [1, 1.1, 1], x: [0, 20, 0], y: [0, -20, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className={`fixed top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] pointer-events-none transition-colors duration-1000 ${isDark ? 'bg-blue-900/20' : 'bg-blue-100/30'}`}
      />
      <motion.div
        animate={{ scale: [1, 1.2, 1], x: [0, -30, 0], y: [0, 30, 0] }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className={`fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[150px] pointer-events-none transition-colors duration-1000 ${isDark ? 'bg-purple-900/10' : 'bg-orange-50/40'}`}
      />

      <Suspense fallback={null}>
        <TopNavbar />
      </Suspense>
      <main className="w-full min-h-screen pt-24 relative z-[1]">
        {children}
      </main>
      <Footer />
    </div>
  )
}

export function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider>
      <ThemeProvider>
        <InnerLayout>{children}</InnerLayout>
      </ThemeProvider>
    </PrivyProvider>
  )
}
