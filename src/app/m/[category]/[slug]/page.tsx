import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ category: string; slug: string }>
}

// Canonical URL is now /agent/[slug] — redirect for backwards compatibility
export default async function LegacyProjectPage({ params }: Props) {
  const { slug } = await params
  redirect(`/agent/${slug}`)
}
