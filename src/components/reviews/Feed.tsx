'use client'

import { useState, useEffect } from 'react'
import { Flame, Clock, TrendingUp } from 'lucide-react'
import { ReviewCard } from './ReviewCard'

type SortOption = 'hot' | 'new' | 'top'

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
  }
}

export function Feed() {
  const [sortBy, setSortBy] = useState<SortOption>('hot')
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchReviews() {
      try {
        const res = await fetch(`/api/reviews?sort=${sortBy}`)
        const data = await res.json()
        setReviews(data.reviews || [])
      } catch (error) {
        console.error('Failed to fetch reviews:', error)
        setReviews([])
      } finally {
        setLoading(false)
      }
    }
    fetchReviews()
  }, [sortBy])

  const sortOptions: { value: SortOption; label: string; icon: React.ReactNode }[] = [
    { value: 'hot', label: 'Hot', icon: <Flame className="w-4 h-4" /> },
    { value: 'new', label: 'New', icon: <Clock className="w-4 h-4" /> },
    { value: 'top', label: 'Top', icon: <TrendingUp className="w-4 h-4" /> },
  ]

  return (
    <div className="space-y-4">
      {/* Posts */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-[#6b6b70]">Loading reviews...</div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-8 text-[#6b6b70]">No reviews yet. Be the first!</div>
        ) : (
          reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))
        )}
      </div>

      {/* Load More */}
      {reviews.length > 0 && (
        <div className="text-center py-4">
          <button className="px-6 py-2 bg-[#1f1f23] hover:bg-[#2a2a2e] rounded-full text-sm font-medium text-[#adadb0] transition-colors">
            Load More Reviews
          </button>
        </div>
      )}
    </div>
  )
}
