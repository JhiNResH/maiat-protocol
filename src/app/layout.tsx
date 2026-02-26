import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { PrivyProvider } from '@/components/PrivyProvider'
import { Sidebar } from '@/components/Sidebar'
import { Suspense } from 'react'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' })

export const metadata: Metadata = {
  title: 'Maiat - Trust Layer for the Agent Economy',
  description: 'On-chain trust scoring for any blockchain address or token. Powered by Maiat Protocol.',
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
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
            <div className="flex flex-1 pt-[73px]">
              <Suspense fallback={null}><Sidebar /></Suspense>
              <main className="flex-1 lg:pl-[240px] w-full">
                {children}
              </main>
            </div>
          </div>
        </PrivyProvider>
      </body>
    </html>
  )
}
