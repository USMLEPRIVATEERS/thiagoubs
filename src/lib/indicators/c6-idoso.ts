import type { IndicatorResult, GoodPracticeResult } from '@/types/indicator'
import type { PatientData } from './engine'
import { isWithinPeriod, daysUntilDue, getDueDate } from '@/lib/utils/dates'
import { getClassification } from '@/lib/utils/scoring'

const ACS_CBO = '5151-05'

export function calculateC6(data: PatientData): IndicatorResult {
  const { patient, consultations, measurements, homeVisits, vaccinations } = data
  const isEAP = patient.team_type === 76
  const practices: GoodPracticeResult[] = []
  let totalScore = 0
  let maxScore = 100

  // A: >= 1 consulta (medico/enfermeiro) nos ultimos 365 dias (25 pts)
  const medEnfConsults = consultations
    .filter(c => c.professional_type === 'medico' || c.professional_type === 'enfermeiro' ||
      ['2231', '2251', '2252', '2253', '2235'].some(cbo => c.professional_cbo?.startsWith(cbo)))
    .sort((a, b) => b.consultation_date.localeCompare(a.consultation_date))
  const lastConsult = medEnfConsults[0]?.consultation_date || null
  const achievedA = isWithinPeriod(lastConsult, 365)
  if (achievedA) totalScore += 25
  practices.push({
    code: 'A', name: 'Consulta medico/enfermeiro (12 meses)',
    achieved: achievedA, points: achievedA ? 25 : 0, maxPoints: 25,
    lastDate: lastConsult,
    dueDate: getDueDate(lastConsult, 365),
    daysRemaining: lastConsult ? daysUntilDue(lastConsult, 365) : -1,
    details: achievedA ? 'Consulta em dia' : lastConsult ? 'Consulta vencida' : 'Nenhuma consulta registrada',
  })

  // B: >= 1 registro simultaneo peso+altura nos ultimos 365 dias (25 pts)
  const whRecords = measurements
    .filter(m => m.weight_kg != null && m.height_cm != null)
    .sort((a, b) => b.measurement_date.localeCompare(a.measurement_date))
  const lastWH = whRecords[0]?.measurement_date || null
  const achievedB = isWithinPeriod(lastWH, 365)
  if (achievedB) totalScore += 25
  practices.push({
    code: 'B', name: 'Peso + Altura (12 meses)',
    achieved: achievedB, points: achievedB ? 25 : 0, maxPoints: 25,
    lastDate: lastWH,
    dueDate: getDueDate(lastWH, 365),
    daysRemaining: lastWH ? daysUntilDue(lastWH, 365) : -1,
    details: achievedB ? 'Peso/Altura em dia' : lastWH ? 'Peso/Altura vencido' : 'Nenhum registro peso/altura',
  })

  // C: >= 2 visitas ACS (intervalo min 30 dias) nos ultimos 365 dias (25 pts)
  if (isEAP) {
    maxScore -= 25
    practices.push({
      code: 'C', name: 'Visitas ACS (12 meses)',
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

    const achievedC = validVisits >= 2
    const lastAcsVisit = acsVisits.length > 0 ? acsVisits[acsVisits.length - 1].visit_date : null
    if (achievedC) totalScore += 25
    practices.push({
      code: 'C', name: 'Visitas ACS (12 meses, min 30d intervalo)',
      achieved: achievedC, points: achievedC ? 25 : 0, maxPoints: 25,
      lastDate: lastAcsVisit,
      dueDate: getDueDate(lastAcsVisit, 365),
      daysRemaining: lastAcsVisit ? daysUntilDue(lastAcsVisit, 365) : -1,
      details: `${validVisits}/2 visitas validas`,
    })
  }

  // D: 1 dose vacina influenza nos ultimos 365 dias (25 pts)
  const fluVaccines = vaccinations
    .filter(v => v.vaccine_name?.toLowerCase().includes('influenza') || v.vaccine_name?.toLowerCase().includes('gripe'))
    .filter(v => isWithinPeriod(v.dose_date, 365))
    .sort((a, b) => b.dose_date.localeCompare(a.dose_date))
  const lastFlu = fluVaccines[0]?.dose_date || null
  const achievedD = fluVaccines.length >= 1
  if (achievedD) totalScore += 25
  practices.push({
    code: 'D', name: 'Vacina Influenza (12 meses)',
    achieved: achievedD, points: achievedD ? 25 : 0, maxPoints: 25,
    lastDate: lastFlu,
    dueDate: getDueDate(lastFlu, 365),
    daysRemaining: lastFlu ? daysUntilDue(lastFlu, 365) : -1,
    details: achievedD ? 'Vacina influenza em dia' : 'Vacina influenza pendente',
  })

  const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0

  return {
    indicator: 'C6',
    name: 'Pessoa Idosa',
    totalScore,
    maxScore,
    percentage,
    classification: getClassification(totalScore, maxScore),
    practices,
  }
}
