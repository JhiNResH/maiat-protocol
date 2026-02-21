import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { PrivyProvider } from '@/components/PrivyProvider'
import { TopNav } from '@/components/TopNav'
import { ClientLayout } from '@/components/ClientLayout'
import { Footer } from '@/components/Footer'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Maiat - Trust Layer for Agentic Commerce',
  description: 'Review and rate AI agents and DeFi protocols with on-chain verification',
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script async dangerouslySetInnerHTML={{ __html: `
          (function(){
            var t = localStorage.getItem('theme');
            if (t === 'light') return;
            if (t === 'dark' || window.matchMedia('(prefers-color-scheme: dark)').matches) {
              document.documentElement.classList.add('dark');
            }
          })();
        `}} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body className={`${inter.className}`}>
        <PrivyProvider>
          <div className="min-h-screen flex flex-col">
            <div className="flex-1">
              {children}
            </div>
            <Footer />
          </div>
        </PrivyProvider>
      </body>
    </html>
  )
}
