'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/ui/Navbar'
import MicroAreaFilter from '@/components/dashboard/MicroAreaFilter'
import type { Patient, Condition, Consultation, Measurement, Procedure, HomeVisit, Vaccination, Pregnancy } from '@/types/database'
import type { IndicatorResult } from '@/types/indicator'
import { INDICATOR_NAMES } from '@/types/indicator'
import { calculateAllIndicators, getApplicableIndicators } from '@/lib/indicators/engine'
import type { PatientData } from '@/lib/indicators/engine'
import { classificationBg, classificationLabel } from '@/lib/utils/scoring'

interface PatientRow {
  patient: Patient
  result: IndicatorResult
}

export default function IndicatorDetailPage() {
  const params = useParams()
  const indicator = (params.indicator as string).toUpperCase()
  const [rows, setRows] = useState<PatientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [microAreas, setMicroAreas] = useState<number[]>([])
  const [selectedMicroAreas, setSelectedMicroAreas] = useState<number[]>([])
  const supabase = createClient()

  const loadData = useCallback(async () => {
    setLoading(true)

    const { data: patients } = await supabase
      .from('patients')
      .select('*')
      .eq('status', 'active')

    if (!patients || patients.length === 0) {
      setRows([])
      setLoading(false)
      return
    }

    const areas = [...new Set(patients.map(p => p.micro_area).filter(Boolean) as number[])].sort()
    setMicroAreas(areas)
    if (selectedMicroAreas.length === 0) setSelectedMicroAreas(areas)

    const filteredPatients = patients.filter(p =>
      selectedMicroAreas.length === 0 || selectedMicroAreas.includes(p.micro_area)
    )
    const patientIds = filteredPatients.map(p => p.id)

    const [conditions, consultations, measurements, procedures, homeVisits, vaccinations, pregnancies] = await Promise.all([
      supabase.from('conditions').select('*').in('patient_id', patientIds).then(r => r.data || []),
      supabase.from('consultations').select('*').in('patient_id', patientIds).then(r => r.data || []),
      supabase.from('measurements').select('*').in('patient_id', patientIds).then(r => r.data || []),
      supabase.from('procedures').select('*').in('patient_id', patientIds).then(r => r.data || []),
      supabase.from('home_visits').select('*').in('patient_id', patientIds).then(r => r.data || []),
      supabase.from('vaccinations').select('*').in('patient_id', patientIds).then(r => r.data || []),
      supabase.from('pregnancies').select('*').in('patient_id', patientIds).then(r => r.data || []),
    ])

    const patientRows: PatientRow[] = []

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
      if (!applicable.includes(indicator)) continue

      const results = calculateAllIndicators(patientData)
      const result = results.find(r => r.indicator === indicator)
      if (result) {
        patientRows.push({ patient: patient as Patient, result })
      }
    }

    // Sort by score ascending (most urgent first)
    patientRows.sort((a, b) => a.result.percentage - b.result.percentage)
    setRows(patientRows)
    setLoading(false)
  }, [supabase, indicator, selectedMicroAreas])

  useEffect(() => {
    loadData()
  }, [loadData])

  function exportCSV() {
    if (rows.length === 0) return
    const headers = ['Nome', 'Idade', 'Microarea', 'Score', 'Classificacao',
      ...rows[0].result.practices.map(p => p.code + ' - ' + p.name)]
    const csvRows = rows.map(r => [
      r.patient.name,
      r.patient.age_years,
      r.patient.micro_area || '-',
      r.result.percentage.toFixed(1),
      classificationLabel(r.result.classification),
      ...r.result.practices.map(p => p.achieved ? 'Cumprida' : p.exempt ? 'Isento' : 'Pendente'),
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
            <h1 className="text-2xl font-bold text-gray-900">{indicator} - {INDICATOR_NAMES[indicator]}</h1>
            <p className="text-sm text-gray-500">{rows.length} pacientes elegiveis</p>
          </div>
          <button
            onClick={exportCSV}
            className="px-4 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
          >
            Exportar CSV
          </button>
        </div>

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
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500">Nenhum paciente elegivel para este indicador.</p>
            <p className="text-sm text-gray-400 mt-1">Importe dados CSV para comecar.</p>
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
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Score</th>
                    {rows[0]?.result.practices.map(p => (
                      <th key={p.code} className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-2 py-3" title={p.name}>
                        {p.code}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map(({ patient, result }) => (
                    <tr key={patient.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <Link href={`/patients/${patient.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                          {patient.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{patient.age_years}a</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{patient.micro_area || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${classificationBg(result.classification)}`}>
                          {result.percentage.toFixed(0)}%
                        </span>
                      </td>
                      {result.practices.map(p => (
                        <td key={p.code} className="px-2 py-3 text-center" title={p.details}>
                          <span className="text-sm">
                            {p.exempt ? '⬜' : p.achieved ? '✅' : p.daysRemaining !== null && p.daysRemaining >= 0 && p.daysRemaining <= 30 ? '⏰' : '❌'}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
