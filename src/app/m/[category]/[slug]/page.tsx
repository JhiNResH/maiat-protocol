import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import ProjectPageClient from './ProjectPageClient'

interface Props {
  params: Promise<{ category: string; slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, slug } = await params
  try {
    const project = await prisma.project.findFirst({
      where: { OR: [{ slug }, { address: slug }] },
    })
    if (project) {
      const score = project.trustScore ? (project.trustScore / 10).toFixed(1) : '—'
      return {
        title: `${project.name} (${project.symbol ?? project.chain}) — Trust Score ${score} | Maiat`,
        description: project.description ?? `On-chain trust score and community reviews for ${project.name} on ${project.chain}. Powered by Maiat Protocol.`,
        openGraph: {
          title: `${project.name} Trust Score: ${score}/10`,
          description: project.description ?? `Verified on-chain intelligence for ${project.name}.`,
          url: `https://maiat-protocol.vercel.app/m/${category}/${slug}`,
        },
      }
    }
  } catch {}
  return {
    title: `${slug} — Trust Score | Maiat`,
    description: 'On-chain trust scoring powered by Maiat Protocol.',
  }
}

export default function ProjectPage({ params }: Props) {
  return <ProjectPageClient />
}
