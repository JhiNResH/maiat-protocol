'use client'

import { type ReactNode } from 'react'
import { PrivyProvider as Privy } from '@privy-io/react-auth'

const PRIVY_APP_ID = (process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '').trim()

export function PrivyProvider({ children }: { children: ReactNode }) {
  if (!PRIVY_APP_ID) {
    return <>{children}</>
  }

  return (
    <Privy
      appId={PRIVY_APP_ID}
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
