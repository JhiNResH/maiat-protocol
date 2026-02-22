'use client'

import { type ReactNode } from 'react'

// Privy disabled temporarily — app ID validation issue causes client-side crash.
// Wallet features will be re-enabled once Privy app ID is verified.
export function PrivyProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}
