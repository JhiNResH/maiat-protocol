'use client'

import { type ReactNode } from 'react'
import { PrivyProvider as Privy } from '@privy-io/react-auth'

export function PrivyProvider({ children }: { children: ReactNode }) {
  const appId = (process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '').trim()

  if (!appId) {
    console.warn('Privy App ID is missing. Auth features will be disabled.')
    return <>{children}</>
  }

  return (
    <Privy
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
    </Privy>
  )
}
