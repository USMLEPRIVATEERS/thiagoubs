import type { IndicatorResult, GoodPracticeResult } from '@/types/indicator'
import type { PatientData } from './engine'
import { isWithinPeriod, daysUntilDue, getDueDate } from '@/lib/utils/dates'
import { getClassification } from '@/lib/utils/scoring'

const ACS_CBO = '5151-05'

export function calculateC5(data: PatientData): IndicatorResult {
  const { patient, consultations, measurements, homeVisits } = data
  const isEAP = patient.team_type === 76
  const practices: GoodPracticeResult[] = []
  let totalScore = 0
  let maxScore = 100

  // A: >= 1 consulta (medico/enfermeiro) nos ultimos 180 dias (25 pts)
  const medEnfConsults = consultations
    .filter(c => c.professional_type === 'medico' || c.professional_type === 'enfermeiro' ||
      ['2231', '2251', '2252', '2253', '2235'].some(cbo => c.professional_cbo?.startsWith(cbo)))
    .sort((a, b) => b.consultation_date.localeCompare(a.consultation_date))
  const lastConsult = medEnfConsults[0]?.consultation_date || null
  const achievedA = isWithinPeriod(lastConsult, 180)
  if (achievedA) totalScore += 25
  practices.push({
    code: 'A', name: 'Consulta medico/enfermeiro (6 meses)',
    achieved: achievedA, points: achievedA ? 25 : 0, maxPoints: 25,
    lastDate: lastConsult,
    dueDate: getDueDate(lastConsult, 180),
    daysRemaining: lastConsult ? daysUntilDue(lastConsult, 180) : -1,
    details: achievedA ? 'Consulta em dia' : lastConsult ? 'Consulta vencida' : 'Nenhuma consulta registrada',
  })

  // B: >= 1 afericao PA nos ultimos 180 dias (25 pts)
  const bpRecords = measurements
    .filter(m => m.bp_systolic != null && m.bp_diastolic != null)
    .sort((a, b) => b.measurement_date.localeCompare(a.measurement_date))
  const lastBP = bpRecords[0]?.measurement_date || null
  const achievedB = isWithinPeriod(lastBP, 180)
  if (achievedB) totalScore += 25
  practices.push({
    code: 'B', name: 'Afericao de PA (6 meses)',
    achieved: achievedB, points: achievedB ? 25 : 0, maxPoints: 25,
    lastDate: lastBP,
    dueDate: getDueDate(lastBP, 180),
    daysRemaining: lastBP ? daysUntilDue(lastBP, 180) : -1,
    details: achievedB ? 'PA em dia' : lastBP ? 'PA vencida' : 'Nenhuma PA registrada',
  })

  // C: >= 1 registro simultaneo peso+altura nos ultimos 365 dias (25 pts)
  const whRecords = measurements
    .filter(m => m.weight_kg != null && m.height_cm != null)
    .sort((a, b) => b.measurement_date.localeCompare(a.measurement_date))
  const lastWH = whRecords[0]?.measurement_date || null
  const achievedC = isWithinPeriod(lastWH, 365)
  if (achievedC) totalScore += 25
  practices.push({
    code: 'C', name: 'Peso + Altura (12 meses)',
    achieved: achievedC, points: achievedC ? 25 : 0, maxPoints: 25,
    lastDate: lastWH,
    dueDate: getDueDate(lastWH, 365),
    daysRemaining: lastWH ? daysUntilDue(lastWH, 365) : -1,
    details: achievedC ? 'Peso/Altura em dia' : lastWH ? 'Peso/Altura vencido' : 'Nenhum registro peso/altura',
  })

  // D: >= 2 visitas ACS (intervalo min 30 dias) nos ultimos 365 dias (25 pts)
  if (isEAP) {
    maxScore -= 25
    practices.push({
      code: 'D', name: 'Visitas ACS (12 meses)',
      achieved: true, points: 0, maxPoints: 0,
      lastDate: null, dueDate: null, daysRemaining: null,
      details: 'Isento (equipe eAP)',
      exempt: true,
    })
  } else {
    const acsVisits = homeVisits
      .filter(v => v.visitor_cbo === ACS_CBO)
      .filter(v => isWithinPeriod(v.visit_date, 365))
      .sort((a, b) => a.visit_date.localeCompare(b.visit_date))

    let validVisits = 0
    let lastValidDate: string | null = null
    for (const visit of acsVisits) {
      if (!lastValidDate) {
        validVisits++
        lastValidDate = visit.visit_date
      } else {
        const lastDate = new Date(lastValidDate)
        const currentDate = new Date(visit.visit_date)
        const diffDays = Math.floor((currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
        if (diffDays >= 30) {
          validVisits++
          lastValidDate = visit.visit_date
        }
      }
    }

    const achievedD = validVisits >= 2
    const lastAcsVisit = acsVisits.length > 0 ? acsVisits[acsVisits.length - 1].visit_date : null
    if (achievedD) totalScore += 25
    practices.push({
      code: 'D', name: 'Visitas ACS (12 meses, min 30d intervalo)',
      achieved: achievedD, points: achievedD ? 25 : 0, maxPoints: 25,
      lastDate: lastAcsVisit,
      dueDate: getDueDate(lastAcsVisit, 365),
      daysRemaining: lastAcsVisit ? daysUntilDue(lastAcsVisit, 365) : -1,
      details: `${validVisits}/2 visitas validas`,
    })
  }

  const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0

  return {
    indicator: 'C5',
    name: 'Hipertensao',
    totalScore,
    maxScore,
    percentage,
    classification: getClassification(totalScore, maxScore),
    practices,
  }
}
