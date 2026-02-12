'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/ui/Navbar'
import MicroAreaFilter from '@/components/dashboard/MicroAreaFilter'
import type { Patient } from '@/types/database'
import { INDICATOR_LIST, calculateScore, calculateC7TeamScore, isC7Eligible, getTagColor, ELIGIBILITY_TAGS } from '@/lib/tags'
import { getClassification, classificationBg, classificationLabel } from '@/lib/utils/scoring'

export default function DashboardPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [microAreas, setMicroAreas] = useState<string[]>([])
  const [selectedMicroAreas, setSelectedMicroAreas] = useState<string[]>([])
  const [filterEligibility, setFilterEligibility] = useState<string>('all')
  const supabase = useMemo(() => createClient(), [])
  const initializedRef = useRef(false)

  const loadData = useCallback(async () => {
    setLoading(true)

    const { data } = await supabase
      .from('patients')
      .select('*')
      .eq('status', 'active')
      .order('name')

    const pts = (data as Patient[]) || []
    setPatients(pts)

    const areas = [...new Set(pts.map(p => String(p.micro_area || '')).filter(Boolean))].sort()
    setMicroAreas(areas)
    if (!initializedRef.current) {
      setSelectedMicroAreas(areas)
      initializedRef.current = true
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Filter patients by microarea
  const filteredPatients = patients.filter(p => {
    const matchesMA = selectedMicroAreas.length === 0 || selectedMicroAreas.includes(String(p.micro_area || ''))
    const matchesElig = filterEligibility === 'all' || (p.tags || []).includes(filterEligibility)
    return matchesMA && matchesElig
  })

  // Used eligibility tags for dropdown
  const usedEligibilityTags = ELIGIBILITY_TAGS.filter(t =>
    patients.some(p => (p.tags || []).includes(t))
  )

  // Calculate indicator summaries using proper scoring
  const indicatorSummaries = INDICATOR_LIST.map(ind => {
    // C7 uses team-level formula with separate denominators per age group
    if (ind.code === 'C7') {
      const c7eligible = filteredPatients.filter(p => isC7Eligible(p))
      const c7result = calculateC7TeamScore(c7eligible)
      const classification = getClassification(c7result.score, 100)
      return {
        code: ind.code,
        name: ind.name,
        description: ind.description,
        totalEligible: c7eligible.length,
        avgPct: c7result.score,
        classification,
        counts: { otimo: 0, bom: 0, suficiente: 0, regular: 0 },
        isTeamLevel: true,
        c7SubScores: c7result.subScores,
      }
    }

    // C2-C6: per-patient scoring
    const eligible = filteredPatients.filter(p =>
      ind.eligibilityTags.some(t => (p.tags || []).includes(t))
    )

    const scores = eligible.map(p => calculateScore(p.tags || [], ind.code, p.team_type))

    const avgPct = scores.length > 0
      ? scores.reduce((sum, s) => sum + s.percentage, 0) / scores.length
      : 0

    const classification = getClassification(avgPct, 100)

    const counts = { otimo: 0, bom: 0, suficiente: 0, regular: 0 }
    for (const s of scores) {
      const c = getClassification(s.percentage, 100)
      counts[c]++
    }

    return {
      code: ind.code,
      name: ind.name,
      description: ind.description,
      totalEligible: eligible.length,
      avgPct,
      classification,
      counts,
      isTeamLevel: false,
      c7SubScores: undefined as undefined,
    }
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500">{filteredPatients.length} pacientes ativos</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={filterEligibility}
              onChange={(e) => setFilterEligibility(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="all">Todos pacientes</option>
              {usedEligibilityTags.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
            <button
              onClick={loadData}
              disabled={loading}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition"
            >
              {loading ? 'Carregando...' : 'Atualizar'}
            </button>
          </div>
        </div>

        {microAreas.length > 0 && (
          <div className="mb-6">
            <MicroAreaFilter
              microAreas={microAreas}
              selected={selectedMicroAreas}
              onToggle={(area) => setSelectedMicroAreas(prev =>
                prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
              )}
              onSelectAll={() => setSelectedMicroAreas(microAreas)}
            />
          </div>
        )}

        {/* C1 note */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <p className="text-xs text-amber-700">
            <span className="font-semibold">C1 — Mais Acesso:</span> Indicador de equipe (ratio demanda programada / total).
            Parametros: Otimo &gt;50-70%, Bom &gt;30-50%, Suficiente &gt;10-30%, Regular ≤10% ou &gt;70%.
            Nao e calculado por paciente individual.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : (
          <>
            {/* Indicator Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {indicatorSummaries.map(s => {
                const color = s.avgPct > 75 ? 'green' : s.avgPct > 50 ? 'blue' : s.avgPct > 25 ? 'orange' : s.totalEligible === 0 ? 'gray' : 'red'
                const bgMap: Record<string, string> = { green: 'bg-green-50 border-green-200', blue: 'bg-blue-50 border-blue-200', orange: 'bg-orange-50 border-orange-200', red: 'bg-red-50 border-red-200', gray: 'bg-gray-50 border-gray-200' }
                const textMap: Record<string, string> = { green: 'text-green-700', blue: 'text-blue-700', orange: 'text-orange-700', red: 'text-red-700', gray: 'text-gray-500' }
                const barMap: Record<string, string> = { green: 'bg-green-500', blue: 'bg-blue-500', orange: 'bg-orange-500', red: 'bg-red-500', gray: 'bg-gray-300' }

                return (
                  <Link
                    key={s.code}
                    href={`/indicators/${s.code}`}
                    className={`rounded-xl border p-4 hover:shadow-md transition ${bgMap[color]}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-gray-500">{s.code}</span>
                      <span className={`text-lg font-bold ${textMap[color]}`}>
                        {s.totalEligible > 0 ? `${s.avgPct.toFixed(0)}%` : '-'}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 mb-1">{s.name}</p>
                    <p className="text-xs text-gray-500 mb-3">{s.description}</p>

                    {/* Progress bar */}
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                      <div className={`h-2 rounded-full ${barMap[color]}`} style={{ width: `${Math.min(s.avgPct, 100)}%` }} />
                    </div>

                    {/* Classification counts or C7 sub-scores */}
                    {s.isTeamLevel && s.c7SubScores ? (
                      <div className="space-y-0.5 text-xs mt-2">
                        {s.c7SubScores.map(sub => (
                          <div key={sub.tag} className="flex justify-between">
                            <span className="text-gray-600">{sub.tag}: {sub.achieved}/{sub.eligible}</span>
                            <span className="font-medium">{(sub.ratio * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex gap-2 text-xs mt-2">
                        {s.counts.otimo > 0 && <span className="bg-green-100 text-green-700 px-1.5 rounded">Ot: {s.counts.otimo}</span>}
                        {s.counts.bom > 0 && <span className="bg-blue-100 text-blue-700 px-1.5 rounded">Bom: {s.counts.bom}</span>}
                        {s.counts.suficiente > 0 && <span className="bg-orange-100 text-orange-700 px-1.5 rounded">Suf: {s.counts.suficiente}</span>}
                        {s.counts.regular > 0 && <span className="bg-red-100 text-red-700 px-1.5 rounded">Reg: {s.counts.regular}</span>}
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{s.totalEligible} elegiveis</p>
                  </Link>
                )
              })}
            </div>

            {/* Eligibility summary */}
            {usedEligibilityTags.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-3">Elegibilidade</h2>
                <div className="flex flex-wrap gap-2">
                  {usedEligibilityTags.map(tag => {
                    const count = filteredPatients.filter(p => (p.tags || []).includes(tag)).length
                    return (
                      <button
                        key={tag}
                        onClick={() => setFilterEligibility(filterEligibility === tag ? 'all' : tag)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer ${
                          filterEligibility === tag
                            ? getTagColor(tag) + ' ring-2 ring-offset-1 ring-blue-400'
                            : getTagColor(tag)
                        }`}
                      >
                        {tag} ({count})
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
