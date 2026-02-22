'use client'

import { PrivyProvider as PrivyLib } from '@privy-io/react-auth'

export function PrivyProvider({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID

  // If no Privy app ID, render without Privy (auth will be disabled)
  if (!appId) {
    console.warn('NEXT_PUBLIC_PRIVY_APP_ID not configured, authentication disabled')
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
