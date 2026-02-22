'use client'

import { useState } from 'react'
import { Loader2, ShieldCheck, AlertTriangle, XCircle } from 'lucide-react'

interface VerificationResult {
  score: number
  verdict: 'authentic' | 'suspicious' | 'spam'
  reasoning: string
  model: string
  provider: string
  verified: boolean
  kiteVerified?: boolean
  kiteTxHash?: string
}

interface VerificationButtonProps {
  reviewId: string
  title: string
  content: string
  rating: number
  category: string
  onVerificationComplete?: (result: VerificationResult) => void
}

export function VerificationButton({
  reviewId,
  title,
  content,
  rating,
  category,
  onVerificationComplete,
}: VerificationButtonProps) {
  const [verifying, setVerifying] = useState(false)
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [paymentRequired, setPaymentRequired] = useState(false)

  const handleVerify = async () => {
    setVerifying(true)
    setError(null)
    setPaymentRequired(false)

    try {
      // Step 1: x402 Payment verification (Kite)
      const kiteRes = await fetch('/api/verify-kite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewId,
          agentAddress: '0x0000000000000000000000000000000000000000', // Mock agent address
          paymentProof: `proof-${Date.now()}`, // Mock payment proof
          verificationLevel: 'basic',
        }),
      })

      if (!kiteRes.ok && kiteRes.status !== 402) {
        const errorText = await kiteRes.text()
        console.error('Kite API error:', errorText)
        throw new Error(`Kite API error (${kiteRes.status})`)
      }

      const kiteData = await kiteRes.json()

      // Check if payment required (HTTP 402)
      if (kiteRes.status === 402) {
        setPaymentRequired(true)
        setError(`Payment required: ${kiteData.paymentAmount} KITE to ${kiteData.paymentAddress}`)
        setVerifying(false)
        return
      }

      if (!kiteRes.ok) {
        throw new Error(kiteData.message || 'Kite verification failed')
      }

      // Step 2: 0G Compute AI verification
      const ogRes = await fetch('/api/verify-0g', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          rating,
          category,
        }),
      })

      if (!ogRes.ok) {
        const errorText = await ogRes.text()
        console.error('0G API error:', errorText)
        throw new Error(`0G verification failed (${ogRes.status})`)
      }

      const ogData = await ogRes.json()
      
      // Handle both response formats (direct or nested)
      const verification = ogData.verification || ogData
      if (!verification.score || !verification.verdict) {
        throw new Error('Invalid 0G response format')
      }
      
      const verificationResult: VerificationResult = {
        ...verification,
        kiteVerified: kiteData.success,
        kiteTxHash: kiteData.kiteChainTx,
      }

      setResult(verificationResult)
      if (onVerificationComplete) {
        onVerificationComplete(verificationResult)
      }
    } catch (err: any) {
      console.error('Verification error:', err)
      setError(err.message || 'Verification failed')
    } finally {
      setVerifying(false)
    }
  }

  // Already verified - show result
  if (result) {
    const verdictConfig = {
      authentic: {
        icon: ShieldCheck,
        color: 'text-green-400',
        bgColor: 'bg-green-500/20',
        borderColor: 'border-green-500/30',
        label: 'Authentic',
      },
      suspicious: {
        icon: AlertTriangle,
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/20',
        borderColor: 'border-yellow-500/30',
        label: 'Suspicious',
      },
      spam: {
        icon: XCircle,
        color: 'text-red-400',
        bgColor: 'bg-red-500/20',
        borderColor: 'border-red-500/30',
        label: 'Spam',
      },
    }

    const config = verdictConfig[result.verdict]
    const Icon = config.icon

    return (
      <div className={`p-3 rounded-lg border ${config.bgColor} ${config.borderColor} space-y-2`}>
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${config.color}`} />
          <span className={`font-semibold ${config.color}`}>{config.label}</span>
          <span className="text-sm text-gray-400">• Score: {result.score}/100</span>
        </div>
        <p className="text-sm text-gray-300">{result.reasoning}</p>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span title="Verified by 0G Compute Network">
            🔗 {result.provider}
          </span>
          {result.kiteVerified && (
            <span title="Paid via Kite x402">
              💰 Kite Verified
            </span>
          )}
          {result.kiteTxHash && (
            <a
              href={`https://testnet.kitescan.ai/tx/${result.kiteTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:underline"
            >
              View Tx ↗
            </a>
          )}
        </div>
      </div>
    )
  }

  // Show error
  if (error) {
    return (
      <div className="p-3 rounded-lg border bg-red-500/10 border-red-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-400" />
            <span className="text-sm text-red-300">{error}</span>
          </div>
          <button
            onClick={handleVerify}
            className="text-xs text-red-400 hover:text-red-300 underline"
          >
            Retry
          </button>
        </div>
        {paymentRequired && (
          <div className="mt-2 text-xs text-gray-400">
            Get KITE tokens at{' '}
            <a
              href="https://faucet.gokite.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:underline"
            >
              faucet.gokite.ai ↗
            </a>
          </div>
        )}
      </div>
    )
  }

  // Verify button
  return (
    <button
      onClick={handleVerify}
      disabled={verifying}
      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300 hover:bg-purple-500/30 hover:border-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
    >
      {verifying ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Verifying...</span>
        </>
      ) : (
        <>
          <ShieldCheck className="w-4 h-4" />
          <span>AI Verify</span>
        </>
      )}
    </button>
  )
}
