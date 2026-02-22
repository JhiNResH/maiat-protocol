'use client'

import { useState } from 'react'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { ShieldCheck, ExternalLink, Loader2 } from 'lucide-react'

interface BaseVerifyButtonProps {
  onVerified?: (token: string) => void
}

export function BaseVerifyButton({ onVerified }: BaseVerifyButtonProps) {
  const { authenticated, user } = usePrivy()
  const { wallets } = useWallets()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verified, setVerified] = useState(false)

  const handleVerify = async () => {
    if (!authenticated || !user?.wallet?.address) return

    setLoading(true)
    setError(null)

    try {
      const address = user.wallet.address
      const wallet = wallets.find(w => w.address === address)

      if (!wallet) {
        setError('Wallet not found')
        return
      }

      // Create SIWE message
      const nonce = Math.random().toString(36).substring(2, 15)
      const now = new Date().toISOString()
      const domain = window.location.host
      const uri = window.location.origin

      const message = {
        domain,
        address,
        statement: 'Verify your identity with Base Verify for Maiat.',
        uri,
        version: '1',
        chainId: 8453, // Base mainnet
        nonce,
        issuedAt: now,
        resources: ['https://verify.base.dev'],
      }

      // Format SIWE message string
      const messageString = `${message.domain} wants you to sign in with your Ethereum account:\n${message.address}\n\n${message.statement}\n\nURI: ${message.uri}\nVersion: ${message.version}\nChain ID: ${message.chainId}\nNonce: ${message.nonce}\nIssued At: ${message.issuedAt}\nResources:\n${message.resources.join('\n')}`

      // Sign with wallet
      const provider = await wallet.getEthereumProvider()
      const signature = await provider.request({
        method: 'personal_sign',
        params: [messageString, address],
      })

      // Call our verify endpoint
      const res = await fetch('/api/verify-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          signature,
          message,
          provider: 'x', // Default to X/Twitter verification
        }),
      })

      const data = await res.json()

      if (data.success && data.verified) {
        setVerified(true)
        onVerified?.(data.verificationToken)
      } else if (data.redirectUrl) {
        // Redirect to Base Verify Mini App
        window.open(data.redirectUrl, '_blank')
      } else {
        setError(data.message || 'Verification failed')
      }
    } catch (err: any) {
      console.error('Base Verify error:', err)
      setError(err.message || 'Failed to verify')
    } finally {
      setLoading(false)
    }
  }

  if (!authenticated) return null

  if (verified) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/10 border border-blue-500/30 rounded-xl">
        <ShieldCheck className="w-5 h-5 text-blue-400" />
        <span className="text-blue-400 text-sm font-medium">Verified Human</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleVerify}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2.5 bg-[#0052FF]/10 border border-[#0052FF]/30 rounded-xl text-[#0052FF] hover:bg-[#0052FF]/20 hover:border-[#0052FF]/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <ShieldCheck className="w-4 h-4" />
        )}
        <span className="text-sm font-medium">Verify with Base</span>
        <ExternalLink className="w-3 h-3 ml-1 opacity-50" />
      </button>
      {error && (
        <p className="text-xs text-red-400 pl-1">{error}</p>
      )}
    </div>
  )
}
