'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/ui/Navbar'
import TagSelector from '@/components/ui/TagSelector'
import type { Patient, Condition, Consultation, Measurement, Procedure, HomeVisit, Vaccination } from '@/types/database'
import { getTagColor, getTagLabel, getIndicatorsForTags, calculateScore, INDICATORS, ELIGIBILITY_TAGS } from '@/lib/tags'
import { getClassification, classificationBg, classificationLabel } from '@/lib/utils/scoring'
import { formatDate, ageInYears } from '@/lib/utils/dates'

export default function PatientDetailPage() {
  const params = useParams()
  const patientId = params.id as string
  const [patient, setPatient] = useState<Patient | null>(null)
  const [conditions, setConditions] = useState<Condition[]>([])
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [procedures, setProcedures] = useState<Procedure[]>([])
  const [homeVisits, setHomeVisits] = useState<HomeVisit[]>([])
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Patient>>({})
  const [editTags, setEditTags] = useState<string[]>([])
  const [showTagEditor, setShowTagEditor] = useState(false)
  const [savingTags, setSavingTags] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  const loadData = useCallback(async () => {
    setLoading(true)

    const { data: p } = await supabase.from('patients').select('*').eq('id', patientId).single()
    if (!p) { setLoading(false); return }
    setPatient(p as Patient)

    const [conds, consults, meas, procs, visits, vaccs] = await Promise.all([
      supabase.from('conditions').select('*').eq('patient_id', patientId).then(r => r.data || []),
      supabase.from('consultations').select('*').eq('patient_id', patientId).order('consultation_date', { ascending: false }).then(r => r.data || []),
      supabase.from('measurements').select('*').eq('patient_id', patientId).order('measurement_date', { ascending: false }).then(r => r.data || []),
      supabase.from('procedures').select('*').eq('patient_id', patientId).order('procedure_date', { ascending: false }).then(r => r.data || []),
      supabase.from('home_visits').select('*').eq('patient_id', patientId).order('visit_date', { ascending: false }).then(r => r.data || []),
      supabase.from('vaccinations').select('*').eq('patient_id', patientId).order('dose_date', { ascending: false }).then(r => r.data || []),
    ])

    setConditions(conds as Condition[])
    setConsultations(consults as Consultation[])
    setMeasurements(meas as Measurement[])
    setProcedures(procs as Procedure[])
    setHomeVisits(visits as HomeVisit[])
    setVaccinations(vaccs as Vaccination[])
    setLoading(false)
  }, [supabase, patientId])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleSavePatient() {
    if (!patient) return
    const { error } = await supabase
      .from('patients')
      .update({
        name: editForm.name ?? patient.name,
        micro_area: editForm.micro_area ?? patient.micro_area,
        team_type: editForm.team_type ?? patient.team_type,
        sex: editForm.sex ?? patient.sex,
        gender_identity: editForm.gender_identity ?? patient.gender_identity,
        status: editForm.status ?? patient.status,
      })
      .eq('id', patient.id)

    if (!error) {
      setEditing(false)
      loadData()
    }
  }

  async function handleSaveTags() {
    if (!patient) return
    setSavingTags(true)
    const { error } = await supabase
      .from('patients')
      .update({ tags: editTags })
      .eq('id', patient.id)

    if (!error) {
      setPatient({ ...patient, tags: editTags })
      setShowTagEditor(false)
    }
    setSavingTags(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-12 text-center">
          <p className="text-gray-500">Paciente nao encontrado.</p>
        </div>
      </div>
    )
  }

  const patientTags = patient.tags || []
  const eligibleIndicators = getIndicatorsForTags(patientTags)

  // Build timeline from all records
  const timeline = [
    ...consultations.map(c => ({ date: c.consultation_date, type: 'Consulta', detail: `${c.professional_type} - ${c.demand_type} (${c.modality})` })),
    ...measurements.map(m => ({ date: m.measurement_date, type: 'Medicao', detail: [m.weight_kg && `Peso: ${m.weight_kg}kg`, m.height_cm && `Altura: ${m.height_cm}cm`, m.bp_systolic && `PA: ${m.bp_systolic}/${m.bp_diastolic}`].filter(Boolean).join(', ') })),
    ...procedures.map(p => ({ date: p.procedure_date, type: 'Procedimento', detail: `${p.procedure_name || p.procedure_code}${p.result_value ? ` = ${p.result_value}` : ''}` })),
    ...homeVisits.map(v => ({ date: v.visit_date, type: 'Visita Domiciliar', detail: v.visit_reason || 'ACS' })),
    ...vaccinations.map(v => ({ date: v.dose_date, type: 'Vacinacao', detail: `${v.vaccine_name || v.vaccine_code} (dose ${v.dose_number || '?'})` })),
  ].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center gap-2 mb-4">
          <Link href="/patients" className="text-sm text-blue-600 hover:underline">Pacientes</Link>
          <span className="text-gray-400">/</span>
          <span className="text-sm text-gray-600">{patient.name}</span>
        </div>

        {/* Patient Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900">{patient.name}</h1>
            <button
              onClick={() => {
                if (editing) { handleSavePatient() } else { setEditing(true); setEditForm(patient) }
              }}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border transition bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              {editing ? 'Salvar' : 'Editar'}
            </button>
          </div>

          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nome</label>
                <input value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Microarea</label>
                <input type="number" value={editForm.micro_area || ''} onChange={e => setEditForm({ ...editForm, micro_area: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Equipe</label>
                <select value={editForm.team_type || 70} onChange={e => setEditForm({ ...editForm, team_type: Number(e.target.value) as 70 | 76 })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                  <option value={70}>eSF (70)</option>
                  <option value={76}>eAP (76)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Sexo</label>
                <select value={editForm.sex || 'M'} onChange={e => setEditForm({ ...editForm, sex: e.target.value as 'M' | 'F' })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Identidade de Genero</label>
                <input value={editForm.gender_identity || ''} onChange={e => setEditForm({ ...editForm, gender_identity: e.target.value })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select value={editForm.status || 'active'} onChange={e => setEditForm({ ...editForm, status: e.target.value as 'active' | 'moved' | 'deceased' })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                  <option value="active">Ativo</option>
                  <option value="moved">Mudou</option>
                  <option value="deceased">Obito</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500">Data Nascimento</p>
                <p className="text-sm font-medium text-gray-900">{formatDate(patient.date_of_birth)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Idade</p>
                <p className="text-sm font-medium text-gray-900">{ageInYears(patient.date_of_birth)} anos</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Sexo</p>
                <p className="text-sm font-medium text-gray-900">{patient.sex === 'M' ? 'Masculino' : 'Feminino'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">CPF</p>
                <p className="text-sm font-medium text-gray-900 font-mono">{patient.cpf || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">CNS</p>
                <p className="text-sm font-medium text-gray-900 font-mono">{patient.cns || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Microarea</p>
                <p className="text-sm font-medium text-gray-900">{patient.micro_area || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Equipe</p>
                <p className="text-sm font-medium text-gray-900">{patient.team_type === 70 ? 'eSF' : 'eAP'} ({patient.team_type})</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <p className="text-sm font-medium text-gray-900">{patient.status === 'active' ? 'Ativo' : patient.status === 'moved' ? 'Mudou' : 'Obito'}</p>
              </div>
            </div>
          )}
        </div>

        {/* Tags Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Tags
              <span className="ml-2 text-gray-500 font-normal">({patientTags.length})</span>
            </h2>
            <button
              onClick={() => { setShowTagEditor(!showTagEditor); setEditTags(patientTags) }}
              className="text-xs text-blue-600 hover:underline font-medium"
            >
              {showTagEditor ? 'Fechar' : 'Gerenciar Tags'}
            </button>
          </div>

          {/* Eligibility tags */}
          {patientTags.filter(t => ELIGIBILITY_TAGS.includes(t)).length > 0 ? (
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1">Elegibilidade:</p>
              <div className="flex flex-wrap gap-1.5">
                {patientTags.filter(t => ELIGIBILITY_TAGS.includes(t)).map(tag => (
                  <span key={tag} className={`px-2.5 py-1 rounded-full text-xs font-medium ${getTagColor(tag)}`}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 mb-3">Nenhuma tag atribuida. Clique em &quot;Gerenciar Tags&quot; para adicionar.</p>
          )}

          {/* Indicator scores based on tags */}
          {eligibleIndicators.length > 0 && (
            <div className="border-t border-gray-100 pt-3 space-y-3">
              <p className="text-xs text-gray-500">Indicadores:</p>
              {eligibleIndicators.map(code => {
                const ind = INDICATORS[code]
                if (!ind) return null
                const result = calculateScore(patientTags, code, patient.team_type)
                const cls = getClassification(result.percentage, 100)
                return (
                  <div key={code} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <Link href={`/indicators/${code}`} className="text-xs font-bold text-blue-600 hover:underline">
                        {code} — {ind.name}
                      </Link>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${classificationBg(cls)}`}>
                        {result.score}/{result.maxPossible} ({result.percentage.toFixed(0)}%) — {classificationLabel(cls)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {result.practices.map(p => (
                        <div key={p.tag} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded ${
                          p.exempt ? 'text-gray-400' : p.achieved ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50'
                        }`}>
                          <span>{p.exempt ? '—' : p.achieved ? '✓' : '✗'}</span>
                          <span className="font-mono font-bold">{p.tag}</span>
                          <span className="truncate">{p.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Tag editor */}
          {showTagEditor && (
            <div className="border-t border-gray-200 pt-4 mt-3">
              <TagSelector selected={editTags} onChange={setEditTags} />
              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={handleSaveTags}
                  disabled={savingTags}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-medium rounded-lg transition"
                >
                  {savingTags ? 'Salvando...' : 'Salvar Tags'}
                </button>
                <button
                  onClick={() => setShowTagEditor(false)}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Conditions */}
        {conditions.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Condicoes Ativas</h2>
            <div className="flex flex-wrap gap-2">
              {conditions.map(c => (
                <span key={c.id} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                  {c.code} ({c.code_system}) {c.description && `- ${c.description}`}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Historico</h2>
          {timeline.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum registro encontrado.</p>
          ) : (
            <div className="space-y-3">
              {timeline.slice(0, 50).map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 text-sm">
                  <span className="text-gray-400 font-mono text-xs w-20 flex-shrink-0">{formatDate(item.date)}</span>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium w-24 text-center flex-shrink-0">{item.type}</span>
                  <span className="text-gray-700">{item.detail}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
