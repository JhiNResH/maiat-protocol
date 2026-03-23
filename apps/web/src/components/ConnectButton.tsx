'use client'

import { usePrivy, useWallets } from '@privy-io/react-auth'
import { Wallet, LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getAddress } from 'viem'
import confetti from 'canvas-confetti'

export function ConnectButton() {
  const { login, authenticated, user, logout } = usePrivy()
  const { wallets } = useWallets()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const wallet = wallets[0]
  const address = wallet?.address || user?.wallet?.address

  const handleLogout = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await logout()
  }

  if (authenticated && address) {
    const checksummed = getAddress(address)
    const short = `${checksummed.slice(0, 6)}...${checksummed.slice(-4)}`

    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/10 border border-gold/20 text-gold text-sm font-medium">
          <Wallet className="w-4 h-4" />
          {short}
        </div>
        <button
          onClick={handleLogout}
          className="p-1.5 rounded-lg border border-white/10 text-txt-secondary hover:bg-white/5 transition-colors"
          title="Logout"
        >
          <LogOut className="w-4 h-4" />
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
