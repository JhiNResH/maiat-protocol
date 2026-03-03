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
  description: 'Trust oracle for AI agents and tokens — behavioral scoring, community reviews, EAS attestations, and Uniswap v4 trust-gated swaps. SDKs for ElizaOS, AgentKit, GAME, and MCP. Built on Base.',
  keywords: ['trust oracle', 'AI agent verification', 'smart contract trust score', 'DeFi safety', 'trust infrastructure', 'EAS attestation', 'Uniswap v4 hook', 'on-chain reputation', 'agent commerce'],
  authors: [{ name: 'Maiat Protocol', url: 'https://maiat-protocol.vercel.app' }],
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Maiat Protocol — Trust Infrastructure for AI Agents',
    description: 'Trust oracle for AI agents and tokens — behavioral scoring, community reviews, EAS attestations, and Uniswap v4 trust-gated swaps. Built on Base.',
    url: 'https://maiat-protocol.vercel.app',
    siteName: 'Maiat Protocol',
    type: 'website',
    images: [{ url: 'https://maiat-protocol.vercel.app/maiat.jpg', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Maiat Protocol — Trust Infrastructure for AI Agents',
    description: 'Trust oracle for AI agents and tokens — behavioral scoring, community reviews, EAS attestations, and Uniswap v4 trust-gated swaps. SDKs for ElizaOS, AgentKit, GAME, and MCP. Built on Base.',
    images: ['https://maiat-protocol.vercel.app/maiat.jpg'],
    creator: '@0xmaiat',
  },
  alternates: {
    canonical: 'https://maiat-protocol.vercel.app',
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
