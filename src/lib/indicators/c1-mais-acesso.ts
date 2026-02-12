import type { IndicatorResult, GoodPracticeResult } from '@/types/indicator'
import type { PatientData } from './engine'
import { getC1Classification } from '@/lib/utils/scoring'

export function calculateC1(data: PatientData): IndicatorResult {
  const { consultations } = data

  const totalConsultas = consultations.length
  const programadas = consultations.filter(c => c.demand_type === 'programada').length
  const pctProgramada = totalConsultas > 0 ? (programadas / totalConsultas) * 100 : 0

  const classification = getC1Classification(pctProgramada)

  const practice: GoodPracticeResult = {
    code: 'A',
    name: 'Proporcao de demanda programada',
    achieved: classification === 'otimo',
    points: pctProgramada,
    maxPoints: 100,
    lastDate: consultations.length > 0
      ? consultations.sort((a, b) => b.consultation_date.localeCompare(a.consultation_date))[0].consultation_date
      : null,
    dueDate: null,
    daysRemaining: null,
    details: `${programadas}/${totalConsultas} consultas programadas (${pctProgramada.toFixed(1)}%)`,
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
