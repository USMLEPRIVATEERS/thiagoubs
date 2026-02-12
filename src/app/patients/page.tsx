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
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('patients')
        .select('*')
        .eq('status', 'active')
        .order('name')
      setPatients((data as Patient[]) || [])
      setLoading(false)
    }
    load()
  }, [supabase])

  const microAreas = [...new Set(patients.map(p => p.micro_area).filter(Boolean) as number[])].sort()

  const filtered = patients.filter(p => {
    const matchesSearch = search === '' || p.name.toLowerCase().includes(search.toLowerCase()) || p.cpf?.includes(search)
    const matchesMA = filterMA === 'all' || p.micro_area === Number(filterMA)
    return matchesSearch && matchesMA
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pacientes</h1>
            <p className="text-sm text-gray-500">{filtered.length} pacientes ativos</p>
          </div>
        </div>

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
            <p className="text-sm text-gray-400 mt-1">Importe dados CSV para adicionar pacientes.</p>
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
