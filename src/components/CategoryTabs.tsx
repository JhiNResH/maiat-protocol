'use client'

import { useRouter, useSearchParams } from 'next/navigation'

interface CategoryTabsProps {
  categories: { key: string; label: string }[]
  activeKey: string
}

export function CategoryTabs({ categories, activeKey }: CategoryTabsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleClick(key: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (key === 'all') {
      params.delete('cat')
    } else {
      params.set('cat', key)
    }
    // preserve search query
    const qs = params.toString()
    router.push(qs ? `/?${qs}` : '/')
  }

  return (
    <div className="flex gap-1 mb-3 overflow-x-auto">
      {categories.map(cat => (
        <button
          key={cat.key}
          onClick={() => handleClick(cat.key)}
          className={`px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-colors whitespace-nowrap ${
            activeKey === cat.key
              ? 'bg-blue-600 text-white'
              : 'bg-white dark:bg-[#1a1b23] text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}
        >
          {cat.label}
        </button>
      ))}
    </div>
  )
}
