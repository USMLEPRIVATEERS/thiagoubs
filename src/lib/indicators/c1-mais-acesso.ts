import type { IndicatorResult, GoodPracticeResult } from '@/types/indicator'
import type { PatientData } from './engine'
import { getC1Classification } from '@/lib/utils/scoring'

// CBOs validos para C1 (medico e enfermeiro da APS)
const VALID_CBOS = [
  '2251-42', // Medico de Familia
  '2251-70', // Medico Generalista
  '2251-30', // Medico Clinico
  '2235-65', // Enfermeiro da ESF
  '2235-05', // Enfermeiro Geral
]

function isValidC1Professional(cbo?: string, professionalType?: string): boolean {
  if (cbo) {
    return VALID_CBOS.some(valid => cbo.startsWith(valid.replace('-', '')))
  }
  // Fallback: aceita medico/enfermeiro se CBO nao informado
  return professionalType === 'medico' || professionalType === 'enfermeiro'
}

export function calculateC1(data: PatientData): IndicatorResult {
  const { consultations } = data

  // Filtra apenas consultas de medico/enfermeiro com CBO valido
  const validConsultations = consultations.filter(c =>
    isValidC1Professional(c.professional_cbo, c.professional_type)
  )

  const totalConsultas = validConsultations.length
  const programadas = validConsultations.filter(c => c.demand_type === 'programada').length
  const espontaneas = totalConsultas - programadas
  const pctProgramada = totalConsultas > 0 ? (programadas / totalConsultas) * 100 : 0

  const classification = getC1Classification(pctProgramada)

  const practice: GoodPracticeResult = {
    code: 'A',
    name: 'Proporcao de demanda programada',
    achieved: classification === 'otimo',
    points: pctProgramada,
    maxPoints: 100,
    lastDate: validConsultations.length > 0
      ? validConsultations.sort((a, b) => b.consultation_date.localeCompare(a.consultation_date))[0].consultation_date
      : null,
    dueDate: null,
    daysRemaining: null,
    details: `${programadas} programadas / ${espontaneas} espontaneas / ${totalConsultas} total (${pctProgramada.toFixed(1)}%)`,
  }

  return {
    indicator: 'C1',
    name: 'Mais Acesso',
    totalScore: pctProgramada,
    maxScore: 100,
    percentage: pctProgramada,
    classification,
    practices: [practice],
  }
}
