'use client'

import { useState, useEffect, type ReactNode } from 'react'

export function PrivyProvider({ children }: { children: ReactNode }) {
  const [PrivyLib, setPrivyLib] = useState<any>(null)
  
  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID
    if (!appId) return
    
    import('@privy-io/react-auth')
      .then((mod) => setPrivyLib(() => mod.PrivyProvider))
      .catch((err) => console.warn('Privy load failed:', err))
  }, [])

  if (!PrivyLib) {
    return <>{children}</>
  }

  return (
    <PrivyLib
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID}
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
