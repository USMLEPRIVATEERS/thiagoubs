'use client'

import { cn } from '@/lib/utils/cn'

interface Props {
  microAreas: number[]
  selected: number[]
  onToggle: (area: number) => void
  onSelectAll: () => void
}

export default function MicroAreaFilter({ microAreas, selected, onToggle, onSelectAll }: Props) {
  const allSelected = selected.length === microAreas.length

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm font-medium text-gray-600">Microarea:</span>
      <button
        onClick={onSelectAll}
        className={cn(
          'px-3 py-1 rounded-full text-xs font-medium transition border',
          allSelected
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
        )}
      >
        Todas
      </button>
      {microAreas.map((area) => (
        <button
          key={area}
          onClick={() => onToggle(area)}
          className={cn(
            'px-3 py-1 rounded-full text-xs font-medium transition border',
            selected.includes(area)
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
          )}
        >
          {area}
        </button>
      ))}
    </div>
  )
}
