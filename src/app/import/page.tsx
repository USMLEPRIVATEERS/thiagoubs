'use client'

import { useState, useRef, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/ui/Navbar'
import { parseCSV, parsePastedText, type ParsedCSV } from '@/lib/csv/parser'
import { autoMapColumns, parseDate, detectCpfOrCns, PATIENT_FIELDS, type ColumnMapping } from '@/lib/csv/mapper'

type Step = 'input' | 'map' | 'importing' | 'done'

export default function ImportPage() {
  const [step, setStep] = useState<Step>('input')
  const [showPasteModal, setShowPasteModal] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [parsedData, setParsedData] = useState<ParsedCSV | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, phase: '' })
  const [result, setResult] = useState<{ success: number; updated: number; errors: string[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = useMemo(() => createClient(), [])

  function handleProcessPaste() {
    if (!pasteText.trim()) return
    const parsed = parsePastedText(pasteText)
    if (parsed.headers.length === 0) return

    setParsedData(parsed)
    setMapping(autoMapColumns(parsed.headers, PATIENT_FIELDS))
    setShowPasteModal(false)
    setStep('map')
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setResult(null)

    const parsed = await parseCSV(file)
    setParsedData(parsed)
    setMapping(autoMapColumns(parsed.headers, PATIENT_FIELDS))
    setStep('map')
  }

  function updateMapping(field: string, csvColumn: string) {
    setMapping(prev => ({ ...prev, [field]: csvColumn }))
  }

  function handleReset() {
    setStep('input')
    setParsedData(null)
    setMapping({})
    setResult(null)
    setPasteText('')
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleImport() {
    if (!parsedData) return
    setImporting(true)
    setStep('importing')
    setResult(null)

    const totalRows = parsedData.rows.length
    const errors: string[] = []
    let success = 0
    let updated = 0

    // Phase 1: Parse all rows into patient objects
    setProgress({ current: 0, total: totalRows, phase: 'Preparando dados...' })

    const withCpf: { patient: Record<string, unknown>; lineNum: number }[] = []
    const withoutCpf: { patient: Record<string, unknown>; lineNum: number }[] = []
    const cpfsInImport: string[] = []

    for (let i = 0; i < totalRows; i++) {
      const row = parsedData.rows[i]
      const name = row[mapping.name]?.trim()
      const dob = parseDate(row[mapping.date_of_birth] || '')
      if (!name) { errors.push(`Linha ${i + 2}: Nome vazio`); continue }
      if (!dob) { errors.push(`Linha ${i + 2}: Data de nascimento invalida`); continue }

      const patient: Record<string, unknown> = {
        name,
        date_of_birth: dob,
        sex: row[mapping.sex]?.trim().toUpperCase() === 'F' ? 'F' : 'M',
        team_type: Number(row[mapping.team_type]) === 76 ? 76 : 70,
        status: 'active',
        tags: [],
      }
      if (mapping.cpf_or_cns && row[mapping.cpf_or_cns]) {
        const detected = detectCpfOrCns(row[mapping.cpf_or_cns])
        if (detected.type === 'cpf') patient.cpf = detected.cleaned
        else if (detected.type === 'cns') patient.cns = detected.cleaned
      }
      if (mapping.cpf && row[mapping.cpf]) patient.cpf = row[mapping.cpf].replace(/\D/g, '')
      if (mapping.cns && row[mapping.cns]) patient.cns = row[mapping.cns].trim()
      if (mapping.micro_area && row[mapping.micro_area]) patient.micro_area = Number(row[mapping.micro_area])

      if (patient.cpf) {
        cpfsInImport.push(patient.cpf as string)
        withCpf.push({ patient, lineNum: i + 2 })
      } else {
        withoutCpf.push({ patient, lineNum: i + 2 })
      }
    }

    // Phase 2: Check existing CPFs in batches
    setProgress({ current: 0, total: cpfsInImport.length, phase: 'Verificando duplicados...' })
    const existingCpfs = new Set<string>()
    for (let i = 0; i < cpfsInImport.length; i += 500) {
      const batch = cpfsInImport.slice(i, i + 500)
      const { data } = await supabase.from('patients').select('cpf').in('cpf', batch)
      if (data) data.forEach(p => { if (p.cpf) existingCpfs.add(p.cpf) })
      setProgress({ current: Math.min(i + 500, cpfsInImport.length), total: cpfsInImport.length, phase: 'Verificando duplicados...' })
    }

    // Separate new vs existing patients
    const newPatients: typeof withCpf = []
    const existingPatients: typeof withCpf = []
    for (const item of withCpf) {
      const cpf = item.patient.cpf as string
      if (existingCpfs.has(cpf)) {
        // For existing patients, don't overwrite tags
        const { tags: _tags, ...withoutTags } = item.patient
        void _tags
        existingPatients.push({ patient: withoutTags, lineNum: item.lineNum })
      } else {
        newPatients.push(item)
      }
    }

    // Phase 3: Save in batches of 50 (safe for Supabase limits)
    const BATCH_SIZE = 50
    let processed = 0
    const totalToSave = withCpf.length + withoutCpf.length

    // 3a: Upsert existing patients (without tags field)
    for (let i = 0; i < existingPatients.length; i += BATCH_SIZE) {
      const batch = existingPatients.slice(i, i + BATCH_SIZE)
      const patients = batch.map(b => b.patient)
      setProgress({ current: processed, total: totalToSave, phase: `Atualizando existentes (${processed}/${totalToSave})...` })

      const { error } = await supabase.from('patients').upsert(patients, { onConflict: 'cpf' })
      if (error) {
        for (const item of batch) {
          const { error: singleErr } = await supabase.from('patients').upsert(item.patient, { onConflict: 'cpf' })
          if (singleErr) errors.push(`Linha ${item.lineNum}: ${singleErr.message}`)
          else updated++
          processed++
        }
      } else {
        updated += batch.length
        processed += batch.length
      }
    }

    // 3b: Insert new patients with CPF
    for (let i = 0; i < newPatients.length; i += BATCH_SIZE) {
      const batch = newPatients.slice(i, i + BATCH_SIZE)
      const patients = batch.map(b => b.patient)
      setProgress({ current: processed, total: totalToSave, phase: `Adicionando novos (${processed}/${totalToSave})...` })

      const { error } = await supabase.from('patients').upsert(patients, { onConflict: 'cpf' })
      if (error) {
        for (const item of batch) {
          const { error: singleErr } = await supabase.from('patients').upsert(item.patient, { onConflict: 'cpf' })
          if (singleErr) errors.push(`Linha ${item.lineNum}: ${singleErr.message}`)
          else success++
          processed++
        }
      } else {
        success += batch.length
        processed += batch.length
      }
    }

    // 3c: Insert patients WITHOUT CPF
    for (let i = 0; i < withoutCpf.length; i += BATCH_SIZE) {
      const batch = withoutCpf.slice(i, i + BATCH_SIZE)
      const patients = batch.map(b => b.patient)
      setProgress({ current: processed, total: totalToSave, phase: `Adicionando sem CPF (${processed}/${totalToSave})...` })

      const { error } = await supabase.from('patients').insert(patients)
      if (error) {
        for (const item of batch) {
          const { error: singleErr } = await supabase.from('patients').insert(item.patient)
          if (singleErr) errors.push(`Linha ${item.lineNum}: ${singleErr.message}`)
          else success++
          processed++
        }
      } else {
        success += batch.length
        processed += batch.length
      }
    }

    setResult({ success, updated, errors })
    setImporting(false)
    setStep('done')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Importar Pacientes</h1>
        <p className="text-sm text-gray-500 mb-6">
          Cole dados de uma planilha ou selecione um arquivo CSV. Depois mapeie as colunas e importe.
        </p>

        {/* Step 1: Input source */}
        {step === 'input' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Como voce quer importar?</h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Paste option */}
              <button
                onClick={() => setShowPasteModal(true)}
                className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition text-center"
              >
                <span className="text-3xl">📋</span>
                <span className="text-sm font-semibold text-gray-900">Colar da Planilha</span>
                <span className="text-xs text-gray-500">
                  Copie as linhas da planilha (Excel, Google Sheets) e cole aqui
                </span>
              </button>

              {/* File option */}
              <label className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition text-center cursor-pointer">
                <span className="text-3xl">📁</span>
                <span className="text-sm font-semibold text-gray-900">Arquivo CSV</span>
                <span className="text-xs text-gray-500">
                  Selecione um arquivo .csv ou .txt do computador
                </span>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.txt,.tsv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>

              {/* Tag assignment option */}
              <Link
                href="/import/tags"
                className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-green-400 hover:bg-green-50 transition text-center"
              >
                <span className="text-3xl">🏷️</span>
                <span className="text-sm font-semibold text-gray-900">Atribuir Tags</span>
                <span className="text-xs text-gray-500">
                  Cole planilha do SUS e atribua tags (Diabetes, Hipertensao, etc) aos pacientes ja cadastrados
                </span>
              </Link>
            </div>
          </div>
        )}

        {/* Paste Modal */}
        {showPasteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl border border-gray-200 w-full max-w-3xl max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between p-5 border-b border-gray-200">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Colar dados da planilha</h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Copie as celulas no Excel/Google Sheets (incluindo o cabecalho) e cole abaixo
                  </p>
                </div>
                <button
                  onClick={() => setShowPasteModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                >
                  ×
                </button>
              </div>

              <div className="p-5 flex-1 overflow-auto">
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={"Nome\tData Nascimento\tCPF\tSexo\tMicroarea\nJoao Silva\t01/01/1990\t123.456.789-00\tM\t1\nMaria Santos\t15/06/1985\t987.654.321-00\tF\t2"}
                  className="w-full h-64 px-4 py-3 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                  autoFocus
                />

                {pasteText.trim() && (
                  <div className="mt-3">
                    <p className="text-xs text-gray-500">
                      {pasteText.split('\n').filter(l => l.trim()).length - 1} linhas detectadas
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-200">
                <button
                  onClick={() => setShowPasteModal(false)}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleProcessPaste}
                  disabled={!pasteText.trim()}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition"
                >
                  Processar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Map columns */}
        {step === 'map' && parsedData && (
          <>
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Mapear colunas</h2>
                  <p className="text-xs text-gray-500 mt-1">
                    {parsedData.rows.length} linhas encontradas. Selecione qual coluna corresponde a cada campo.
                  </p>
                </div>
                <button
                  onClick={handleReset}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Voltar
                </button>
              </div>

              {parsedData.errors.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                  <p className="text-xs font-medium text-amber-800">Avisos:</p>
                  {parsedData.errors.slice(0, 3).map((e, i) => (
                    <p key={i} className="text-xs text-amber-700">{e}</p>
                  ))}
                </div>
              )}

              <div className="space-y-3">
                {PATIENT_FIELDS.map(field => (
                  <div key={field.key} className="flex items-center gap-3">
                    <label className="text-sm text-gray-700 w-52 flex-shrink-0">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <select
                      value={mapping[field.key] || ''}
                      onChange={(e) => updateMapping(field.key, e.target.value)}
                      className={`flex-1 px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none ${
                        field.required && !mapping[field.key]
                          ? 'border-red-300 bg-red-50'
                          : 'border-gray-300'
                      }`}
                    >
                      <option value="">-- Nao mapear --</option>
                      {parsedData.headers.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    {/* Show sample value */}
                    {mapping[field.key] && parsedData.rows[0] && (
                      <span className="text-xs text-gray-400 w-40 truncate flex-shrink-0">
                        ex: {parsedData.rows[0][mapping[field.key]] || '-'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Preview table */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
              <h3 className="text-xs font-semibold text-gray-900 mb-3">
                Preview (primeiras {Math.min(5, parsedData.rows.length)} linhas)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      {parsedData.headers.map(h => (
                        <th key={h} className="text-left px-2 py-1.5 bg-gray-50 border text-gray-500 font-medium whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.rows.slice(0, 5).map((row, i) => (
                      <tr key={i}>
                        {parsedData.headers.map(h => (
                          <td key={h} className="px-2 py-1.5 border text-gray-700 truncate max-w-[200px] whitespace-nowrap">
                            {row[h] || ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Import button */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <button
                onClick={handleImport}
                disabled={!mapping.name || !mapping.date_of_birth}
                className="px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition"
              >
                Adicionar {parsedData.rows.length} pacientes
              </button>
              {(!mapping.name || !mapping.date_of_birth) && (
                <p className="text-xs text-red-500 mt-2">
                  Mapeie pelo menos Nome e Data de Nascimento para continuar.
                </p>
              )}
            </div>
          </>
        )}

        {/* Step 3: Importing with progress */}
        {step === 'importing' && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-sm font-medium text-gray-900 mb-1">{progress.phase || 'Importando pacientes...'}</p>
            {progress.total > 0 && (
              <>
                <div className="w-64 mx-auto bg-gray-200 rounded-full h-2.5 mt-3 mb-2">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  {progress.current} / {progress.total} ({Math.round((progress.current / progress.total) * 100)}%)
                </p>
              </>
            )}
          </div>
        )}

        {/* Step 4: Results */}
        {step === 'done' && result && (
          <div className="space-y-4">
            <div className={`rounded-xl border p-5 ${
              result.errors.length > 0 && result.success === 0
                ? 'bg-red-50 border-red-200'
                : 'bg-green-50 border-green-200'
            }`}>
              <h2 className="text-sm font-semibold text-gray-900 mb-2">Resultado</h2>
              <p className="text-sm text-green-700 font-medium">
                {result.success} pacientes novos adicionados
              </p>
              {result.updated > 0 && (
                <p className="text-sm text-amber-700 font-medium">
                  {result.updated} pacientes ja existiam (atualizados por CPF)
                </p>
              )}
              {result.errors.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm text-red-700 font-medium">{result.errors.length} erros:</p>
                  <div className="mt-1 max-h-40 overflow-y-auto">
                    {result.errors.map((e, i) => (
                      <p key={i} className="text-xs text-red-600">{e}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Proximo passo</h3>
              <p className="text-sm text-gray-600 mb-4">
                Agora va na pagina de cada paciente para definir as tags (condicoes, acompanhamentos, etc).
              </p>
              <div className="flex gap-3">
                <Link
                  href="/patients"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
                >
                  Ver Pacientes
                </Link>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
                >
                  Importar mais
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
