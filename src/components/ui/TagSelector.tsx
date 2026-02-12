'use client'

import { useState } from 'react'
import { TAG_CATEGORIES, getTagColor, getTagLabel, ELIGIBILITY_TAGS } from '@/lib/tags'

interface TagSelectorProps {
  selected: string[]
  onChange: (tags: string[]) => void
}

export default function TagSelector({ selected, onChange }: TagSelectorProps) {
  const [expanded, setExpanded] = useState<string | null>('Elegibilidade')

  function toggleTag(tag: string) {
    if (selected.includes(tag)) {
      onChange(selected.filter(t => t !== tag))
    } else {
      onChange([...selected, tag])
    }
  }

  return (
    <div className="space-y-1">
      {Object.entries(TAG_CATEGORIES).map(([category, tags]) => {
        const selectedCount = tags.filter(t => selected.includes(t)).length
        const isEligibility = category === 'Elegibilidade'
        const isOpen = expanded === category

        return (
          <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : category)}
              className={`w-full flex items-center justify-between px-3 py-2 text-left transition ${
                isOpen ? 'bg-gray-50' : 'hover:bg-gray-50'
              }`}
            >
              <span className="text-xs font-semibold text-gray-700">
                {isOpen ? '▼' : '▶'} {category}
              </span>
              {selectedCount > 0 && (
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">
                  {selectedCount}/{tags.length}
                </span>
              )}
            </button>

            {isOpen && (
              <div className="px-3 pb-3 space-y-1">
                {tags.map(tag => {
                  const isSelected = selected.includes(tag)
                  const label = isEligibility ? tag : `${tag}: ${getTagLabel(tag)}`

                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition ${
                        isSelected
                          ? getTagColor(tag) + ' ring-1 ring-offset-1 ring-blue-400'
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <span className="flex-shrink-0 w-4 text-center">
                        {isSelected ? '✓' : '○'}
                      </span>
                      <span className="font-medium">{label}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
