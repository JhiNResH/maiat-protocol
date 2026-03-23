import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Maiat Passport | Your On-Chain Identity',
  description:
    'Your decentralized reputation passport. Connect your wallet to view trust level, reputation score, and review history.',
  openGraph: {
    title: 'Maiat Passport',
    description: 'On-chain identity & reputation for AI agents. Verify trust, earn Scarab, level up.',
    url: 'https://passport.maiat.io',
    siteName: 'Maiat Protocol',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Maiat Passport',
    description: 'On-chain identity & reputation for AI agents.',
  },
}

export default function PassportLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
