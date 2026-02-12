'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/ui/Navbar'
import type { Patient } from '@/types/database'
import { ageInYears } from '@/lib/utils/dates'

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterMA, setFilterMA] = useState<string>('all')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    date_of_birth: '',
    sex: 'M' as 'M' | 'F',
    cpf: '',
    cns: '',
    micro_area: '',
    team_type: '70' as '70' | '76',
  })
  const supabase = createClient()

  async function loadPatients() {
    const { data } = await supabase
      .from('patients')
      .select('*')
      .eq('status', 'active')
      .order('name')
    setPatients((data as Patient[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    loadPatients()
  }, [supabase])

  const microAreas = [...new Set(patients.map(p => p.micro_area).filter(Boolean) as number[])].sort()

  const filtered = patients.filter(p => {
    const matchesSearch = search === '' || p.name.toLowerCase().includes(search.toLowerCase()) || p.cpf?.includes(search)
    const matchesMA = filterMA === 'all' || p.micro_area === Number(filterMA)
    return matchesSearch && matchesMA
  })

  async function handleAddPatient(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)

    const { error } = await supabase.from('patients').insert({
      name: form.name.trim(),
      date_of_birth: form.date_of_birth,
      sex: form.sex,
      cpf: form.cpf.replace(/\D/g, '') || null,
      cns: form.cns.trim() || null,
      micro_area: form.micro_area ? Number(form.micro_area) : null,
      team_type: Number(form.team_type),
      status: 'active',
    })

    if (error) {
      setFormError(error.message)
      setSaving(false)
      return
    }

    setForm({ name: '', date_of_birth: '', sex: 'M', cpf: '', cns: '', micro_area: '', team_type: '70' })
    setShowForm(false)
    setSaving(false)
    await loadPatients()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pacientes</h1>
            <p className="text-sm text-gray-500">{filtered.length} pacientes ativos</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
          >
            {showForm ? 'Cancelar' : '+ Adicionar Paciente'}
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Novo Paciente</h2>
            <form onSubmit={handleAddPatient} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Nome completo"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento *</label>
                <input
                  type="date"
                  required
                  value={form.date_of_birth}
                  onChange={e => setForm({ ...form, date_of_birth: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sexo *</label>
                <select
                  value={form.sex}
                  onChange={e => setForm({ ...form, sex: e.target.value as 'M' | 'F' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                <input
                  type="text"
                  value={form.cpf}
                  onChange={e => setForm({ ...form, cpf: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="000.000.000-00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CNS</label>
                <input
                  type="text"
                  value={form.cns}
                  onChange={e => setForm({ ...form, cns: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Cartao Nacional de Saude"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Microarea</label>
                <input
                  type="number"
                  value={form.micro_area}
                  onChange={e => setForm({ ...form, micro_area: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Ex: 1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Equipe</label>
                <select
                  value={form.team_type}
                  onChange={e => setForm({ ...form, team_type: e.target.value as '70' | '76' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="70">eSF (70)</option>
                  <option value="76">eAP (76)</option>
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-2 flex items-end gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-medium rounded-lg transition"
                >
                  {saving ? 'Salvando...' : 'Salvar Paciente'}
                </button>
                {formError && <span className="text-sm text-red-600">{formError}</span>}
              </div>
            </form>
          </div>
        )}

        <div className="flex gap-3 mb-6">
          <input
            type="text"
            placeholder="Buscar por nome ou CPF..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <select
            value={filterMA}
            onChange={(e) => setFilterMA(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            <option value="all">Todas microareas</option>
            {microAreas.map(ma => (
              <option key={ma} value={ma}>Microarea {ma}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500">Nenhum paciente encontrado.</p>
            <p className="text-sm text-gray-400 mt-1">Clique em &quot;+ Adicionar Paciente&quot; ou importe dados CSV.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Nome</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Idade</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Sexo</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">CPF</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Microarea</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Equipe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <Link href={`/patients/${p.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{ageInYears(p.date_of_birth)}a</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{p.sex}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 font-mono">{p.cpf || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{p.micro_area || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{p.team_type === 70 ? 'eSF' : 'eAP'}</td>
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
