'use client'

import { useState } from 'react'
import { TrustBadge } from './TrustBadge'
import { VoteButtons } from './VoteButtons'
import { ReviewForm } from './ReviewForm'
import { ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'

interface ProjectCardProps {
  id: string
  name: string
  description: string
  image?: string | null
  status: 'approved' | 'pending' | 'rejected'
  avgRating: number
  reviewCount: number
  website?: string | null
  category?: string
  upvotes?: number
  downvotes?: number
}

export function ProjectCard({
  id,
  name,
  description,
  image,
  status,
  avgRating,
  reviewCount,
  website,
  category,
  upvotes = 0,
  downvotes = 0,
}: ProjectCardProps) {
  const [expanded, setExpanded] = useState(false)
  const stars = '★'.repeat(Math.round(avgRating)) + '☆'.repeat(5 - Math.round(avgRating))

  return (
    <div
      className={`
      relative rounded-xl border p-4 transition-all duration-200
      ${expanded ? 'shadow-2xl' : 'hover:shadow-lg hover:-translate-y-0.5'}
      ${
        status === 'rejected'
          ? 'border-red-500/20 bg-red-950/20 hover:border-red-500/40'
          : status === 'pending'
          ? 'border-amber-500/20 bg-zinc-900/50 hover:border-amber-500/40'
          : 'border-zinc-700/50 bg-zinc-900/50 hover:border-purple-500/40'
      }
    `}
    >
      {/* Warning overlay for flagged */}
      {status === 'rejected' && (
        <div className="absolute top-2 right-2 bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full border border-red-500/30 animate-pulse">
          ⚠️ DANGER
        </div>
      )}

      {/* Main Card Content */}
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden">
          {image ? (
            <img src={image} alt={name} className="w-8 h-8 object-contain" />
          ) : (
            <span className="text-2xl">🧩</span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {category ? (
              <Link href={`/m/${category.replace('m/', '')}/${id}`} className="font-semibold text-white truncate hover:text-purple-300 transition-colors">
                {name}
              </Link>
            ) : (
              <h3 className="font-semibold text-white truncate">{name}</h3>
            )}
            <TrustBadge status={status} size="sm" />
            {website && (
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-500 hover:text-purple-400 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>

          <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{description}</p>

          <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
            <span className="text-amber-400">{stars}</span>
            <span>{avgRating.toFixed(1)}</span>
            <span>·</span>
            <span>{reviewCount} reviews</span>
          </div>

          {/* Vote Buttons */}
          <div className="mt-3">
            <VoteButtons
              projectId={id}
              projectName={name}
              initialUpvotes={upvotes}
              initialDownvotes={downvotes}
            />
          </div>

          {/* Expand/Collapse Button */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-3 flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-4 h-4" />
                <span>Hide review form</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                <span>Write a review</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Expanded Review Form */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-zinc-800">
          <ReviewForm
            projectId={id}
            projectName={name}
            onSuccess={() => {
              setExpanded(false)
              // Optionally refresh page or refetch data
              window.location.reload()
            }}
          />
        </div>
      )}
    </div>
  )
}
