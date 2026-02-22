'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { VerificationButton } from './VerificationButton'

interface Review {
  id: string
  rating: number
  content: string
  upvotes: number
  downvotes: number
  createdAt: string
  reviewer: {
    id: string
    address: string
    displayName: string | null
    avatarUrl: string | null
  }
  project: {
    id: string
    name: string
    image: string | null
    category: string
    address?: string
  }
}

interface ReviewCardProps {
  review: Review
}

interface VerificationBadges {
  baseVerified: boolean
  hasInteracted: boolean
  aiVerified: boolean
  aiScore?: number
  aiVerdict?: 'authentic' | 'suspicious' | 'spam'
}

const CATEGORY_ICONS: Record<string, string> = {
  'm/ai-agents': '🤖',
  'm/defi': '🏦',
}

export function ReviewCard({ review }: ReviewCardProps) {
  const truncateAddress = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : 'Anon'
  const categorySlug = review.project.category.replace('m/', '')
  const [badges, setBadges] = useState<VerificationBadges>({
    baseVerified: false,
    hasInteracted: false,
    aiVerified: false,
  })
  const [loading, setLoading] = useState(true)

  // Check verification badges on mount
  useEffect(() => {
    async function checkVerifications() {
      try {
        // Check Base Verify status (mock for now)
        const baseVerified = Math.random() > 0.7 // 30% chance for demo

        // Check BSCScan interaction
        let hasInteracted = false
        if (review.project.address) {
          const res = await fetch(
            `/api/verify-interaction?wallet=${review.reviewer.address}&project=${review.project.address}`
          )
          if (res.ok) {
            const data = await res.json()
            hasInteracted = data.hasInteracted
          }
        }

        setBadges({ baseVerified, hasInteracted, aiVerified: false })
      } catch (error) {
        console.error('Failed to check badges:', error)
      } finally {
        setLoading(false)
      }
    }

    checkVerifications()
  }, [review.reviewer.address, review.project.address])

  return (
    <div className="bg-[#111113] border border-[#1f1f23] rounded-lg p-4 hover:border-purple-500/30 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-700 rounded-full flex items-center justify-center text-xs text-white font-bold">
            {review.reviewer.displayName?.slice(0, 2).toUpperCase() || review.reviewer.address.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm text-[#d9d4e8]">
                {review.reviewer.displayName || truncateAddress(review.reviewer.address)}
              </span>
              {/* Verification Badges */}
              {!loading && (
                <>
                  {badges.baseVerified && (
                    <span 
                      className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      title="Verified Human (Base Verify)"
                    >
                      ✓ Human
                    </span>
                  )}
                  {badges.hasInteracted && (
                    <span 
                      className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400 border border-green-500/30"
                      title="Verified User (Used this protocol)"
                    >
                      ✓ User
                    </span>
                  )}
                  {badges.aiVerified && badges.aiVerdict === 'authentic' && (
                    <span 
                      className="px-2 py-0.5 text-xs rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30"
                      title={`0G AI Verified (${badges.aiScore}/100)`}
                    >
                      🤖 AI Verified
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="text-xs text-[#6b6b70]">
              {new Date(review.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 text-amber-400">
          {[...Array(5)].map((_, i) => (
            <span key={i} className={i < review.rating ? 'text-amber-400' : 'text-[#1f1f23]'}>
              ★
            </span>
          ))}
        </div>
      </div>

      {/* Target Project */}
      <Link 
        href={`/m/${categorySlug}/${review.project.id}`}
        className="flex items-center gap-2 mb-3 hover:text-purple-400 transition-colors"
      >
        <span className="text-lg">{CATEGORY_ICONS[review.project.category] || '📄'}</span>
        <span className="text-sm text-[#6b6b70]">Reviewing:</span>
        <span className="text-sm font-medium text-purple-300">{review.project.name}</span>
      </Link>

      {/* Content */}
      <p className="text-[#d9d4e8]/80 mb-4 leading-relaxed text-sm">{review.content}</p>

      {/* Footer / Vote Bar */}
      <div className="flex items-center justify-between pt-3 border-t border-[#1f1f23]">
        <div className="flex items-center gap-4">
          {/* Simple Vote Display (TODO: make interactive) */}
          <div className="flex items-center gap-1.5 text-[#6b6b70]">
            <span className={review.upvotes - review.downvotes > 0 ? 'text-green-400' : ''}>▲</span>
            <span className="text-sm font-bold">
              {review.upvotes - review.downvotes}
            </span>
            <span>▼</span>
          </div>
          <button className="flex items-center gap-1 text-[#6b6b70] hover:text-blue-400 transition text-sm">
            <span>💬</span>
            <span>0</span>
          </button>
        </div>
      </div>

      {/* AI Verification Section */}
      {!badges.aiVerified && (
        <div className="mt-3 pt-3 border-t border-[#1f1f23]">
          <VerificationButton
            reviewId={review.id}
            title={review.project.name}
            content={review.content}
            rating={review.rating}
            category={review.project.category}
            onVerificationComplete={(result) => {
              setBadges(prev => ({
                ...prev,
                aiVerified: true,
                aiScore: result.score,
                aiVerdict: result.verdict,
              }))
            }}
          />
        </div>
      )}
    </div>
  )
}
