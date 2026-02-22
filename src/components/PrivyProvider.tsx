'use client'

import { useState, useEffect, type ReactNode, Component, type ErrorInfo } from 'react'

class PrivyErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('Privy initialization failed, running without wallet:', error.message)
  }
  render() {
    if (this.state.hasError) return this.props.children
    return this.props.children
  }
}

export function PrivyProvider({ children }: { children: ReactNode }) {
  const [Provider, setProvider] = useState<any>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID
    if (!appId || appId.length < 10) {
      setFailed(true)
      return
    }

    import('@privy-io/react-auth')
      .then((mod) => setProvider(() => mod.PrivyProvider))
      .catch(() => setFailed(true))
  }, [])

  if (!Provider || failed) {
    return <>{children}</>
  }

  return (
    <PrivyErrorBoundary>
      <Provider
        appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
        config={{
          appearance: { theme: 'dark', accentColor: '#8b5cf6' },
          embeddedWallets: { createOnLogin: 'users-without-wallets' },
        }}
      >
        {children}
      </Provider>
    </PrivyErrorBoundary>
  )
}
