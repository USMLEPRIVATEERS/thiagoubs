'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/ui/Navbar'
import MicroAreaFilter from '@/components/dashboard/MicroAreaFilter'
import type { Patient } from '@/types/database'
import { INDICATOR_NAMES } from '@/types/indicator'
import { INDICATOR_TAGS, INDICATOR_COMPLIANCE_TAGS, getTagColor } from '@/lib/tags'
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

  const eligibilityTags = INDICATOR_TAGS[indicator] || []
  const complianceTags = INDICATOR_COMPLIANCE_TAGS[indicator] || []

  // Filter by microarea then find eligible patients
  const filteredPatients = patients.filter(p =>
    selectedMicroAreas.length === 0 || selectedMicroAreas.includes(p.micro_area!)
  )

  const eligible = filteredPatients.filter(p =>
    eligibilityTags.some(t => (p.tags || []).includes(t))
  )

  // Sort: pending first, then compliant
  const sorted = [...eligible].sort((a, b) => {
    const aCompliant = complianceTags.length > 0 && complianceTags.every(t => (a.tags || []).includes(t))
    const bCompliant = complianceTags.length > 0 && complianceTags.every(t => (b.tags || []).includes(t))
    if (aCompliant && !bCompliant) return 1
    if (!aCompliant && bCompliant) return -1
    return a.name.localeCompare(b.name)
  })

  function exportCSV() {
    if (sorted.length === 0) return
    const headers = ['Nome', 'Idade', 'Sexo', 'Microarea', 'Status', 'Tags']
    const csvRows = sorted.map(p => {
      const isCompliant = complianceTags.length > 0 && complianceTags.every(t => (p.tags || []).includes(t))
      return [
        p.name,
        ageInYears(p.date_of_birth),
        p.sex,
        p.micro_area || '-',
        isCompliant ? 'Em dia' : 'Pendente',
        (p.tags || []).join(', '),
      ]
    })
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
            <p className="text-sm text-gray-500">{eligible.length} pacientes elegiveis</p>
          </div>
          <button
            onClick={exportCSV}
            className="px-4 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
          >
            Exportar CSV
          </button>
        </div>

        {/* Tag info */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Elegivel se tem:</p>
              <div className="flex flex-wrap gap-1">
                {eligibilityTags.map(tag => (
                  <span key={tag} className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTagColor(tag)}`}>{tag}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Em dia se tem:</p>
              <div className="flex flex-wrap gap-1">
                {complianceTags.map(tag => (
                  <span key={tag} className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTagColor(tag)}`}>{tag}</span>
                ))}
              </div>
            </div>
          </div>
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
        ) : sorted.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500">Nenhum paciente elegivel para este indicador.</p>
            <p className="text-sm text-gray-400 mt-1">Adicione tags aos pacientes para categoriza-los.</p>
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
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Tags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sorted.map(patient => {
                    const isCompliant = complianceTags.length > 0 && complianceTags.every(t => (patient.tags || []).includes(t))
                    return (
                      <tr key={patient.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <Link href={`/patients/${patient.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                            {patient.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{ageInYears(patient.date_of_birth)}a</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{patient.micro_area || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            isCompliant ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {isCompliant ? 'Em dia' : 'Pendente'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {(patient.tags || []).slice(0, 4).map(tag => (
                              <span key={tag} className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTagColor(tag)}`}>
                                {tag}
                              </span>
                            ))}
                            {(patient.tags || []).length > 4 && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                                +{(patient.tags || []).length - 4}
                              </span>
                            )}
                          </div>
                        </td>
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
