'use client'

import { useState, useEffect } from 'react'
import { ArrowRight, Star } from 'lucide-react'
import Link from 'next/link'

interface LeaderboardItem {
  rank: number
  id: string
  name: string
  category: string
  avgRating: number
  reviewCount: number
}

export function LeaderboardPreview() {
  const [items, setItems] = useState<LeaderboardItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const res = await fetch('/api/leaderboard?limit=5')
        const data = await res.json()
        const entries = (data.projects || []).map((p: any, idx: number) => ({
          rank: idx + 1,
          id: p.id,
          name: p.name,
          category: p.category,
          avgRating: p.avgRating || 0,
          reviewCount: p.reviewCount || 0,
        }))
        setItems(entries)
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error)
        setItems([])
      } finally {
        setLoading(false)
      }
    }
    fetchLeaderboard()
  }, [])

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="px-3 py-4 text-center text-[#6b6b70] text-xs">Loading...</div>
      ) : items.length === 0 ? (
        <div className="px-3 py-4 text-center text-[#6b6b70] text-xs">No data yet</div>
      ) : (
        items.map((item) => {
          const categorySlug = item.category.replace('m/', '')
          return (
            <Link
              key={item.id}
              href={`/m/${categorySlug}/${item.id}`}
              className="flex items-center gap-3 p-3 bg-[#0a0a0b] hover:bg-[#1a1a1d] border border-[#1f1f23] rounded-lg transition-colors group"
            >
              <span className="text-xs font-bold text-[#6b6b70] w-6">#{item.rank}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-white truncate group-hover:text-purple-400">
                  {item.name}
                </div>
                <div className="text-xs text-[#6b6b70]">{item.reviewCount} reviews</div>
              </div>
              <div className="flex items-center gap-1 text-amber-400 text-xs">
                <Star className="w-3 h-3 fill-amber-400" />
                {item.avgRating.toFixed(1)}
              </div>
            </Link>
          )
        })
      )}
    </div>
  )
}
