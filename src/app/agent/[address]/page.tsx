import type { Metadata } from 'next'
import AgentDetailClient from './AgentDetailClient'

interface Props {
  params: Promise<{ address: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address } = await params

  // For wallet addresses, attempt to fetch agent score for richer metadata
  const isWalletAddr = /^0x[0-9a-fA-F]{40}$/.test(address)
  if (isWalletAddr) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://maiat-protocol.vercel.app'
      const res = await fetch(`${baseUrl}/api/v1/agent/${address}`, {
        next: { revalidate: 300 },
      })
      if (res.ok) {
        const data = await res.json()
        const score = data.trustScore ?? '—'
        const verdict = data.verdict ?? 'unknown'
        const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`
        const agentName = data.breakdown?.name || shortAddr
        return {
          title: `${agentName} — Trust Score ${score}/100 | Maiat`,
          description: `ACP behavioral trust score for agent ${shortAddr}. Score: ${score}/100 · Verdict: ${verdict}. Powered by Maiat Protocol.`,
          openGraph: {
            title: `${agentName} Trust Score: ${score}/100`,
            description: `ACP behavioral intelligence for agent ${shortAddr}. Verdict: ${verdict.toUpperCase()}.`,
            url: `https://maiat-protocol.vercel.app/agent/${address}`,
          },
        }
      }
    } catch {
      // Fall through to default
    }
  }

  const shortAddr = isWalletAddr
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : address

  return {
    title: `${shortAddr} — Agent Trust Score | Maiat`,
    description: 'ACP behavioral trust scoring powered by Maiat Protocol.',
  }
}

export default function AgentPage() {
  return <AgentDetailClient />
}
