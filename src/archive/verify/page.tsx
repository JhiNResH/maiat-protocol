'use client'

import { useState, useEffect, Suspense } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useSearchParams } from 'next/navigation'
import { ShieldCheck, Link2, Loader2, CheckCircle, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { BaseVerifyButton } from '@/components/BaseVerifyButton'

function VerifyContent() {
  const { authenticated, user, login } = usePrivy()
  const searchParams = useSearchParams()
  const tgUserId = searchParams.get('tg')
  const [linking, setLinking] = useState(false)
  const [linked, setLinked] = useState(false)
  const [baseVerified, setBaseVerified] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const address = user?.wallet?.address

  // Auto-link when wallet connects
  useEffect(() => {
    if (authenticated && address && tgUserId && !linked) {
      linkTelegramWallet()
    }
  }, [authenticated, address, tgUserId])

  const linkTelegramWallet = async () => {
    if (!address || !tgUserId) return
    setLinking(true)
    setError(null)

    try {
      const res = await fetch('/api/verify-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramUserId: tgUserId, walletAddress: address }),
      })
      const data = await res.json()
      if (data.success) {
        setLinked(true)
      } else {
        setError(data.error || 'Failed to link')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLinking(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center">
            <ShieldCheck className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Verify Your Identity</h1>
          <p className="text-zinc-500 text-sm">
            {tgUserId
              ? 'Link your wallet to your Telegram account'
              : 'Verify with Base to get trusted reviewer status'}
          </p>
        </div>

        {/* Steps */}
        <div className="bg-[#111113] border border-[#1f1f23] rounded-2xl p-6 space-y-6">
          {/* Step 1: Connect Wallet */}
          <div className="flex items-start gap-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${authenticated ? 'bg-green-500/20 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>
              {authenticated ? <CheckCircle className="w-4 h-4" /> : '1'}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-medium ${authenticated ? 'text-green-400' : 'text-white'}`}>
                {authenticated ? 'Wallet Connected' : 'Connect Wallet'}
              </p>
              {authenticated && address ? (
                <p className="text-xs text-zinc-500 mt-1 font-mono">{address.slice(0, 10)}...{address.slice(-8)}</p>
              ) : (
                <button onClick={login}
                  className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors">
                  Connect Wallet
                </button>
              )}
            </div>
          </div>

          {/* Step 2: Link Telegram (if from TG) */}
          {tgUserId && (
            <div className="flex items-start gap-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${linked ? 'bg-green-500/20 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>
                {linked ? <CheckCircle className="w-4 h-4" /> : linking ? <Loader2 className="w-4 h-4 animate-spin" /> : '2'}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-medium ${linked ? 'text-green-400' : 'text-white'}`}>
                  {linked ? 'Telegram Linked!' : linking ? 'Linking...' : 'Link Telegram Account'}
                </p>
                {linked ? (
                  <p className="text-xs text-zinc-500 mt-1">Telegram ID: {tgUserId} ↔ Wallet linked</p>
                ) : (
                  <p className="text-xs text-zinc-500 mt-1">Your Telegram reviews will be linked to this wallet</p>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Base Verify */}
          <div className="flex items-start gap-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${baseVerified ? 'bg-green-500/20 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>
              {baseVerified ? <CheckCircle className="w-4 h-4" /> : tgUserId ? '3' : '2'}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-medium ${baseVerified ? 'text-green-400' : 'text-white'}`}>
                {baseVerified ? 'Base Verified ✓' : 'Verify with Base'}
              </p>
              <p className="text-xs text-zinc-500 mt-1 mb-2">Prove you're human — your reviews get 2x trust weight</p>
              {authenticated && !baseVerified && (
                <BaseVerifyButton onVerified={() => setBaseVerified(true)} />
              )}
            </div>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>

        {/* Benefits */}
        <div className="mt-6 bg-[#111113] border border-[#1f1f23] rounded-2xl p-4">
          <p className="text-xs font-medium text-zinc-400 mb-3">What you unlock:</p>
          <div className="space-y-2 text-xs text-zinc-500">
            <div className="flex items-center gap-2">
              <span className="text-blue-400">🛡️</span>
              <span>"Verified Human" badge on all your reviews</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400">2x</span>
              <span>Your reviews count double in trust scores</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-purple-400">💸</span>
              <span>Lower swap fees based on reputation</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-yellow-400">🪲</span>
              <span>Bonus Scarab points for verified reviews</span>
            </div>
          </div>
        </div>

        {/* Back */}
        <div className="mt-4 text-center">
          <Link href="/" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
            ← Back to Maiat
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>}>
      <VerifyContent />
    </Suspense>
  )
}
