'use client'

import { usePrivy } from '@privy-io/react-auth'
import { Wallet, LogOut } from 'lucide-react'

export function ConnectButton() {
  const { ready, authenticated, login, logout, user } = usePrivy()

  if (!ready) return null

  if (authenticated && user?.wallet?.address) {
    const addr = user.wallet.address
    const short = `${addr.slice(0, 6)}...${addr.slice(-4)}`

    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-txt-secondary">{short}</span>
        <button
          onClick={logout}
          className="p-1.5 rounded-lg hover:bg-bg-primary transition-colors"
          title="Disconnect"
        >
          <LogOut className="w-3.5 h-3.5 text-txt-muted" />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={login}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gold/40 text-gold text-sm font-medium hover:bg-gold/10 transition-colors"
    >
      <Wallet className="w-4 h-4" />
      Connect
    </button>
  )
}
