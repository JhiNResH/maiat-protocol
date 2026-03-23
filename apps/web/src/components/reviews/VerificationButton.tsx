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

  const handleVerify = async () => {
    setVerifying(true)
    setError(null)

    try {
      const res = await fetch('/api/verify-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewId,
          title,
          content,
          rating,
          category,
        }),
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Verification failed (${res.status}): ${errorText}`)
      }

      const data = await res.json()
      const verification = data.verification || data

      if (!verification.score || !verification.verdict) {
        throw new Error('Invalid response format')
      }

      const verificationResult: VerificationResult = {
        score: verification.score,
        verdict: verification.verdict,
        reasoning: verification.reasoning,
        model: verification.model || 'gemini',
        provider: verification.provider || 'Maiat AI',
        verified: verification.verified ?? verification.score >= 60,
      }

      setResult(verificationResult)
      onVerificationComplete?.(verificationResult)
    } catch (err: any) {
      console.error('Verification error:', err)
      setError(err.message || 'Verification failed')
    } finally {
      setVerifying(false)
    }
  }

  if (result) {
    const verdictConfig = {
      authentic: {
        icon: ShieldCheck,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/20',
        borderColor: 'border-blue-500/30',
        label: 'Authentic',
      },
      suspicious: {
        icon: AlertTriangle,
        color: 'text-cyan-400',
        bgColor: 'bg-cyan-500/20',
        borderColor: 'border-cyan-500/30',
        label: 'Suspicious',
      },
      spam: {
        icon: XCircle,
        color: 'text-slate-400',
        bgColor: 'bg-slate-500/20',
        borderColor: 'border-slate-500/30',
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
          <span>🔗 {result.provider}</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-3 rounded-lg border bg-slate-500/10 border-slate-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-slate-400" />
            <span className="text-sm text-slate-300">{error}</span>
          </div>
          <button
            onClick={handleVerify}
            className="text-xs text-slate-400 hover:text-slate-300 underline"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

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
