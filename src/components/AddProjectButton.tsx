'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { AddProjectForm } from './AddProjectForm'

interface AddProjectButtonProps {
  category: string
}

export function AddProjectButton({ category }: AddProjectButtonProps) {
  const [showForm, setShowForm] = useState(false)

  return (
    <>
      <button
        onClick={() => setShowForm(true)}
        className="flex items-center gap-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 px-4 py-2 rounded-lg transition-colors border border-purple-500/30"
      >
        <Plus className="w-5 h-5" />
        <span className="font-semibold">Add Project</span>
      </button>

      {showForm && (
        <AddProjectForm
          category={category}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false)
            window.location.reload() // Refresh to show new project
          }}
        />
      )}
    </>
  )
}
