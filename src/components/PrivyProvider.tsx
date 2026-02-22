'use client'

import { useState, useEffect } from 'react'
import { PrivyProvider as PrivyLib } from '@privy-io/react-auth'

export function PrivyProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID

  // During SSR/prerender or if no app ID, render children without Privy
  if (!mounted || !appId) {
    return <>{children}</>
  }

  return (
    <PrivyLib
      appId={appId}
      config={{
        appearance: {
          theme: 'dark',
          accentColor: '#8b5cf6',
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
      }}
    >
      {children}
    </PrivyLib>
  )
}
