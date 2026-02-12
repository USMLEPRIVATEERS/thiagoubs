'use client'

import { useState, useRef, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/ui/Navbar'
import { parseCSV, parsePastedText, type ParsedCSV } from '@/lib/csv/parser'
import { autoMapColumns, parseDate, detectCpfOrCns, type ColumnMapping } from '@/lib/csv/mapper'
import { ELIGIBILITY_TAGS, INDICATOR_LIST } from '@/lib/tags'

const TAG_FIELDS = [
  { key: 'name', label: 'Nome', required: true },
  { key: 'date_of_birth', label: 'Data de Nascimento', required: false },
  { key: 'cpf_or_cns', label: 'CPF ou CNS (auto-detecta)', required: false },
  { key: 'cpf', label: 'CPF (coluna separada)', required: false },
  { key: 'cns', label: 'CNS (coluna separada)', required: false },
]

// Map eligibility tags to indicator codes for display
const TAG_INDICATOR_MAP: Record<string, string> = {}
for (const ind of INDICATOR_LIST) {
  for (const t of ind.eligibilityTags) {
    TAG_INDICATOR_MAP[t] = ind.code
  }
}

interface MatchedPatient {
  id: string
  name: string
  cpf?: string
  cns?: string
  tags?: string[]
}

interface UnmatchedRow {
  lineNumber: number
  name: string
  cpf?: string
  cns?: string
  dob?: string
}

type Step = 'input' | 'map' | 'select_tag' | 'matching' | 'results' | 'saving' | 'done'

export default function ImportTagsPage() {
  const [step, setStep] = useState<Step>('input')
  const [showPasteModal, setShowPasteModal] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [parsedData, setParsedData] = useState<ParsedCSV | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [selectedTag, setSelectedTag] = useState('')
  const [matched, setMatched] = useState<MatchedPatient[]>([])
  const [alreadyTagged, setAlreadyTagged] = useState<MatchedPatient[]>([])
  const [unmatched, setUnmatched] = useState<UnmatchedRow[]>([])
  const [saveResult, setSaveResult] = useState<{ saved: number; errors: string[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = useMemo(() => createClient(), [])

  function handleProcessPaste() {
    if (!pasteText.trim()) return
    const parsed = parsePastedText(pasteText)
    if (parsed.headers.length === 0) return
    setParsedData(parsed)
    setMapping(autoMapColumns(parsed.headers, TAG_FIELDS))
    setShowPasteModal(false)
    setStep('map')
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const parsed = await parseCSV(file)
    setParsedData(parsed)
    setMapping(autoMapColumns(parsed.headers, TAG_FIELDS))
    setStep('map')
  }

  function updateMapping(field: string, csvColumn: string) {
    setMapping(prev => ({ ...prev, [field]: csvColumn }))
  }

  function handleReset() {
    setStep('input')
    setParsedData(null)
    setMapping({})
    setSelectedTag('')
    setMatched([])
    setAlreadyTagged([])
    setUnmatched([])
    setSaveResult(null)
    setPasteText('')
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleGoToTagSelect() {
    setStep('select_tag')
  }

  // Fetch ALL patients from DB, paginated in 1000-row chunks
  async function fetchAllPatients() {
    const all: { id: string; name: string; date_of_birth: string; cpf: string | null; cns: string | null; tags: string[] | null }[] = []
    let from = 0
    const PAGE_SIZE = 1000
    while (true) {
      const { data, error } = await supabase
        .from('patients')
        .select('id, name, date_of_birth, cpf, cns, tags')
        .range(from, from + PAGE_SIZE - 1)
      if (error) throw error
      if (data) all.push(...data)
      if (!data || data.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
    return all
  }

  // Normalize name for fuzzy matching
  function normalizeName(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  async function handleMatch() {
    if (!parsedData || !selectedTag) return
    setStep('matching')

    try {
      const dbPatients = await fetchAllPatients()

      // Build lookup indexes
      const byCpf = new Map<string, typeof dbPatients[0]>()
      const byCns = new Map<string, typeof dbPatients[0]>()
      const byNameDob = new Map<string, typeof dbPatients[0]>()

      for (const p of dbPatients) {
        if (p.cpf) byCpf.set(p.cpf, p)
        if (p.cns) byCns.set(p.cns, p)
        const key = `${normalizeName(p.name)}|${p.date_of_birth}`
        byNameDob.set(key, p)
      }

      const matchedList: MatchedPatient[] = []
      const alreadyTaggedList: MatchedPatient[] = []
      const unmatchedList: UnmatchedRow[] = []
      const matchedIds = new Set<string>()

      for (let i = 0; i < parsedData.rows.length; i++) {
        const row = parsedData.rows[i]
        const name = row[mapping.name]?.trim()
        if (!name) continue

        // Extract CPF/CNS
        let cpf = ''
        let cns = ''
        if (mapping.cpf_or_cns && row[mapping.cpf_or_cns]) {
          const detected = detectCpfOrCns(row[mapping.cpf_or_cns])
          if (detected.type === 'cpf') cpf = detected.cleaned
          else if (detected.type === 'cns') cns = detected.cleaned
        }
        if (mapping.cpf && row[mapping.cpf]) cpf = row[mapping.cpf].replace(/\D/g, '')
        if (mapping.cns && row[mapping.cns]) cns = row[mapping.cns].trim()

        const dob = mapping.date_of_birth ? parseDate(row[mapping.date_of_birth] || '') : null

        // Try matching: CPF > CNS > Name+DOB
        let found: typeof dbPatients[0] | undefined
        if (cpf) found = byCpf.get(cpf)
        if (!found && cns) found = byCns.get(cns)
        if (!found && dob) {
          const key = `${normalizeName(name)}|${dob}`
          found = byNameDob.get(key)
        }

        if (found && !matchedIds.has(found.id)) {
          matchedIds.add(found.id)
          const patientTags = found.tags || []
          if (patientTags.includes(selectedTag)) {
            alreadyTaggedList.push({
              id: found.id,
              name: found.name,
              cpf: found.cpf || undefined,
              cns: found.cns || undefined,
              tags: patientTags,
            })
          } else {
            matchedList.push({
              id: found.id,
              name: found.name,
              cpf: found.cpf || undefined,
              cns: found.cns || undefined,
              tags: patientTags,
            })
          }
        } else if (!found) {
          unmatchedList.push({
            lineNumber: i + 2,
            name,
            cpf: cpf || undefined,
            cns: cns || undefined,
            dob: dob || undefined,
          })
        }
      }

      setMatched(matchedList)
      setAlreadyTagged(alreadyTaggedList)
      setUnmatched(unmatchedList)
      setStep('results')
    } catch {
      setStep('select_tag')
    }
  }

  async function handleSaveTags() {
    if (matched.length === 0) return
    setStep('saving')
    const errors: string[] = []
    let saved = 0

    // Update in batches of 50
    for (let i = 0; i < matched.length; i++) {
      const p = matched[i]
      try {
        const newTags = [...(p.tags || []), selectedTag]
        const { error } = await supabase
          .from('patients')
          .update({ tags: newTags })
          .eq('id', p.id)
        if (error) { errors.push(`${p.name}: ${error.message}`); continue }
        saved++
      } catch {
        errors.push(`${p.name}: Erro inesperado`)
      }
    }

    setSaveResult({ saved, errors })
    setStep('done')
  }

  function downloadUnmatched() {
    if (unmatched.length === 0) return
    const lines = [
      `Pacientes NAO encontrados no sistema - Tag: ${selectedTag}`,
      `Data: ${new Date().toLocaleDateString('pt-BR')}`,
      `Total: ${unmatched.length}`,
      '',
      'Linha | Nome | CPF | CNS | Nascimento',
      '-'.repeat(80),
      ...unmatched.map(u =>
        `${u.lineNumber} | ${u.name} | ${u.cpf || '-'} | ${u.cns || '-'} | ${u.dob || '-'}`
      ),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nao-encontrados-${selectedTag.toLowerCase().replace(/\s+/g, '-')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const hasMinMapping = mapping.name && (mapping.cpf || mapping.cns || mapping.cpf_or_cns)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/import" className="text-gray-400 hover:text-gray-600 text-sm">&larr; Voltar</Link>
          <h1 className="text-2xl font-bold text-gray-900">Atribuir Tags por Planilha</h1>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Cole a planilha do SUS, selecione a tag (ex: Diabetes, Hipertensao), e o sistema vai encontrar os pacientes ja cadastrados e adicionar a tag automaticamente.
        </p>

        {/* Step 1: Input */}
        {step === 'input' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Cole ou importe a planilha do SUS</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => setShowPasteModal(true)}
                className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition text-center"
              >
                <span className="text-3xl">📋</span>
                <span className="text-sm font-semibold text-gray-900">Colar da Planilha</span>
                <span className="text-xs text-gray-500">Copie do Excel/Google Sheets e cole aqui</span>
              </button>
              <label className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition text-center cursor-pointer">
                <span className="text-3xl">📁</span>
                <span className="text-sm font-semibold text-gray-900">Arquivo CSV</span>
                <span className="text-xs text-gray-500">Selecione um arquivo .csv ou .txt</span>
                <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" onChange={handleFileSelect} className="hidden" />
              </label>
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
                  <p className="text-xs text-gray-500 mt-1">Cole as celulas incluindo o cabecalho</p>
                </div>
                <button onClick={() => setShowPasteModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
              </div>
              <div className="p-5 flex-1 overflow-auto">
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={"Nome\tCPF\tData Nascimento\nJoao Silva\t123.456.789-00\t01/01/1990\nMaria Santos\t987654321012345\t15/06/1985"}
                  className="w-full h-64 px-4 py-3 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                  autoFocus
                />
                {pasteText.trim() && (
                  <p className="text-xs text-gray-500 mt-3">
                    {pasteText.split('\n').filter(l => l.trim()).length - 1} linhas detectadas
                  </p>
                )}
              </div>
              <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-200">
                <button onClick={() => setShowPasteModal(false)} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition">Cancelar</button>
                <button onClick={handleProcessPaste} disabled={!pasteText.trim()} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition">Processar</button>
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
                    {parsedData.rows.length} linhas. Mapeie pelo menos Nome e CPF/CNS.
                  </p>
                </div>
                <button onClick={handleReset} className="text-xs text-gray-500 hover:text-gray-700 underline">Voltar</button>
              </div>
              <div className="space-y-3">
                {TAG_FIELDS.map(field => (
                  <div key={field.key} className="flex items-center gap-3">
                    <label className="text-sm text-gray-700 w-52 flex-shrink-0">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <select
                      value={mapping[field.key] || ''}
                      onChange={(e) => updateMapping(field.key, e.target.value)}
                      className={`flex-1 px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none ${
                        field.required && !mapping[field.key] ? 'border-red-300 bg-red-50' : 'border-gray-300'
                      }`}
                    >
                      <option value="">-- Nao mapear --</option>
                      {parsedData.headers.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    {mapping[field.key] && parsedData.rows[0] && (
                      <span className="text-xs text-gray-400 w-40 truncate flex-shrink-0">
                        ex: {parsedData.rows[0][mapping[field.key]] || '-'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
              <h3 className="text-xs font-semibold text-gray-900 mb-3">
                Preview (primeiras {Math.min(5, parsedData.rows.length)} linhas)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      {parsedData.headers.map(h => (
                        <th key={h} className="text-left px-2 py-1.5 bg-gray-50 border text-gray-500 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.rows.slice(0, 5).map((row, i) => (
                      <tr key={i}>
                        {parsedData.headers.map(h => (
                          <td key={h} className="px-2 py-1.5 border text-gray-700 truncate max-w-[200px] whitespace-nowrap">{row[h] || ''}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <button
                onClick={handleGoToTagSelect}
                disabled={!hasMinMapping}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition"
              >
                Proximo: Escolher Tag
              </button>
              {!hasMinMapping && (
                <p className="text-xs text-red-500 mt-2">Mapeie pelo menos Nome e um identificador (CPF, CNS ou CPF/CNS).</p>
              )}
            </div>
          </>
        )}

        {/* Step 3: Select tag */}
        {step === 'select_tag' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Qual tag atribuir?</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Selecione a condicao/elegibilidade que sera adicionada aos pacientes encontrados.
                </p>
              </div>
              <button onClick={() => setStep('map')} className="text-xs text-gray-500 hover:text-gray-700 underline">Voltar</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {ELIGIBILITY_TAGS.map(tag => {
                const indicator = TAG_INDICATOR_MAP[tag]
                const isSelected = selectedTag === tag
                return (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(tag)}
                    className={`text-left p-4 rounded-lg border-2 transition ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-sm font-medium text-gray-900">{tag}</span>
                    {indicator && (
                      <span className="ml-2 text-xs text-gray-400">({indicator})</span>
                    )}
                  </button>
                )
              })}
            </div>

            <button
              onClick={handleMatch}
              disabled={!selectedTag}
              className="px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition"
            >
              Buscar correspondencias
            </button>
          </div>
        )}

        {/* Step 4: Matching */}
        {step === 'matching' && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-sm text-gray-600">Buscando pacientes no sistema e comparando...</p>
          </div>
        )}

        {/* Step 5: Results */}
        {step === 'results' && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-1">
                Resultado da busca — Tag: <span className="text-blue-700">{selectedTag}</span>
              </h2>
              <p className="text-xs text-gray-500 mb-4">{parsedData?.rows.length} linhas na planilha</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-700">{matched.length}</p>
                  <p className="text-xs text-green-600">Encontrados (vao receber a tag)</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-amber-700">{alreadyTagged.length}</p>
                  <p className="text-xs text-amber-600">Ja possuem a tag</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-red-700">{unmatched.length}</p>
                  <p className="text-xs text-red-600">Nao encontrados no sistema</p>
                </div>
              </div>
            </div>

            {/* Matched list */}
            {matched.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-xs font-semibold text-gray-900 mb-3">
                  Pacientes que vao receber a tag ({matched.length})
                </h3>
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <th className="text-left px-2 py-1.5 bg-gray-50 border font-medium text-gray-500">Nome</th>
                        <th className="text-left px-2 py-1.5 bg-gray-50 border font-medium text-gray-500">CPF</th>
                        <th className="text-left px-2 py-1.5 bg-gray-50 border font-medium text-gray-500">CNS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matched.slice(0, 50).map(p => (
                        <tr key={p.id}>
                          <td className="px-2 py-1.5 border text-gray-700">{p.name}</td>
                          <td className="px-2 py-1.5 border text-gray-700">{p.cpf || '-'}</td>
                          <td className="px-2 py-1.5 border text-gray-700">{p.cns || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {matched.length > 50 && (
                    <p className="text-xs text-gray-400 mt-2 px-2">... e mais {matched.length - 50} pacientes</p>
                  )}
                </div>
              </div>
            )}

            {/* Unmatched list */}
            {unmatched.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-gray-900">
                    Nao encontrados ({unmatched.length})
                  </h3>
                  <button
                    onClick={downloadUnmatched}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition"
                  >
                    Baixar como TXT
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <th className="text-left px-2 py-1.5 bg-gray-50 border font-medium text-gray-500">Linha</th>
                        <th className="text-left px-2 py-1.5 bg-gray-50 border font-medium text-gray-500">Nome</th>
                        <th className="text-left px-2 py-1.5 bg-gray-50 border font-medium text-gray-500">CPF</th>
                        <th className="text-left px-2 py-1.5 bg-gray-50 border font-medium text-gray-500">CNS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unmatched.slice(0, 30).map((u, i) => (
                        <tr key={i}>
                          <td className="px-2 py-1.5 border text-gray-500">{u.lineNumber}</td>
                          <td className="px-2 py-1.5 border text-gray-700">{u.name}</td>
                          <td className="px-2 py-1.5 border text-gray-700">{u.cpf || '-'}</td>
                          <td className="px-2 py-1.5 border text-gray-700">{u.cns || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {unmatched.length > 30 && (
                    <p className="text-xs text-gray-400 mt-2 px-2">... e mais {unmatched.length - 30}</p>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-3">
              {matched.length > 0 ? (
                <button
                  onClick={handleSaveTags}
                  className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition"
                >
                  Salvar tag &quot;{selectedTag}&quot; em {matched.length} pacientes
                </button>
              ) : (
                <p className="text-sm text-gray-500">Nenhum paciente novo para atribuir a tag.</p>
              )}
              <button onClick={handleReset} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition">
                Recomecar
              </button>
            </div>
          </div>
        )}

        {/* Step 6: Saving */}
        {step === 'saving' && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mx-auto mb-4" />
            <p className="text-sm text-gray-600">Salvando tag &quot;{selectedTag}&quot; nos pacientes...</p>
          </div>
        )}

        {/* Step 7: Done */}
        {step === 'done' && saveResult && (
          <div className="space-y-4">
            <div className={`rounded-xl border p-5 ${
              saveResult.errors.length > 0 && saveResult.saved === 0
                ? 'bg-red-50 border-red-200'
                : 'bg-green-50 border-green-200'
            }`}>
              <h2 className="text-sm font-semibold text-gray-900 mb-2">Resultado</h2>
              <p className="text-sm text-green-700 font-medium">
                Tag &quot;{selectedTag}&quot; adicionada a {saveResult.saved} pacientes
              </p>
              {alreadyTagged.length > 0 && (
                <p className="text-sm text-amber-700">{alreadyTagged.length} ja possuiam a tag</p>
              )}
              {unmatched.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <p className="text-sm text-red-700">{unmatched.length} nao encontrados</p>
                  <button
                    onClick={downloadUnmatched}
                    className="px-3 py-1 bg-white border border-red-200 text-red-700 text-xs font-medium rounded-lg hover:bg-red-50 transition"
                  >
                    Baixar TXT
                  </button>
                </div>
              )}
              {saveResult.errors.length > 0 && (
                <div className="mt-3 max-h-40 overflow-y-auto">
                  <p className="text-sm text-red-700 font-medium">{saveResult.errors.length} erros:</p>
                  {saveResult.errors.map((e, i) => (
                    <p key={i} className="text-xs text-red-600">{e}</p>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 flex gap-3">
              <Link href="/patients" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">
                Ver Pacientes
              </Link>
              <button onClick={handleReset} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition">
                Atribuir outra tag
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
