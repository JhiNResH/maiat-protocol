'use client'

import { useState, useEffect } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { ArrowLeft, Star, Send } from 'lucide-react'
import Link from 'next/link'
import { BaseVerifyButton } from '@/components/BaseVerifyButton'

interface Project {
  id: string
  name: string
  category: string
  image?: string
  avgRating: number
  reviewCount: number
}

export default function ReviewPage() {
  const { authenticated, user, login } = usePrivy()
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [search, setSearch] = useState('')
  const [rating, setRating] = useState(5)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [baseVerified, setBaseVerified] = useState(false)

  const address = user?.wallet?.address

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(data => setProjects(data.projects || []))
      .catch(() => {})
  }, [])

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleSubmit = async () => {
    if (!selectedProject || !address) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProject.id,
          address,
          rating,
          content: content.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to submit')
      setSuccess(true)
      setContent('')
      setRating(5)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl text-white mb-4">Sign in to write a review</h2>
          <button onClick={login} className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors">
            Connect Wallet
          </button>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-xl text-white mb-2">Review submitted!</h2>
          <p className="text-[#6b6b70] mb-6">Your review for {selectedProject?.name} is live.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => { setSuccess(false); setSelectedProject(null) }} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors">
              Write Another
            </button>
            <Link href="/" className="px-4 py-2 bg-[#1f1f23] hover:bg-[#2a2a2e] text-white rounded-lg transition-colors">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] pt-[80px] px-4">
      <div className="max-w-lg mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-[#6b6b70] hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <h1 className="text-2xl font-bold text-white mb-6">Write a Review</h1>

        {/* Step 1: Select Project */}
        {!selectedProject ? (
          <div>
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-4 py-3 bg-[#111113] border border-[#1f1f23] rounded-lg text-white placeholder-[#6b6b70] focus:border-purple-500 focus:outline-none mb-4"
            />
            <div className="space-y-2">
              {filtered.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProject(p)}
                  className="w-full flex items-center gap-3 p-3 bg-[#111113] border border-[#1f1f23] rounded-lg hover:border-purple-500/50 transition-colors text-left"
                >
                  <div className="w-10 h-10 bg-[#1f1f23] rounded-lg flex items-center justify-center text-lg">
                    {p.category === 'm/ai-agents' ? '🤖' : '🏦'}
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-medium">{p.name}</div>
                    <div className="text-[#6b6b70] text-xs">{p.category} · ★{p.avgRating} · {p.reviewCount} reviews</div>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-[#6b6b70] text-center py-8">No projects found</p>
              )}
            </div>
          </div>
        ) : (
          /* Step 2: Write Review */
          <div>
            <div className="flex items-center gap-3 p-3 bg-[#111113] border border-[#1f1f23] rounded-lg mb-6">
              <div className="w-10 h-10 bg-[#1f1f23] rounded-lg flex items-center justify-center text-lg">
                {selectedProject.category === 'm/ai-agents' ? '🤖' : '🏦'}
              </div>
              <div>
                <div className="text-white font-medium">{selectedProject.name}</div>
                <button onClick={() => setSelectedProject(null)} className="text-purple-400 text-xs hover:underline">Change</button>
              </div>
            </div>

            {/* Rating */}
            <div className="mb-6">
              <label className="text-[#adadb0] text-sm mb-2 block">Rating</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setRating(n)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-8 h-8 ${n <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-[#2a2a2e]'}`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="mb-6">
              <label className="text-[#adadb0] text-sm mb-2 block">Your Review</label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Share your experience..."
                rows={5}
                className="w-full px-4 py-3 bg-[#111113] border border-[#1f1f23] rounded-lg text-white placeholder-[#6b6b70] focus:border-purple-500 focus:outline-none resize-none"
              />
            </div>

            {/* Base Verify - Human Verification */}
            <div className="mb-6 p-4 bg-[#111113] border border-[#1f1f23] rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white text-sm font-medium">Verify you're human</p>
                  <p className="text-[#6b6b70] text-xs mt-0.5">Verified reviews get higher trust scores</p>
                </div>
                <BaseVerifyButton onVerified={() => setBaseVerified(true)} />
              </div>
            </div>

            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={submitting || !content.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
