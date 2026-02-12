'use client'

import type { GoodPracticeResult } from '@/types/indicator'
import { formatDate } from '@/lib/utils/dates'

interface Props {
  practices: GoodPracticeResult[]
  indicatorName: string
}

export default function GoodPracticeChecklist({ practices, indicatorName }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">{indicatorName}</h3>
      <div className="space-y-2">
        {practices.map((p) => (
          <div
            key={p.code}
            className={`flex items-center justify-between p-3 rounded-lg ${
              p.exempt
                ? 'bg-gray-50'
                : p.achieved
                ? 'bg-green-50'
                : p.daysRemaining !== null && p.daysRemaining >= 0 && p.daysRemaining <= 30
                ? 'bg-amber-50'
                : 'bg-red-50'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <span className="text-lg flex-shrink-0">
                {p.exempt ? '⬜' : p.achieved ? '✅' : p.daysRemaining !== null && p.daysRemaining >= 0 && p.daysRemaining <= 30 ? '⏰' : '❌'}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{p.code}. {p.name}</p>
                <p className="text-xs text-gray-500">{p.details}</p>
                {p.lastDate && (
                  <p className="text-xs text-gray-400">Ultimo: {formatDate(p.lastDate)}</p>
                )}
              </div>
            </div>
            <div className="text-right ml-2 flex-shrink-0">
              <p className="text-sm font-semibold text-gray-700">
                {p.points}/{p.maxPoints}
              </p>
              {!p.exempt && p.daysRemaining !== null && (
                <p className={`text-xs font-medium ${
                  p.daysRemaining < 0 ? 'text-red-600' : p.daysRemaining <= 30 ? 'text-amber-600' : 'text-green-600'
                }`}>
                  {p.daysRemaining < 0
                    ? `${Math.abs(p.daysRemaining)}d atraso`
                    : `${p.daysRemaining}d restantes`}
                </p>
              )}
              {p.dueDate && (
                <p className="text-[10px] text-gray-400">Vence: {formatDate(p.dueDate)}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
