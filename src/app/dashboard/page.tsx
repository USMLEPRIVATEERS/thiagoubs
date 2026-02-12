'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/ui/Navbar'
import IndicatorCard from '@/components/dashboard/IndicatorCard'
import UrgentActions from '@/components/dashboard/UrgentActions'
import MicroAreaFilter from '@/components/dashboard/MicroAreaFilter'
import type { IndicatorSummary, UrgentAction } from '@/types/indicator'
import type { Patient, Condition, Consultation, Measurement, Procedure, HomeVisit, Vaccination, Pregnancy } from '@/types/database'
import { INDICATOR_NAMES, INDICATOR_DESCRIPTIONS } from '@/types/indicator'
import { calculateAllIndicators, getUrgentActions, getApplicableIndicators } from '@/lib/indicators/engine'
import type { PatientData } from '@/lib/indicators/engine'
import { getClassification } from '@/lib/utils/scoring'

export default function DashboardPage() {
  const [summaries, setSummaries] = useState<IndicatorSummary[]>([])
  const [urgentActions, setUrgentActions] = useState<UrgentAction[]>([])
  const [loading, setLoading] = useState(true)
  const [microAreas, setMicroAreas] = useState<number[]>([])
  const [selectedMicroAreas, setSelectedMicroAreas] = useState<number[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const supabase = createClient()

  const loadData = useCallback(async () => {
    setLoading(true)

    // Fetch all active patients
    const { data: patients } = await supabase
      .from('patients')
      .select('*')
      .eq('status', 'active')

    if (!patients || patients.length === 0) {
      setSummaries(
        ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'].map(code => ({
          code,
          name: INDICATOR_NAMES[code],
          description: INDICATOR_DESCRIPTIONS[code],
          totalPatients: 0,
          avgScore: 0,
          classification: 'regular' as const,
          counts: { otimo: 0, bom: 0, suficiente: 0, regular: 0 },
        }))
      )
      setUrgentActions([])
      setLoading(false)
      return
    }

    // Get unique micro areas
    const areas = [...new Set(patients.map(p => p.micro_area).filter(Boolean) as number[])].sort()
    setMicroAreas(areas)
    if (selectedMicroAreas.length === 0) {
      setSelectedMicroAreas(areas)
    }

    // Filter patients by selected micro areas
    const filteredPatients = patients.filter(p =>
      selectedMicroAreas.length === 0 || selectedMicroAreas.includes(p.micro_area)
    )

    const patientIds = filteredPatients.map(p => p.id)

    // Fetch all related data in parallel
    const [conditions, consultations, measurements, procedures, homeVisits, vaccinations, pregnancies] = await Promise.all([
      supabase.from('conditions').select('*').in('patient_id', patientIds).then(r => r.data || []),
      supabase.from('consultations').select('*').in('patient_id', patientIds).then(r => r.data || []),
      supabase.from('measurements').select('*').in('patient_id', patientIds).then(r => r.data || []),
      supabase.from('procedures').select('*').in('patient_id', patientIds).then(r => r.data || []),
      supabase.from('home_visits').select('*').in('patient_id', patientIds).then(r => r.data || []),
      supabase.from('vaccinations').select('*').in('patient_id', patientIds).then(r => r.data || []),
      supabase.from('pregnancies').select('*').in('patient_id', patientIds).then(r => r.data || []),
    ])

    // Calculate indicators for each patient
    const indicatorResults: Record<string, { scores: number[], maxScores: number[], counts: { otimo: number, bom: number, suficiente: number, regular: number } }> = {}
    const allActions: UrgentAction[] = []

    for (const code of ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7']) {
      indicatorResults[code] = { scores: [], maxScores: [], counts: { otimo: 0, bom: 0, suficiente: 0, regular: 0 } }
    }

    for (const patient of filteredPatients) {
      const patientData: PatientData = {
        patient: patient as Patient,
        conditions: (conditions as Condition[]).filter(c => c.patient_id === patient.id),
        consultations: (consultations as Consultation[]).filter(c => c.patient_id === patient.id),
        measurements: (measurements as Measurement[]).filter(m => m.patient_id === patient.id),
        procedures: (procedures as Procedure[]).filter(p => p.patient_id === patient.id),
        homeVisits: (homeVisits as HomeVisit[]).filter(v => v.patient_id === patient.id),
        vaccinations: (vaccinations as Vaccination[]).filter(v => v.patient_id === patient.id),
        pregnancies: (pregnancies as Pregnancy[]).filter(p => p.patient_id === patient.id),
      }

      const applicable = getApplicableIndicators(patientData)
      const results = calculateAllIndicators(patientData)

      for (const result of results) {
        const ir = indicatorResults[result.indicator]
        if (ir) {
          ir.scores.push(result.percentage)
          ir.maxScores.push(result.maxScore)
          const cls = result.classification
          ir.counts[cls]++
        }
      }

      const actions = getUrgentActions(patientData)
      allActions.push(...actions)
    }

    // Build summaries
    const newSummaries: IndicatorSummary[] = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'].map(code => {
      const ir = indicatorResults[code]
      const total = ir.scores.length
      const avg = total > 0 ? ir.scores.reduce((a, b) => a + b, 0) / total : 0
      return {
        code,
        name: INDICATOR_NAMES[code],
        description: INDICATOR_DESCRIPTIONS[code],
        totalPatients: total,
        avgScore: avg,
        classification: getClassification(avg, 100),
        counts: ir.counts,
      }
    })

    setSummaries(newSummaries)
    setUrgentActions(allActions.sort((a, b) => {
      if (a.type === 'vencido' && b.type !== 'vencido') return -1
      if (a.type !== 'vencido' && b.type === 'vencido') return 1
      return (b.daysOverdue || 0) - (a.daysOverdue || 0)
    }))
    setLoading(false)
  }, [supabase, selectedMicroAreas])

  useEffect(() => {
    loadData()
  }, [loadData])

  function handleToggleMicroArea(area: number) {
    setSelectedMicroAreas(prev =>
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
    )
  }

  function handleSelectAllMicroAreas() {
    setSelectedMicroAreas(microAreas)
  }

  const filteredActions = searchTerm
    ? urgentActions.filter(a => a.patientName.toLowerCase().includes(searchTerm.toLowerCase()))
    : urgentActions

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500">Visao geral dos indicadores de qualidade</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Buscar paciente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-48"
            />
            <button
              onClick={loadData}
              disabled={loading}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition"
            >
              {loading ? 'Calculando...' : 'Recalcular'}
            </button>
          </div>
        </div>

        {microAreas.length > 0 && (
          <div className="mb-6">
            <MicroAreaFilter
              microAreas={microAreas}
              selected={selectedMicroAreas}
              onToggle={handleToggleMicroArea}
              onSelectAll={handleSelectAllMicroAreas}
            />
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {summaries.map(s => (
                <IndicatorCard key={s.code} summary={s} />
              ))}
            </div>

            <UrgentActions actions={filteredActions} />
          </>
        )}
      </main>
    </div>
  )
}
