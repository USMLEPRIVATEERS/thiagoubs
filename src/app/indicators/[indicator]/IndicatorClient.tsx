'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/ui/Navbar'
import MicroAreaFilter from '@/components/dashboard/MicroAreaFilter'
import type { Patient } from '@/types/database'
import { INDICATORS, calculateScore, getTagColor } from '@/lib/tags'
import { getClassification, classificationBg, classificationLabel } from '@/lib/utils/scoring'
import { ageInYears } from '@/lib/utils/dates'

export default function IndicatorDetailPage() {
  const params = useParams()
  const indicator = (params.indicator as string).toUpperCase()
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [microAreas, setMicroAreas] = useState<number[]>([])
  const [selectedMicroAreas, setSelectedMicroAreas] = useState<number[]>([])
  const supabase = useMemo(() => createClient(), [])
  const initializedRef = useRef(false)

  const loadData = useCallback(async () => {
    setLoading(true)

    const { data } = await supabase
      .from('patients')
      .select('*')
      .eq('status', 'active')

    if (!data || data.length === 0) {
      setPatients([])
      setLoading(false)
      return
    }

    const areas = [...new Set(data.map((p: Patient) => p.micro_area).filter(Boolean) as number[])].sort()
    setMicroAreas(areas)
    if (!initializedRef.current) {
      setSelectedMicroAreas(areas)
      initializedRef.current = true
    }

    setPatients(data as Patient[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    loadData()
  }, [loadData])

  const ind = INDICATORS[indicator]

  // Filter by microarea then find eligible patients
  const filteredPatients = patients.filter(p =>
    selectedMicroAreas.length === 0 || selectedMicroAreas.includes(p.micro_area!)
  )

  const eligible = ind
    ? filteredPatients.filter(p => ind.eligibilityTags.some(t => (p.tags || []).includes(t)))
    : []

  // Calculate scores and sort by score ascending (worst first)
  const patientScores = eligible.map(p => ({
    patient: p,
    ...calculateScore(p.tags || [], indicator, p.team_type),
  })).sort((a, b) => a.percentage - b.percentage)

  function exportCSV() {
    if (patientScores.length === 0 || !ind) return
    const headers = ['Nome', 'Idade', 'Sexo', 'MA', 'Equipe', 'Pontos', 'Max', '%', 'Classificacao', ...ind.practices.map(p => p.tag)]
    const csvRows = patientScores.map(ps => [
      ps.patient.name,
      ageInYears(ps.patient.date_of_birth),
      ps.patient.sex,
      ps.patient.micro_area || '-',
      ps.patient.team_type,
      ps.score,
      ps.maxPossible,
      ps.percentage.toFixed(0),
      classificationLabel(getClassification(ps.percentage, 100)),
      ...ps.practices.map(p => p.exempt ? 'ISENTO' : p.achieved ? 'SIM' : 'NAO'),
    ])
    const csv = [headers, ...csvRows].map(row => row.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${indicator}_pacientes.csv`
    a.click()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center gap-2 mb-1">
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">Dashboard</Link>
          <span className="text-gray-400">/</span>
          <span className="text-sm text-gray-600">{indicator}</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {indicator} — {ind?.name || 'Indicador'}
            </h1>
            <p className="text-sm text-gray-500">{eligible.length} pacientes elegiveis</p>
          </div>
          <button
            onClick={exportCSV}
            className="px-4 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
          >
            Exportar CSV
          </button>
        </div>

        {/* Good practices legend */}
        {ind && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
            <h3 className="text-xs font-semibold text-gray-900 mb-2">Boas Praticas</h3>
            <div className="space-y-1">
              {ind.practices.map(p => (
                <div key={p.tag} className="flex items-center gap-2 text-xs">
                  <span className={`px-2 py-0.5 rounded font-mono font-bold ${getTagColor(p.tag)}`}>{p.tag}</span>
                  <span className="text-gray-700">{p.label}</span>
                  <span className="text-gray-400 ml-auto">{p.points} pts</span>
                  {p.exemptEAP76 && <span className="text-amber-600 text-xs">(isento eAP 76)</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {microAreas.length > 0 && (
          <div className="mb-6">
            <MicroAreaFilter
              microAreas={microAreas}
              selected={selectedMicroAreas}
              onToggle={(area) => setSelectedMicroAreas(prev => prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area])}
              onSelectAll={() => setSelectedMicroAreas(microAreas)}
            />
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : !ind ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500">
              {indicator === 'C1'
                ? 'C1 e um indicador de equipe (ratio), nao de paciente individual.'
                : 'Indicador nao encontrado.'
              }
            </p>
          </div>
        ) : patientScores.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500">Nenhum paciente elegivel para este indicador.</p>
            <p className="text-sm text-gray-400 mt-1">
              Adicione a tag de elegibilidade ({ind.eligibilityTags.join(' ou ')}) nos pacientes.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Paciente</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Idade</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">MA</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Equipe</th>
                    <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Score</th>
                    {ind.practices.map(p => (
                      <th key={p.tag} className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-2 py-3" title={p.label}>
                        {p.tag.split('-')[1]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {patientScores.map(ps => {
                    const cls = getClassification(ps.percentage, 100)
                    return (
                      <tr key={ps.patient.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <Link href={`/patients/${ps.patient.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                            {ps.patient.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{ageInYears(ps.patient.date_of_birth)}a</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{ps.patient.micro_area || '-'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{ps.patient.team_type === 76 ? 'eAP' : 'eSF'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${classificationBg(cls)}`}>
                            {ps.score}/{ps.maxPossible} ({ps.percentage.toFixed(0)}%)
                          </span>
                        </td>
                        {ps.practices.map(p => (
                          <td key={p.tag} className="px-2 py-3 text-center">
                            {p.exempt ? (
                              <span className="text-xs text-gray-400" title="Isento eAP 76">—</span>
                            ) : p.achieved ? (
                              <span className="text-green-600 font-bold text-sm" title={`${p.label} (${p.points}pts)`}>✓</span>
                            ) : (
                              <span className="text-red-400 text-sm" title={`${p.label} (${p.points}pts)`}>✗</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
