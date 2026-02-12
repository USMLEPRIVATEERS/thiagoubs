'use client'

import Link from 'next/link'
import type { IndicatorSummary } from '@/types/indicator'
import { classificationBg, classificationLabel } from '@/lib/utils/scoring'

interface Props {
  summary: IndicatorSummary
}

export default function IndicatorCard({ summary }: Props) {
  return (
    <Link
      href={`/indicators/${summary.code}`}
      className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition block"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{summary.code}</span>
          <h3 className="text-sm font-semibold text-gray-900 mt-0.5">{summary.name}</h3>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${classificationBg(summary.classification)}`}>
          {classificationLabel(summary.classification)}
        </span>
      </div>

      <div className="mb-3">
        <div className="flex items-end gap-1">
          <span className="text-3xl font-bold text-gray-900">{summary.avgScore.toFixed(0)}</span>
          <span className="text-sm text-gray-400 mb-1">/ 100</span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{summary.totalPatients} pacientes</p>
      </div>

      <div className="flex gap-1">
        <div className="flex-1 bg-green-100 rounded-full h-2" title={`Otimo: ${summary.counts.otimo}`}>
          <div
            className="bg-green-500 h-2 rounded-full"
            style={{ width: summary.totalPatients > 0 ? `${(summary.counts.otimo / summary.totalPatients) * 100}%` : '0%' }}
          />
        </div>
        <div className="flex-1 bg-blue-100 rounded-full h-2" title={`Bom: ${summary.counts.bom}`}>
          <div
            className="bg-blue-500 h-2 rounded-full"
            style={{ width: summary.totalPatients > 0 ? `${(summary.counts.bom / summary.totalPatients) * 100}%` : '0%' }}
          />
        </div>
        <div className="flex-1 bg-orange-100 rounded-full h-2" title={`Suficiente: ${summary.counts.suficiente}`}>
          <div
            className="bg-orange-500 h-2 rounded-full"
            style={{ width: summary.totalPatients > 0 ? `${(summary.counts.suficiente / summary.totalPatients) * 100}%` : '0%' }}
          />
        </div>
        <div className="flex-1 bg-red-100 rounded-full h-2" title={`Regular: ${summary.counts.regular}`}>
          <div
            className="bg-red-500 h-2 rounded-full"
            style={{ width: summary.totalPatients > 0 ? `${(summary.counts.regular / summary.totalPatients) * 100}%` : '0%' }}
          />
        </div>
      </div>

      <div className="flex justify-between text-[10px] text-gray-400 mt-1">
        <span>{summary.counts.otimo} otimo</span>
        <span>{summary.counts.bom} bom</span>
        <span>{summary.counts.suficiente} suf.</span>
        <span>{summary.counts.regular} reg.</span>
      </div>
    </Link>
  )
}
