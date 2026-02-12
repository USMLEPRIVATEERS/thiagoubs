'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface QuickAddFormsProps {
  patientId: string
  onSaved: () => void
}

type FormType = 'consulta' | 'medicao' | 'procedimento' | 'vacina' | 'visita' | null

const todayStr = () => new Date().toISOString().slice(0, 10)

export default function QuickAddForms({ patientId, onSaved }: QuickAddFormsProps) {
  const [activeForm, setActiveForm] = useState<FormType>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  function toggle(form: FormType) {
    setActiveForm(activeForm === form ? null : form)
    setError(null)
  }

  async function save(table: string, record: Record<string, unknown>) {
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from(table).insert({ patient_id: patientId, ...record })
    setSaving(false)
    if (err) { setError(err.message); return }
    setActiveForm(null)
    onSaved()
  }

  const buttons: { key: FormType; label: string; icon: string }[] = [
    { key: 'consulta', label: 'Consulta', icon: '🩺' },
    { key: 'medicao', label: 'Medicao', icon: '📏' },
    { key: 'procedimento', label: 'Procedimento', icon: '🔬' },
    { key: 'vacina', label: 'Vacina', icon: '💉' },
    { key: 'visita', label: 'Visita ACS', icon: '🏠' },
  ]

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Registrar Dados</h2>

      <div className="flex flex-wrap gap-2 mb-3">
        {buttons.map(b => (
          <button
            key={b.key}
            onClick={() => toggle(b.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
              activeForm === b.key
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {b.icon} {b.label}
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      {activeForm === 'consulta' && (
        <ConsultaForm saving={saving} onSave={(r) => save('consultations', r)} onCancel={() => setActiveForm(null)} />
      )}
      {activeForm === 'medicao' && (
        <MedicaoForm saving={saving} onSave={(r) => save('measurements', r)} onCancel={() => setActiveForm(null)} />
      )}
      {activeForm === 'procedimento' && (
        <ProcedimentoForm saving={saving} onSave={(r) => save('procedures', r)} onCancel={() => setActiveForm(null)} />
      )}
      {activeForm === 'vacina' && (
        <VacinaForm saving={saving} onSave={(r) => save('vaccinations', r)} onCancel={() => setActiveForm(null)} />
      )}
      {activeForm === 'visita' && (
        <VisitaForm saving={saving} onSave={(r) => save('home_visits', r)} onCancel={() => setActiveForm(null)} />
      )}
    </div>
  )
}

// ── Consulta ──
function ConsultaForm({ saving, onSave, onCancel }: { saving: boolean; onSave: (r: Record<string, unknown>) => void; onCancel: () => void }) {
  const [date, setDate] = useState(todayStr())
  const [demandType, setDemandType] = useState<'programada' | 'espontanea'>('programada')
  const [profType, setProfType] = useState('medico')
  const [cbo, setCbo] = useState('')
  const [modality, setModality] = useState<'presencial' | 'remota' | 'domiciliar'>('presencial')

  return (
    <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 space-y-3">
      <p className="text-xs font-semibold text-blue-900">Nova Consulta</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Data</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Tipo demanda</label>
          <select value={demandType} onChange={e => setDemandType(e.target.value as 'programada' | 'espontanea')}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm">
            <option value="programada">Programada</option>
            <option value="espontanea">Espontanea</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Profissional</label>
          <select value={profType} onChange={e => setProfType(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm">
            <option value="medico">Medico</option>
            <option value="enfermeiro">Enfermeiro</option>
            <option value="dentista">Dentista</option>
            <option value="acs">ACS</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">CBO (opcional)</label>
          <input value={cbo} onChange={e => setCbo(e.target.value)} placeholder="ex: 225142"
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Modalidade</label>
          <select value={modality} onChange={e => setModality(e.target.value as 'presencial' | 'remota' | 'domiciliar')}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm">
            <option value="presencial">Presencial</option>
            <option value="remota">Remota</option>
            <option value="domiciliar">Domiciliar</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <button disabled={saving || !date} onClick={() => onSave({
          consultation_date: date, demand_type: demandType, professional_type: profType,
          professional_cbo: cbo || null, modality,
        })} className="px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition">
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        <button onClick={onCancel} className="px-4 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs rounded-lg hover:bg-gray-50">Cancelar</button>
      </div>
    </div>
  )
}

// ── Medicao ──
function MedicaoForm({ saving, onSave, onCancel }: { saving: boolean; onSave: (r: Record<string, unknown>) => void; onCancel: () => void }) {
  const [date, setDate] = useState(todayStr())
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [bpSys, setBpSys] = useState('')
  const [bpDia, setBpDia] = useState('')

  return (
    <div className="border border-green-200 bg-green-50 rounded-lg p-4 space-y-3">
      <p className="text-xs font-semibold text-green-900">Nova Medicao</p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Data</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Peso (kg)</label>
          <input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} placeholder="70.5"
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Altura (cm)</label>
          <input type="number" value={height} onChange={e => setHeight(e.target.value)} placeholder="170"
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">PA Sist.</label>
          <input type="number" value={bpSys} onChange={e => setBpSys(e.target.value)} placeholder="120"
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">PA Diast.</label>
          <input type="number" value={bpDia} onChange={e => setBpDia(e.target.value)} placeholder="80"
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
        </div>
      </div>
      <div className="flex gap-2">
        <button disabled={saving || !date} onClick={() => onSave({
          measurement_date: date,
          weight_kg: weight ? parseFloat(weight) : null,
          height_cm: height ? parseFloat(height) : null,
          bp_systolic: bpSys ? parseInt(bpSys) : null,
          bp_diastolic: bpDia ? parseInt(bpDia) : null,
        })} className="px-4 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:bg-green-300 transition">
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        <button onClick={onCancel} className="px-4 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs rounded-lg hover:bg-gray-50">Cancelar</button>
      </div>
    </div>
  )
}

// ── Procedimento ──
function ProcedimentoForm({ saving, onSave, onCancel }: { saving: boolean; onSave: (r: Record<string, unknown>) => void; onCancel: () => void }) {
  const [date, setDate] = useState(todayStr())
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [result, setResult] = useState('')

  const presets = [
    { code: '02.02.01.050-3', name: 'HbA1c (glicohemoglobina)' },
    { code: '03.01.04.009-5', name: 'Exame do pe diabetico' },
    { code: '02.03.01.001-9', name: 'Citopatologico cervico-vaginal (Papanicolau)' },
    { code: '02.04.03.018-8', name: 'Mamografia bilateral' },
  ]

  return (
    <div className="border border-purple-200 bg-purple-50 rounded-lg p-4 space-y-3">
      <p className="text-xs font-semibold text-purple-900">Novo Procedimento</p>
      <div className="flex flex-wrap gap-1.5 mb-1">
        <span className="text-xs text-gray-500">Atalhos:</span>
        {presets.map(p => (
          <button key={p.code} onClick={() => { setCode(p.code); setName(p.name) }}
            className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded hover:bg-purple-200 transition">
            {p.name.split(' ')[0]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Data</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Codigo SIGTAP</label>
          <input value={code} onChange={e => setCode(e.target.value)} placeholder="02.02.01.050-3"
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Nome</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="HbA1c"
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Resultado</label>
          <input value={result} onChange={e => setResult(e.target.value)} placeholder="6.5%"
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
        </div>
      </div>
      <div className="flex gap-2">
        <button disabled={saving || !date || !code} onClick={() => onSave({
          procedure_date: date, procedure_code: code, procedure_name: name || null, result_value: result || null,
        })} className="px-4 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 disabled:bg-purple-300 transition">
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        <button onClick={onCancel} className="px-4 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs rounded-lg hover:bg-gray-50">Cancelar</button>
      </div>
    </div>
  )
}

// ── Vacina ──
function VacinaForm({ saving, onSave, onCancel }: { saving: boolean; onSave: (r: Record<string, unknown>) => void; onCancel: () => void }) {
  const [date, setDate] = useState(todayStr())
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [dose, setDose] = useState('1')

  const presets = [
    { code: '09', name: 'Penta (DTP/HepB/Hib)' },
    { code: '22', name: 'VIP/VOP (Polio)' },
    { code: '24', name: 'SCR (Triplice Viral)' },
    { code: '26', name: 'Pneumo 10v' },
    { code: '57', name: 'dTpa (gestante)' },
    { code: '33', name: 'Influenza' },
    { code: '67', name: 'HPV' },
  ]

  return (
    <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-4 space-y-3">
      <p className="text-xs font-semibold text-yellow-900">Nova Vacina</p>
      <div className="flex flex-wrap gap-1.5 mb-1">
        <span className="text-xs text-gray-500">Atalhos:</span>
        {presets.map(p => (
          <button key={p.code} onClick={() => { setCode(p.code); setName(p.name) }}
            className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded hover:bg-yellow-200 transition">
            {p.name.split(' ')[0]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Data</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Codigo vacina</label>
          <input value={code} onChange={e => setCode(e.target.value)} placeholder="09"
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Nome</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Penta"
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Dose</label>
          <input type="number" min="1" max="10" value={dose} onChange={e => setDose(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
        </div>
      </div>
      <div className="flex gap-2">
        <button disabled={saving || !date || !code} onClick={() => onSave({
          dose_date: date, vaccine_code: code, vaccine_name: name || null, dose_number: parseInt(dose) || 1,
        })} className="px-4 py-1.5 bg-yellow-600 text-white text-xs font-medium rounded-lg hover:bg-yellow-700 disabled:bg-yellow-300 transition">
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        <button onClick={onCancel} className="px-4 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs rounded-lg hover:bg-gray-50">Cancelar</button>
      </div>
    </div>
  )
}

// ── Visita ACS ──
function VisitaForm({ saving, onSave, onCancel }: { saving: boolean; onSave: (r: Record<string, unknown>) => void; onCancel: () => void }) {
  const [date, setDate] = useState(todayStr())
  const [cbo, setCbo] = useState('515105')
  const [reason, setReason] = useState('')

  return (
    <div className="border border-orange-200 bg-orange-50 rounded-lg p-4 space-y-3">
      <p className="text-xs font-semibold text-orange-900">Nova Visita Domiciliar</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Data</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Profissional</label>
          <select value={cbo} onChange={e => setCbo(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm">
            <option value="515105">ACS (5151-05)</option>
            <option value="322255">TACS (3222-55)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Motivo</label>
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Acompanhamento"
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
        </div>
      </div>
      <div className="flex gap-2">
        <button disabled={saving || !date} onClick={() => onSave({
          visit_date: date, visitor_cbo: cbo, visit_reason: reason || null,
        })} className="px-4 py-1.5 bg-orange-600 text-white text-xs font-medium rounded-lg hover:bg-orange-700 disabled:bg-orange-300 transition">
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        <button onClick={onCancel} className="px-4 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs rounded-lg hover:bg-gray-50">Cancelar</button>
      </div>
    </div>
  )
}
