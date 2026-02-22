'use client'

import { useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { X } from 'lucide-react'

interface AddProjectFormProps {
  category: string
  onClose: () => void
  onSuccess?: () => void
}

const CATEGORIES = [
  { value: 'm/ai-agents', label: '🤖 AI Agents' },
  { value: 'm/defi', label: '🏦 DeFi Protocols' },
]

export function AddProjectForm({ category, onClose, onSuccess }: AddProjectFormProps) {
  const { authenticated, user, login } = usePrivy()
  const [formData, setFormData] = useState({
    address: '',
    name: '',
    description: '',
    image: '',
    website: '',
    category: category,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const userAddress = user?.wallet?.address

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userAddress) return

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          submittedBy: userAddress,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submission failed')

      // Success
      alert('✅ Project submitted for review!')
      if (onSuccess) onSuccess()
      onClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!authenticated) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-8 max-w-md w-full text-center">
          <h2 className="text-2xl font-bold mb-4">Sign In Required</h2>
          <p className="text-zinc-400 mb-6">
            You need to sign in to submit a project
          </p>
          <div className="flex gap-3">
            <button
              onClick={login}
              className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Add New Project</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Project Address */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              Project Address/ID <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="e.g., 0x1234... or unique identifier"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Contract address, package name, or unique identifier
            </p>
          </div>

          {/* Project Name */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              Project Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., GitHub Project, Uniswap V3, etc."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of what this project does..."
              rows={3}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              Category <span className="text-red-400">*</span>
            </label>
            <select
              required
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Image URL */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Logo URL (optional)</label>
            <input
              type="url"
              value={formData.image}
              onChange={(e) => setFormData({ ...formData, image: e.target.value })}
              placeholder="https://example.com/logo.png"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Website */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Website (optional)</label>
            <input
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              placeholder="https://project-website.com"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Info Note */}
          <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg px-4 py-3 text-sm text-purple-300">
            ℹ️ Submitted projects will be reviewed by the community before appearing in the verified list.
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
              ❌ {error}
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-purple-500 hover:bg-purple-600 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors"
            >
              {submitting ? '⏳ Submitting...' : '🚀 Submit Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
