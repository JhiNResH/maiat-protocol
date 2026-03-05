'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function RedirectToMonitor() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/agent')
  }, [router])

  return null
}
