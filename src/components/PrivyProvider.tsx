'use client'

import { type ReactNode, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

// Dynamically import Privy — prevents SSR prerender crash during `next build`
// Privy initializes JS globals that don't exist in the Node.js render environment.
const PrivyClient = dynamic(
  () => import('@privy-io/react-auth').then(m => m.PrivyProvider),
  { ssr: false }
)

export function PrivyProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const appId = (process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '').trim()

  useEffect(() => { setMounted(true) }, [])

  // On server (build/SSR): render children only — no Privy
  if (!mounted || !appId) {
    return <>{children}</>
  }

  return (
    <PrivyClient
      appId={appId}
      config={{
        appearance: {
          theme: 'dark',
          accentColor: '#D4A843',
        },
        loginMethods: ['wallet'],
        embeddedWallets: {
          createOnLogin: 'off',
        },
      }}
    >
      {children}
    </PrivyClient>
  )
}
