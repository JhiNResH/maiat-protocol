import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { PrivyProvider } from '@/components/PrivyProvider'
import { Sidebar } from '@/components/Sidebar'
import { Suspense } from 'react'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' })

export const metadata: Metadata = {
  title: 'Maiat Protocol — Trust Infrastructure for AI Agents',
  description: 'Verify any smart contract or AI agent before you transact. On-chain trust scores, community reviews, and x402-gated trust gate API. Built on Base.',
  keywords: ['smart contract trust score', 'AI agent verification', 'DeFi safety check', 'trust infrastructure', 'x402 payment', 'on-chain reputation'],
  authors: [{ name: 'Maiat Protocol', url: 'https://maiat-protocol.vercel.app' }],
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Maiat Protocol — Trust Infrastructure for AI Agents',
    description: 'Verify any smart contract or AI agent before you transact. On-chain trust scores + community reviews.',
    url: 'https://maiat-protocol.vercel.app',
    siteName: 'Maiat Protocol',
    type: 'website',
    images: [{ url: 'https://maiat-protocol.vercel.app/maiat.jpg', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Maiat Protocol — Trust Infrastructure for AI Agents',
    description: 'Verify any smart contract or AI agent before you transact.',
    images: ['https://maiat-protocol.vercel.app/maiat.jpg'],
    creator: '@0xmaiat',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body className="font-sans bg-[#030303] text-txt-primary min-h-screen">
        <PrivyProvider>
          <div className="flex flex-col min-h-screen">
            {/* Header is fixed inside its own component */}
            <div className="flex flex-1 pt-[64px]">
              <Suspense fallback={null}><Sidebar /></Suspense>
              <main className="flex-1 lg:pl-[220px] w-full">
                {children}
              </main>
            </div>
          </div>
        </PrivyProvider>
      </body>
    </html>
  )
}
