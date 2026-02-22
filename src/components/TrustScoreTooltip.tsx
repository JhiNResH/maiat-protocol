'use client'

import { useState } from 'react'

interface TrustScoreBreakdown {
  onChainActivity: number
  verifiedReviews: number
  communityTrust: number
  aiQualityScore: number
  total: number
}

function calculateBreakdown(
  trustScore: number,
  reviewCount: number,
  avgRating: number
): TrustScoreBreakdown {
  // Simplified breakdown for display purposes
  // On-chain Activity: 40 pts (based on trust score tier)
  const onChainActivity = trustScore >= 80 ? 36 : trustScore >= 60 ? 28 : 20
  
  // Verified Reviews: 30 pts (based on review count)
  const verifiedReviews = Math.min(30, Math.round((reviewCount / 50) * 30))
  
  // Community Trust: 20 pts (based on avg rating)
  const communityTrust = Math.round((avgRating / 5) * 20)
  
  // AI Quality Score: 10 pts (remainder to match total)
  const aiQualityScore = Math.max(0, trustScore - onChainActivity - verifiedReviews - communityTrust)
  
  return {
    onChainActivity,
    verifiedReviews,
    communityTrust,
    aiQualityScore,
    total: trustScore,
  }
}

export function TrustScoreTooltip({
  trustScore,
  reviewCount,
  avgRating,
  scoreColor,
  barColor,
}: {
  trustScore: number
  reviewCount: number
  avgRating: number
  scoreColor: string
  barColor: string
}) {
  const [show, setShow] = useState(false)
  const breakdown = calculateBreakdown(trustScore, reviewCount, avgRating)

  return (
    <div
      className="relative"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <div className="flex items-center gap-1.5 cursor-help">
        <div className={`w-0.5 h-4 rounded-full ${barColor}`} />
        <span className={`text-sm font-bold font-mono ${scoreColor}`}>{trustScore}</span>
      </div>
      
      {show && (
        <div className="absolute z-10 left-0 top-full mt-1 bg-white dark:bg-[#1a1b23] border border-gray-300 dark:border-gray-600 rounded-md shadow-lg p-3 w-56 text-xs font-mono">
          <div className="font-bold mb-2 text-gray-900 dark:text-gray-100">Trust Score Breakdown</div>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">On-chain Activity:</span>
              <span className="font-bold text-gray-900 dark:text-gray-100">{breakdown.onChainActivity}/40</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Verified Reviews:</span>
              <span className="font-bold text-gray-900 dark:text-gray-100">{breakdown.verifiedReviews}/30</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Community Trust:</span>
              <span className="font-bold text-gray-900 dark:text-gray-100">{breakdown.communityTrust}/20</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">AI Quality Score:</span>
              <span className="font-bold text-gray-900 dark:text-gray-100">{breakdown.aiQualityScore}/10</span>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 pt-1.5 mt-1.5 flex justify-between">
              <span className="font-bold text-gray-900 dark:text-gray-100">Total:</span>
              <span className={`font-bold ${scoreColor}`}>{breakdown.total}/100</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
