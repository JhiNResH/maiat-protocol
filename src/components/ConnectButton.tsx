'use client'

import { usePrivy } from '@privy-io/react-auth'
import { Wallet, LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'
import confetti from 'canvas-confetti'
import toast from 'react-hot-toast'

export function ConnectButton() {
  const { ready, authenticated, login, logout, user } = usePrivy()
  const [claimed, setClaimed] = useState(false)

  useEffect(() => {
    async function claimDailyScarab() {
      if (!authenticated || !user?.wallet?.address || claimed) return

      try {
        const res = await fetch('/api/v1/scarab/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: user.wallet.address }),
        })

        if (!res.ok) {
          // 400 means already claimed today, which is normal
          setClaimed(true)
          return
        }

        const data = await res.json()
        setClaimed(true)

        // Trigger confetti
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#d4a017', '#e8b84a', '#f5d57b'],
          disableForReducedMotion: true,
        })

        // Show achievement toast
        toast.custom(
          (t) => (
            <div
              className={`${
                t.visible ? 'animate-enter' : 'animate-leave'
              } max-w-md w-full bg-[#1a1c29] shadow-lg rounded-xl pointer-events-auto flex ring-1 ring-gold/30`}
            >
              <div className="flex-1 w-0 p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 pt-0.5 text-2xl">🎉</div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-bold text-gold">
                      {data.isFirstClaim ? 'Welcome to Maiat!' : 'Daily Login Bonus!'}
                    </p>
                    <p className="mt-1 text-sm text-txt-secondary">
                      You claimed <span className="text-gold font-bold">{data.amount} Scarab</span>.
                      {data.streak > 1 && ` You're on a ${data.streak}-day streak! 🔥`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ),
          { duration: 4000 }
        )
      } catch (err) {
        console.error('Failed to claim daily Scarab:', err)
      }
    }

    claimDailyScarab()
  }, [authenticated, user?.wallet?.address, claimed])

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
