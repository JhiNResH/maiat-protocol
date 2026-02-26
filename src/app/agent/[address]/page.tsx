import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import AgentDetailClient from './AgentDetailClient'

interface Props {
  params: Promise<{ address: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address } = await params
  try {
    const project = await prisma.project.findFirst({
      where: { OR: [{ slug: address }, { address }] },
    })
    if (project) {
      const score = project.trustScore ? (project.trustScore / 10).toFixed(1) : '—'
      return {
        title: `${project.name} — Trust Score ${score}/10 | Maiat`,
        description:
          project.description ??
          `On-chain trust score and reviews for ${project.name} on ${project.chain}. Powered by Maiat Protocol.`,
        openGraph: {
          title: `${project.name} Trust Score: ${score}/10`,
          description:
            project.description ??
            `Verified on-chain intelligence for ${project.name}.`,
          url: `https://maiat-protocol.vercel.app/agent/${address}`,
        },
      }
    }
  } catch {}
  return {
    title: `${address} — Trust Score | Maiat`,
    description: 'On-chain trust scoring powered by Maiat Protocol.',
  }
}

export default function AgentPage() {
  return <AgentDetailClient />
}
