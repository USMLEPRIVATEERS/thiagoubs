'use client'

import { useState } from 'react'
import { TAG_CATEGORIES, getTagColor } from '@/lib/tags'

interface TagSelectorProps {
  selected: string[]
  onChange: (tags: string[]) => void
  compact?: boolean
}

export default function TagSelector({ selected, onChange, compact }: TagSelectorProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  function toggleTag(tag: string) {
    if (selected.includes(tag)) {
      onChange(selected.filter(t => t !== tag))
    } else {
      onChange([...selected, tag])
    }
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {Object.entries(TAG_CATEGORIES).map(([category, tags]) => (
          <div key={category}>
            <button
              type="button"
              onClick={() => setExpanded(expanded === category ? null : category)}
              className="text-xs font-semibold text-gray-600 hover:text-gray-900 mb-1 flex items-center gap-1"
            >
              <span>{expanded === category ? '▼' : '▶'}</span>
              {category}
              {tags.filter(t => selected.includes(t)).length > 0 && (
                <span className="bg-blue-100 text-blue-700 px-1.5 rounded-full text-xs">
                  {tags.filter(t => selected.includes(t)).length}
                </span>
              )}
            </button>
            {expanded === category && (
              <div className="flex flex-wrap gap-1 ml-3 mb-2">
                {tags.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium transition cursor-pointer ${
                      selected.includes(tag)
                        ? getTagColor(tag) + ' ring-2 ring-offset-1 ring-blue-400'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {selected.includes(tag) ? '✓ ' : ''}{tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {Object.entries(TAG_CATEGORIES).map(([category, tags]) => (
        <div key={category}>
          <p className="text-xs font-semibold text-gray-600 mb-2">{category}</p>
          <div className="flex flex-wrap gap-1.5">
            {tags.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition cursor-pointer ${
                  selected.includes(tag)
                    ? getTagColor(tag) + ' ring-2 ring-offset-1 ring-blue-400'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {selected.includes(tag) ? '✓ ' : ''}{tag}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
