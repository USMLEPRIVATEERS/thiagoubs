import type { IndicatorResult, GoodPracticeResult } from '@/types/indicator'
import type { PatientData } from './engine'
import { daysSince } from '@/lib/utils/dates'
import { getClassification } from '@/lib/utils/scoring'

const ACS_CBO = '5151-05'

const TACS_CBO = '3222-55'

export function calculateC2(data: PatientData): IndicatorResult {
  const { patient, consultations, measurements, homeVisits, vaccinations } = data
  const isEAP = patient.team_type === 76
  const practices: GoodPracticeResult[] = []
  let totalScore = 0
  let maxScore = 100

  // A: 1a consulta ate o 30o dia de vida (20 pts)
  const dayOfBirth = patient.date_of_birth
  const first30DaysConsults = consultations.filter(c => {
    const days = daysSince(c.consultation_date)
    const childAgeDays = daysSince(dayOfBirth)
    if (days === null || childAgeDays === null) return false
    const consultChildAge = childAgeDays - days
    return consultChildAge <= 30 && consultChildAge >= 0 &&
      ['2231', '2251', '2252', '2253', '2235'].some(cbo => c.professional_cbo?.startsWith(cbo) || c.professional_type === 'medico' || c.professional_type === 'enfermeiro')
  })
  const achievedA = first30DaysConsults.length >= 1
  if (achievedA) totalScore += 20
  practices.push({
    code: 'A',
    name: '1a consulta ate 30 dias de vida',
    achieved: achievedA,
    points: achievedA ? 20 : 0,
    maxPoints: 20,
    lastDate: first30DaysConsults.length > 0 ? first30DaysConsults[0].consultation_date : null,
    dueDate: null,
    daysRemaining: null,
    details: achievedA ? 'Consulta realizada nos primeiros 30 dias' : 'Sem consulta nos primeiros 30 dias',
  })

  // B: >= 9 consultas (medico/enfermeiro) ate 2 anos (20 pts)
  const medEnfConsults = consultations.filter(c =>
    c.professional_type === 'medico' || c.professional_type === 'enfermeiro' ||
    ['2231', '2251', '2252', '2253', '2235'].some(cbo => c.professional_cbo?.startsWith(cbo))
  )
  const achievedB = medEnfConsults.length >= 9
  if (achievedB) totalScore += 20
  practices.push({
    code: 'B',
    name: '>=9 consultas medico/enfermeiro ate 2 anos',
    achieved: achievedB,
    points: achievedB ? 20 : 0,
    maxPoints: 20,
    lastDate: medEnfConsults.length > 0
      ? medEnfConsults.sort((a, b) => b.consultation_date.localeCompare(a.consultation_date))[0].consultation_date
      : null,
    dueDate: null,
    daysRemaining: null,
    details: `${medEnfConsults.length}/9 consultas realizadas`,
  })

  // C: >= 9 registros simultaneos peso+altura ate 2 anos (20 pts)
  const weightHeightRecords = measurements.filter(m => m.weight_kg != null && m.height_cm != null)
  const achievedC = weightHeightRecords.length >= 9
  if (achievedC) totalScore += 20
  practices.push({
    code: 'C',
    name: '>=9 registros peso+altura simultaneos',
    achieved: achievedC,
    points: achievedC ? 20 : 0,
    maxPoints: 20,
    lastDate: weightHeightRecords.length > 0
      ? weightHeightRecords.sort((a, b) => b.measurement_date.localeCompare(a.measurement_date))[0].measurement_date
      : null,
    dueDate: null,
    daysRemaining: null,
    details: `${weightHeightRecords.length}/9 registros peso+altura`,
  })

  // D: >= 2 visitas domiciliares do ACS/TACS (1a ate 30 dias, 2a ate 6 meses) (20 pts)
  // Isento para equipes eAP tipo 76
  if (isEAP) {
    maxScore -= 20
    practices.push({
      code: 'D',
      name: '>=2 visitas ACS (1a ate 30d, 2a ate 6m)',
      achieved: true, points: 0, maxPoints: 0,
      lastDate: null, dueDate: null, daysRemaining: null,
      details: 'Isento (equipe eAP)',
      exempt: true,
    })
  } else {
    const acsVisits = homeVisits.filter(v => v.visitor_cbo === ACS_CBO || v.visitor_cbo === TACS_CBO)
    const achievedD = acsVisits.length >= 2
    if (achievedD) totalScore += 20
    practices.push({
      code: 'D',
      name: '>=2 visitas ACS/TACS (1a ate 30d, 2a ate 6m)',
      achieved: achievedD,
      points: achievedD ? 20 : 0,
      maxPoints: 20,
      lastDate: acsVisits.length > 0
        ? acsVisits.sort((a, b) => b.visit_date.localeCompare(a.visit_date))[0].visit_date
        : null,
      dueDate: null,
      daysRemaining: null,
      details: `${acsVisits.length}/2 visitas ACS realizadas`,
    })
  }

  // E: Vacinacao completa (20 pts)
  const achievedE = vaccinations.length >= 6
  if (achievedE) totalScore += 20
  practices.push({
    code: 'E',
    name: 'Vacinacao completa',
    achieved: achievedE,
    points: achievedE ? 20 : 0,
    maxPoints: 20,
    lastDate: vaccinations.length > 0
      ? vaccinations.sort((a, b) => b.dose_date.localeCompare(a.dose_date))[0].dose_date
      : null,
    dueDate: null,
    daysRemaining: null,
    details: `${vaccinations.length} vacinas registradas`,
  })

  const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0

  return {
    indicator: 'C2',
    name: 'Desenvolvimento Infantil',
    totalScore,
    maxScore,
    percentage,
    classification: getClassification(totalScore, maxScore),
    practices,
  }
}
