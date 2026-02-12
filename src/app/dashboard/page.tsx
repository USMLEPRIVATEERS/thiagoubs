'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/ui/Navbar'
import MicroAreaFilter from '@/components/dashboard/MicroAreaFilter'
import type { Patient } from '@/types/database'
import { INDICATOR_NAMES, INDICATOR_DESCRIPTIONS } from '@/types/indicator'
import { INDICATOR_TAGS, INDICATOR_COMPLIANCE_TAGS, getTagColor } from '@/lib/tags'

export default function DashboardPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [microAreas, setMicroAreas] = useState<number[]>([])
  const [selectedMicroAreas, setSelectedMicroAreas] = useState<number[]>([])
  const [filterTag, setFilterTag] = useState<string>('all')
  const supabase = createClient()

  const loadData = useCallback(async () => {
    setLoading(true)

    const { data } = await supabase
      .from('patients')
      .select('*')
      .eq('status', 'active')
      .order('name')

    const pts = (data as Patient[]) || []
    setPatients(pts)

    const areas = [...new Set(pts.map(p => p.micro_area).filter(Boolean) as number[])].sort()
    setMicroAreas(areas)
    if (selectedMicroAreas.length === 0) {
      setSelectedMicroAreas(areas)
    }

    setLoading(false)
  }, [supabase, selectedMicroAreas])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Filter patients by microarea and tag
  const filteredPatients = patients.filter(p => {
    const matchesMA = selectedMicroAreas.length === 0 || selectedMicroAreas.includes(p.micro_area!)
    const matchesTag = filterTag === 'all' || (p.tags || []).includes(filterTag)
    return matchesMA && matchesTag
  })

  // Collect all used tags for the dropdown
  const usedTags = [...new Set(patients.flatMap(p => p.tags || []))].sort()

  // Calculate tag-based indicator summaries
  const indicatorSummaries = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'].map(code => {
    const eligibilityTags = INDICATOR_TAGS[code] || []
    const complianceTags = INDICATOR_COMPLIANCE_TAGS[code] || []

    // Patients eligible for this indicator (have at least one eligibility tag)
    const eligible = filteredPatients.filter(p =>
      eligibilityTags.some(t => (p.tags || []).includes(t))
    )

    // Compliant patients (have ALL compliance tags)
    const compliant = eligible.filter(p =>
      complianceTags.length > 0 && complianceTags.every(t => (p.tags || []).includes(t))
    )

    const pending = eligible.length - compliant.length
    const percentage = eligible.length > 0 ? (compliant.length / eligible.length) * 100 : 0

    return {
      code,
      name: INDICATOR_NAMES[code],
      description: INDICATOR_DESCRIPTIONS[code],
      totalEligible: eligible.length,
      compliant: compliant.length,
      pending,
      percentage,
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
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="all">Todas tags</option>
              {usedTags.map(tag => (
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

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : (
          <>
            {/* Indicator Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {indicatorSummaries.map(s => {
                const color = s.percentage >= 75 ? 'green' : s.percentage >= 50 ? 'yellow' : s.totalEligible === 0 ? 'gray' : 'red'
                const bgMap: Record<string, string> = { green: 'bg-green-50 border-green-200', yellow: 'bg-yellow-50 border-yellow-200', red: 'bg-red-50 border-red-200', gray: 'bg-gray-50 border-gray-200' }
                const textMap: Record<string, string> = { green: 'text-green-700', yellow: 'text-yellow-700', red: 'text-red-700', gray: 'text-gray-500' }
                const barMap: Record<string, string> = { green: 'bg-green-500', yellow: 'bg-yellow-500', red: 'bg-red-500', gray: 'bg-gray-300' }

                return (
                  <Link
                    key={s.code}
                    href={`/indicators/${s.code}`}
                    className={`rounded-xl border p-4 hover:shadow-md transition ${bgMap[color]}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-gray-500">{s.code}</span>
                      <span className={`text-lg font-bold ${textMap[color]}`}>
                        {s.totalEligible > 0 ? `${s.percentage.toFixed(0)}%` : '-'}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 mb-1">{s.name}</p>
                    <p className="text-xs text-gray-500 mb-3">{s.description}</p>

                    {/* Progress bar */}
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                      <div className={`h-2 rounded-full ${barMap[color]}`} style={{ width: `${s.percentage}%` }} />
                    </div>

                    <div className="flex justify-between text-xs">
                      <span className="text-green-600 font-medium">{s.compliant} em dia</span>
                      <span className="text-red-600 font-medium">{s.pending} pendentes</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{s.totalEligible} elegiveis</p>
                  </Link>
                )
              })}
            </div>

            {/* Summary of all tags used */}
            {usedTags.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-3">Tags em uso</h2>
                <div className="flex flex-wrap gap-2">
                  {usedTags.map(tag => {
                    const count = filteredPatients.filter(p => (p.tags || []).includes(tag)).length
                    return (
                      <button
                        key={tag}
                        onClick={() => setFilterTag(filterTag === tag ? 'all' : tag)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer ${
                          filterTag === tag
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
