import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { PrivyProvider } from '@/components/PrivyProvider'
import { TopNav } from '@/components/TopNav'
import { ClientLayout } from '@/components/ClientLayout'
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
  other: {
    'base:app_id': '699600ef25337829d86a5475',
    'base:bounty_code': 'bc_cozhkj23',
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
      <body className="font-sans bg-page text-txt-primary min-h-screen">
        <PrivyProvider>
          {/* Global top nav — fixed, 65px height */}
          <TopNav />
          {/* Sidebar + main content layout below the top nav */}
          <div className="pt-[65px]">
            <ClientLayout>
              {children}
            </ClientLayout>
          </div>
        </PrivyProvider>
      </body>
    </html>
  )
}
