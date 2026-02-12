'use client'

import Link from 'next/link'
import type { UrgentAction } from '@/types/indicator'
import { INDICATOR_NAMES } from '@/types/indicator'

interface Props {
  actions: UrgentAction[]
}

export default function UrgentActions({ actions }: Props) {
  if (actions.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Acoes Urgentes</h2>
        <p className="text-gray-500 text-sm">Nenhuma acao urgente no momento.</p>
      </div>
    )
  }

  const vencidos = actions.filter(a => a.type === 'vencido')
  const vencendo = actions.filter(a => a.type === 'vencendo')

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Acoes Urgentes</h2>

      {vencidos.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1.5">
            <span className="w-2 h-2 bg-red-500 rounded-full" />
            Vencidos ({vencidos.length})
          </h3>
          <div className="space-y-2">
            {vencidos.slice(0, 10).map((action, idx) => (
              <Link
                key={`v-${idx}`}
                href={`/patients/${action.patientId}`}
                className="flex items-center justify-between p-3 bg-red-50 rounded-lg hover:bg-red-100 transition"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{action.patientName}</p>
                  <p className="text-xs text-gray-500">
                    {INDICATOR_NAMES[action.indicator]} - {action.practiceName}
                    {action.microArea ? ` | MA ${action.microArea}` : ''}
                  </p>
                </div>
                <span className="text-xs font-semibold text-red-700 ml-2 whitespace-nowrap">
                  {action.daysOverdue}d atraso
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {vencendo.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-amber-700 mb-2 flex items-center gap-1.5">
            <span className="w-2 h-2 bg-amber-500 rounded-full" />
            Vencendo em 30 dias ({vencendo.length})
          </h3>
          <div className="space-y-2">
            {vencendo.slice(0, 10).map((action, idx) => (
              <Link
                key={`e-${idx}`}
                href={`/patients/${action.patientId}`}
                className="flex items-center justify-between p-3 bg-amber-50 rounded-lg hover:bg-amber-100 transition"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{action.patientName}</p>
                  <p className="text-xs text-gray-500">
                    {INDICATOR_NAMES[action.indicator]} - {action.practiceName}
                    {action.microArea ? ` | MA ${action.microArea}` : ''}
                  </p>
                </div>
                <span className="text-xs font-semibold text-amber-700 ml-2 whitespace-nowrap">
                  {action.daysUntilDue}d restantes
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
