'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/ui/Navbar'
import { parseCSV, type ParsedCSV } from '@/lib/csv/parser'
import { IMPORT_TYPES, autoMapColumns, parseDate, type ColumnMapping } from '@/lib/csv/mapper'

export default function ImportPage() {
  const [importType, setImportType] = useState('patients')
  const [parsedCSV, setParsedCSV] = useState<ParsedCSV | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ success: number; errors: string[] } | null>(null)
  const [fileName, setFileName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const selectedType = IMPORT_TYPES.find(t => t.key === importType)!

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)

    const parsed = await parseCSV(file)
    setParsedCSV(parsed)

    const autoMap = autoMapColumns(parsed.headers, selectedType.fields)
    setMapping(autoMap)
  }

  function updateMapping(field: string, csvColumn: string) {
    setMapping(prev => ({ ...prev, [field]: csvColumn }))
  }

  async function handleImport() {
    if (!parsedCSV) return
    setImporting(true)
    setResult(null)

    const errors: string[] = []
    let success = 0

    // Log the import
    const { data: importLog } = await supabase
      .from('csv_imports')
      .insert({ filename: fileName, indicator: importType, status: 'processing', rows_imported: 0 })
      .select()
      .single()

    try {
      if (importType === 'patients') {
        for (let i = 0; i < parsedCSV.rows.length; i++) {
          const row = parsedCSV.rows[i]
          try {
            const name = row[mapping.name]?.trim()
            const dob = parseDate(row[mapping.date_of_birth] || '')
            if (!name) { errors.push(`Linha ${i + 2}: Nome vazio`); continue }
            if (!dob) { errors.push(`Linha ${i + 2}: Data de nascimento invalida`); continue }

            const patient: Record<string, unknown> = {
              name,
              date_of_birth: dob,
              sex: row[mapping.sex]?.trim().toUpperCase() === 'F' ? 'F' : 'M',
              team_type: Number(row[mapping.team_type]) === 76 ? 76 : 70,
            }
            if (mapping.cpf && row[mapping.cpf]) patient.cpf = row[mapping.cpf].replace(/\D/g, '')
            if (mapping.cns && row[mapping.cns]) patient.cns = row[mapping.cns].trim()
            if (mapping.micro_area && row[mapping.micro_area]) patient.micro_area = Number(row[mapping.micro_area])

            // Upsert by CPF if available
            if (patient.cpf) {
              const { error } = await supabase
                .from('patients')
                .upsert(patient, { onConflict: 'cpf' })
              if (error) { errors.push(`Linha ${i + 2}: ${error.message}`); continue }
            } else {
              const { error } = await supabase.from('patients').insert(patient)
              if (error) { errors.push(`Linha ${i + 2}: ${error.message}`); continue }
            }
            success++
          } catch (err) {
            errors.push(`Linha ${i + 2}: Erro inesperado`)
          }
        }
      } else {
        // For other types, we need to look up the patient by CPF or name
        for (let i = 0; i < parsedCSV.rows.length; i++) {
          const row = parsedCSV.rows[i]
          try {
            const cpf = row[mapping.patient_cpf]?.replace(/\D/g, '')
            const patientName = row[mapping.patient_name]?.trim()

            let patientId: string | null = null

            if (cpf) {
              const { data } = await supabase
                .from('patients')
                .select('id')
                .eq('cpf', cpf)
                .single()
              patientId = data?.id || null
            }

            if (!patientId && patientName) {
              const { data } = await supabase
                .from('patients')
                .select('id')
                .ilike('name', patientName)
                .limit(1)
                .single()
              patientId = data?.id || null
            }

            if (!patientId) {
              errors.push(`Linha ${i + 2}: Paciente nao encontrado (CPF: ${cpf || '-'}, Nome: ${patientName || '-'})`)
              continue
            }

            if (importType === 'consultations') {
              const date = parseDate(row[mapping.consultation_date] || '')
              if (!date) { errors.push(`Linha ${i + 2}: Data invalida`); continue }
              const { error } = await supabase.from('consultations').insert({
                patient_id: patientId,
                professional_type: row[mapping.professional_type]?.trim().toLowerCase() || 'medico',
                professional_cbo: row[mapping.professional_cbo]?.trim() || null,
                consultation_date: date,
                modality: row[mapping.modality]?.trim().toLowerCase() || 'presencial',
                demand_type: row[mapping.demand_type]?.trim().toLowerCase() || 'programada',
              })
              if (error) { errors.push(`Linha ${i + 2}: ${error.message}`); continue }
            } else if (importType === 'measurements') {
              const date = parseDate(row[mapping.measurement_date] || '')
              if (!date) { errors.push(`Linha ${i + 2}: Data invalida`); continue }
              const { error } = await supabase.from('measurements').insert({
                patient_id: patientId,
                measurement_date: date,
                weight_kg: row[mapping.weight_kg] ? parseFloat(row[mapping.weight_kg].replace(',', '.')) : null,
                height_cm: row[mapping.height_cm] ? parseFloat(row[mapping.height_cm].replace(',', '.')) : null,
                bp_systolic: row[mapping.bp_systolic] ? parseInt(row[mapping.bp_systolic]) : null,
                bp_diastolic: row[mapping.bp_diastolic] ? parseInt(row[mapping.bp_diastolic]) : null,
              })
              if (error) { errors.push(`Linha ${i + 2}: ${error.message}`); continue }
            } else if (importType === 'procedures') {
              const date = parseDate(row[mapping.procedure_date] || '')
              if (!date) { errors.push(`Linha ${i + 2}: Data invalida`); continue }
              const { error } = await supabase.from('procedures').insert({
                patient_id: patientId,
                procedure_code: row[mapping.procedure_code]?.trim() || 'UNKNOWN',
                procedure_name: row[mapping.procedure_name]?.trim() || null,
                procedure_date: date,
                result_value: row[mapping.result_value]?.trim() || null,
              })
              if (error) { errors.push(`Linha ${i + 2}: ${error.message}`); continue }
            } else if (importType === 'home_visits') {
              const date = parseDate(row[mapping.visit_date] || '')
              if (!date) { errors.push(`Linha ${i + 2}: Data invalida`); continue }
              const { error } = await supabase.from('home_visits').insert({
                patient_id: patientId,
                visitor_cbo: row[mapping.visitor_cbo]?.trim() || '5151-05',
                visit_date: date,
                visit_reason: row[mapping.visit_reason]?.trim() || null,
              })
              if (error) { errors.push(`Linha ${i + 2}: ${error.message}`); continue }
            } else if (importType === 'vaccinations') {
              const date = parseDate(row[mapping.dose_date] || '')
              if (!date) { errors.push(`Linha ${i + 2}: Data invalida`); continue }
              const { error } = await supabase.from('vaccinations').insert({
                patient_id: patientId,
                vaccine_code: row[mapping.vaccine_code]?.trim() || 'UNKNOWN',
                vaccine_name: row[mapping.vaccine_name]?.trim() || null,
                dose_date: date,
                dose_number: row[mapping.dose_number] ? parseInt(row[mapping.dose_number]) : null,
              })
              if (error) { errors.push(`Linha ${i + 2}: ${error.message}`); continue }
            }
            success++
          } catch {
            errors.push(`Linha ${i + 2}: Erro inesperado`)
          }
        }
      }
    } catch {
      errors.push('Erro geral na importacao')
    }

    // Update import log
    if (importLog) {
      await supabase
        .from('csv_imports')
        .update({
          status: errors.length > 0 && success === 0 ? 'error' : 'completed',
          rows_imported: success,
          error_log: errors.length > 0 ? errors.join('\n') : null,
        })
        .eq('id', importLog.id)
    }

    setResult({ success, errors })
    setImporting(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Importar CSV</h1>

        {/* Step 1: Select type */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">1. Tipo de dados</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {IMPORT_TYPES.map(type => (
              <button
                key={type.key}
                onClick={() => { setImportType(type.key); setParsedCSV(null); setResult(null) }}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
                  importType === type.key
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Upload file */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">2. Selecionar arquivo CSV</h2>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            onChange={handleFileSelect}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {fileName && <p className="text-xs text-gray-500 mt-2">Arquivo: {fileName}</p>}
        </div>

        {/* Step 3: Map columns */}
        {parsedCSV && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              3. Mapear colunas ({parsedCSV.rows.length} linhas encontradas)
            </h2>

            {parsedCSV.errors.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <p className="text-xs font-medium text-amber-800">Avisos do parser:</p>
                {parsedCSV.errors.slice(0, 5).map((e, i) => (
                  <p key={i} className="text-xs text-amber-700">{e}</p>
                ))}
              </div>
            )}

            <div className="space-y-3">
              {selectedType.fields.map(field => (
                <div key={field.key} className="flex items-center gap-3">
                  <label className="text-sm text-gray-700 w-48 flex-shrink-0">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <select
                    value={mapping[field.key] || ''}
                    onChange={(e) => updateMapping(field.key, e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    <option value="">-- Nao mapear --</option>
                    {parsedCSV.headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Preview */}
            <div className="mt-4">
              <h3 className="text-xs font-medium text-gray-500 mb-2">Preview (primeiras 5 linhas):</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      {parsedCSV.headers.slice(0, 8).map(h => (
                        <th key={h} className="text-left px-2 py-1 bg-gray-50 border text-gray-500 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedCSV.rows.slice(0, 5).map((row, i) => (
                      <tr key={i}>
                        {parsedCSV.headers.slice(0, 8).map(h => (
                          <td key={h} className="px-2 py-1 border text-gray-700 truncate max-w-[150px]">{row[h]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Import */}
        {parsedCSV && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">4. Importar</h2>
            <button
              onClick={handleImport}
              disabled={importing}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition"
            >
              {importing ? 'Importando...' : `Importar ${parsedCSV.rows.length} registros`}
            </button>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className={`rounded-xl border p-5 ${result.errors.length > 0 && result.success === 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Resultado</h2>
            <p className="text-sm text-green-700">{result.success} registros importados com sucesso</p>
            {result.errors.length > 0 && (
              <div className="mt-2">
                <p className="text-sm text-red-700 font-medium">{result.errors.length} erros:</p>
                <div className="mt-1 max-h-40 overflow-y-auto">
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-xs text-red-600">{e}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
