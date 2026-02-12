'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/ui/Navbar'
import MicroAreaFilter from '@/components/dashboard/MicroAreaFilter'
import type { Patient, Consultation, Condition, Measurement, Procedure, HomeVisit, Vaccination, Pregnancy } from '@/types/database'
import { INDICATOR_LIST, calculateScore, calculateC7TeamScore, isC7Eligible, getTagColor, ELIGIBILITY_TAGS } from '@/lib/tags'
import { getClassification, getC1Classification, classificationBg, classificationLabel } from '@/lib/utils/scoring'
import { getUrgentActions, type PatientData } from '@/lib/indicators/engine'
import type { UrgentAction } from '@/types/indicator'
import { formatDate } from '@/lib/utils/dates'

export default function DashboardPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [conditions, setConditions] = useState<Condition[]>([])
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [procedures, setProcedures] = useState<Procedure[]>([])
  const [homeVisits, setHomeVisits] = useState<HomeVisit[]>([])
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([])
  const [pregnancies, setPregnancies] = useState<Pregnancy[]>([])
  const [loading, setLoading] = useState(true)
  const [microAreas, setMicroAreas] = useState<string[]>([])
  const [selectedMicroAreas, setSelectedMicroAreas] = useState<string[]>([])
  const [filterEligibility, setFilterEligibility] = useState<string>('all')
  const [suggestionsTab, setSuggestionsTab] = useState<'vencido' | 'semana' | 'mes' | 'geral'>('vencido')
  const supabase = useMemo(() => createClient(), [])
  const initializedRef = useRef(false)

  const loadData = useCallback(async () => {
    setLoading(true)

    const [pRes, cRes, condRes, mRes, prcRes, hvRes, vacRes, pregRes] = await Promise.all([
      supabase.from('patients').select('*').eq('status', 'active').order('name'),
      supabase.from('consultations').select('*'),
      supabase.from('conditions').select('*'),
      supabase.from('measurements').select('*'),
      supabase.from('procedures').select('*'),
      supabase.from('home_visits').select('*'),
      supabase.from('vaccinations').select('*'),
      supabase.from('pregnancies').select('*'),
    ])

    const pts = (pRes.data as Patient[]) || []
    setPatients(pts)
    setConsultations((cRes.data as Consultation[]) || [])
    setConditions((condRes.data as Condition[]) || [])
    setMeasurements((mRes.data as Measurement[]) || [])
    setProcedures((prcRes.data as Procedure[]) || [])
    setHomeVisits((hvRes.data as HomeVisit[]) || [])
    setVaccinations((vacRes.data as Vaccination[]) || [])
    setPregnancies((pregRes.data as Pregnancy[]) || [])

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

  // Build per-patient data and calculate urgent actions
  const allActions = useMemo(() => {
    const filteredIds = new Set(filteredPatients.map(p => p.id))
    const actions: UrgentAction[] = []

    for (const patient of filteredPatients) {
      const pid = patient.id
      const patientData: PatientData = {
        patient,
        conditions: conditions.filter(c => c.patient_id === pid),
        consultations: consultations.filter(c => c.patient_id === pid),
        measurements: measurements.filter(m => m.patient_id === pid),
        procedures: procedures.filter(p => p.patient_id === pid),
        homeVisits: homeVisits.filter(h => h.patient_id === pid),
        vaccinations: vaccinations.filter(v => v.patient_id === pid),
        pregnancies: pregnancies.filter(p => p.patient_id === pid),
      }
      try {
        actions.push(...getUrgentActions(patientData))
      } catch {
        // skip patients with calculation errors
      }
    }
    return actions
  }, [filteredPatients, conditions, consultations, measurements, procedures, homeVisits, vaccinations, pregnancies])

  const overdue = allActions.filter(a => a.type === 'vencido')
  const dueSoon = allActions.filter(a => a.type === 'vencendo')
  const dueThisWeek = dueSoon.filter(a => (a.daysUntilDue || 0) <= 7)
  const dueThisMonth = dueSoon.filter(a => (a.daysUntilDue || 0) > 7 && (a.daysUntilDue || 0) <= 30)

  // C1 — Mais Acesso: team-level ratio of programada / total
  const VALID_C1_CBOS = ['225142', '225170', '225130', '223565', '223505']
  const c1Summary = useMemo(() => {
    const patientIds = new Set(filteredPatients.map(p => p.id))
    const teamConsults = consultations.filter(c => {
      if (!patientIds.has(c.patient_id)) return false
      if (c.professional_cbo) {
        const norm = c.professional_cbo.replace(/[-.\\s]/g, '')
        return VALID_C1_CBOS.some(valid => norm.startsWith(valid))
      }
      return c.professional_type === 'medico' || c.professional_type === 'enfermeiro'
    })
    const total = teamConsults.length
    const programadas = teamConsults.filter(c => c.demand_type === 'programada').length
    const espontaneas = total - programadas
    const pctProgramada = total > 0 ? (programadas / total) * 100 : 0
    const classification = getC1Classification(pctProgramada)
    return { total, programadas, espontaneas, pctProgramada, classification }
  }, [filteredPatients, consultations])

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

  function renderActionList(actions: UrgentAction[], emptyMsg: string) {
    if (actions.length === 0) {
      return <p className="text-sm text-gray-400 py-4 text-center">{emptyMsg}</p>
    }
    // Group by patient
    const byPatient = new Map<string, UrgentAction[]>()
    for (const a of actions) {
      const list = byPatient.get(a.patientId) || []
      list.push(a)
      byPatient.set(a.patientId, list)
    }

    return (
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {[...byPatient.entries()].map(([pid, acts]) => (
          <Link key={pid} href={`/patients/${pid}`}
            className="block border border-gray-100 rounded-lg p-3 hover:bg-gray-50 transition">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-gray-900">{acts[0].patientName}</span>
              {acts[0].microArea && <span className="text-xs text-gray-400">MA {String(acts[0].microArea)}</span>}
            </div>
            <div className="space-y-0.5">
              {acts.map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className={`px-1.5 py-0.5 rounded font-medium ${
                    a.type === 'vencido' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {a.indicator}
                  </span>
                  <span className="text-gray-700">{a.practiceName}</span>
                  <span className={`ml-auto flex-shrink-0 ${
                    a.type === 'vencido' ? 'text-red-600 font-semibold' : 'text-yellow-600'
                  }`}>
                    {a.type === 'vencido'
                      ? `${a.daysOverdue}d atrasado`
                      : `em ${a.daysUntilDue}d`
                    }
                  </span>
                </div>
              ))}
            </div>
          </Link>
        ))}
      </div>
    )
  }

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

        {/* Suggestions / Actions section */}
        {!loading && (overdue.length > 0 || dueSoon.length > 0) && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              Acoes Necessarias
              <span className="ml-2 text-gray-400 font-normal text-xs">
                ({overdue.length} vencidas, {dueSoon.length} vencendo)
              </span>
            </h2>

            {/* Tabs */}
            <div className="flex gap-1 mb-4 border-b border-gray-200">
              {([
                { key: 'vencido' as const, label: 'Vencidas', count: overdue.length, color: 'red' },
                { key: 'semana' as const, label: 'Esta Semana', count: dueThisWeek.length, color: 'yellow' },
                { key: 'mes' as const, label: 'Este Mes', count: dueThisMonth.length, color: 'blue' },
                { key: 'geral' as const, label: 'Todas', count: allActions.length, color: 'gray' },
              ]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setSuggestionsTab(tab.key)}
                  className={`px-3 py-2 text-xs font-medium border-b-2 transition ${
                    suggestionsTab === tab.key
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                      tab.color === 'red' ? 'bg-red-100 text-red-700' :
                      tab.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                      tab.color === 'blue' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{tab.count}</span>
                  )}
                </button>
              ))}
            </div>

            {suggestionsTab === 'vencido' && renderActionList(overdue, 'Nenhuma acao vencida!')}
            {suggestionsTab === 'semana' && renderActionList(dueThisWeek, 'Nenhuma acao para esta semana.')}
            {suggestionsTab === 'mes' && renderActionList(dueThisMonth, 'Nenhuma acao para este mes.')}
            {suggestionsTab === 'geral' && renderActionList(allActions, 'Nenhuma acao pendente.')}
          </div>
        )}

        {/* C1 — Mais Acesso card */}
        <div className={`rounded-xl border p-5 mb-6 ${classificationBg(c1Summary.classification)}`}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-xs font-bold text-gray-500">C1</span>
              <p className="text-sm font-semibold text-gray-900">Mais Acesso</p>
              <p className="text-xs text-gray-500">Proporcao consultas programadas / total (equipe)</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold">{c1Summary.pctProgramada.toFixed(1)}%</span>
              <p className={`text-xs font-semibold mt-1 px-2 py-0.5 rounded-full inline-block ${classificationBg(c1Summary.classification)}`}>
                {classificationLabel(c1Summary.classification)}
              </p>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
            <div className="h-2 rounded-full bg-current" style={{ width: `${Math.min(c1Summary.pctProgramada, 100)}%` }} />
          </div>
          <div className="flex gap-4 text-xs text-gray-600">
            <span>Programadas: <strong>{c1Summary.programadas}</strong></span>
            <span>Espontaneas: <strong>{c1Summary.espontaneas}</strong></span>
            <span>Total: <strong>{c1Summary.total}</strong></span>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Meta: Otimo 50-70% | Bom 30-50% | Suficiente 10-30% | Regular &le;10% ou &gt;70%
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
