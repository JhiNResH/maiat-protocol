'use client'

import { useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'

interface VoteButtonsProps {
  projectId: string
  projectName: string
  initialUpvotes?: number
  initialDownvotes?: number
}

export function VoteButtons({
  projectId,
  projectName,
  initialUpvotes = 0,
  initialDownvotes = 0,
}: VoteButtonsProps) {
  const { authenticated, user, login } = usePrivy()
  const [upvotes, setUpvotes] = useState(initialUpvotes)
  const [downvotes, setDownvotes] = useState(initialDownvotes)
  const [voting, setVoting] = useState(false)
  const [hasVoted, setHasVoted] = useState(false)

  const address = user?.wallet?.address

  const handleVote = async (voteType: 'upvote' | 'downvote') => {
    if (!authenticated) { login(); return }
    if (!address) return

    setVoting(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, voteType }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Vote failed')

      if (voteType === 'upvote') setUpvotes(upvotes + 1)
      else setDownvotes(downvotes + 1)
      setHasVoted(true)
      alert(`✅ Vote recorded! (-5 Scarab spent)`)
    } catch (e: any) {
      alert(`❌ ${e.message}`)
    } finally {
      setVoting(false)
    }
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <button
        onClick={() => handleVote('upvote')}
        disabled={voting || hasVoted}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-mono text-xs transition-all ${
          hasVoted ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'
        }`}
      >
        👍 <span>{upvotes}</span>
      </button>

      <button
        onClick={() => handleVote('downvote')}
        disabled={voting || hasVoted}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-mono text-xs transition-all ${
          hasVoted ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-red-50 text-red-500 hover:bg-red-100 border border-red-200'
        }`}
      >
        👎 <span>{downvotes}</span>
      </button>

      {!authenticated && <span className="text-xs font-mono text-gray-400">Sign in to vote</span>}
      {hasVoted && <span className="text-xs font-mono text-gray-400">Voted ✓</span>}
    </div>
  )
}
