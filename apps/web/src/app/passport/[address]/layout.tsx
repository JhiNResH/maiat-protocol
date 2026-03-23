import type { Metadata } from 'next'

interface Props {
  params: Promise<{ address: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address } = await params
  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'Agent'

  return {
    title: `${short} | Maiat Passport`,
    description: `View the on-chain trust passport for ${short}. Reputation score, reviews, and Scarab balance.`,
    openGraph: {
      title: `${short} — Maiat Passport`,
      description: `On-chain trust profile for ${short}. See reputation, reviews, and trust level.`,
      url: `https://passport.maiat.io/${address}`,
      siteName: 'Maiat Protocol',
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${short} — Maiat Passport`,
      description: `On-chain trust profile. Reputation, reviews, trust level.`,
    },
  }
}

export default function PassportAddressLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
