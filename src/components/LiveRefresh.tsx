'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export function LiveRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter()
  const [isLive, setIsLive] = useState(true)

  useEffect(() => {
    if (!isLive) return
    const id = setInterval(() => router.refresh(), intervalMs)
    return () => clearInterval(id)
  }, [isLive, intervalMs, router])

  return (
    <button
      onClick={() => setIsLive(!isLive)}
      className={`flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded-full transition-colors ${
        isLive
          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
      {isLive ? 'LIVE' : 'PAUSED'}
    </button>
  )
}
