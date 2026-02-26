'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

// Category → URL segment mapping
function toCategorySlug(cat: string): string {
  const c = cat?.toLowerCase() ?? ''
  if (c.includes('agent') || c === 'm/ai-agents') return 'agents'
  if (c.includes('defi') || c === 'dex' || c === 'lending') return 'defi'
  if (c.includes('token') || c.includes('meme')) return 'tokens'
  return 'explore'
}

export default function AgentRedirect() {
  const params = useParams()
  const router = useRouter()
  const slug = params.address as string

  useEffect(() => {
    async function redirect() {
      try {
        // Look up project to get its category for proper URL
        const res = await fetch(`/api/v1/project/${slug}`)
        if (res.ok) {
          const { project } = await res.json()
          const cat = toCategorySlug(project.category)
          const projectSlug = project.slug || slug
          router.replace(`/m/${cat}/${projectSlug}`)
        } else {
          // Unknown address — send to /m/explore/[address] for auto-create
          router.replace(`/m/explore/${slug}`)
        }
      } catch {
        router.replace(`/m/explore/${slug}`)
      }
    }
    if (slug) redirect()
  }, [slug, router])

  return (
    <div className="min-h-screen bg-[#030303] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#d4a017] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
