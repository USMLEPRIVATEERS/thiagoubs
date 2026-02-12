import type { IndicatorResult, GoodPracticeResult } from '@/types/indicator'
import type { PatientData } from './engine'
import { isWithinPeriod, daysUntilDue, getDueDate } from '@/lib/utils/dates'
import { getClassification } from '@/lib/utils/scoring'

const ACS_CBO = '5151-05'
const HBA1C_CODE = '02.02.01.050-3'

export function calculateC4(data: PatientData): IndicatorResult {
  const { patient, consultations, measurements, homeVisits, procedures } = data
  const isEAP = patient.team_type === 76
  const practices: GoodPracticeResult[] = []
  let totalScore = 0
  let maxScore = 100

  // A: >= 1 consulta (medico/enfermeiro) nos ultimos 180 dias (20 pts)
  const medEnfConsults = consultations
    .filter(c => c.professional_type === 'medico' || c.professional_type === 'enfermeiro' ||
      ['2231', '2251', '2252', '2253', '2235'].some(cbo => c.professional_cbo?.startsWith(cbo)))
    .sort((a, b) => b.consultation_date.localeCompare(a.consultation_date))
  const lastConsult = medEnfConsults[0]?.consultation_date || null
  const achievedA = isWithinPeriod(lastConsult, 180)
  if (achievedA) totalScore += 20
  practices.push({
    code: 'A', name: 'Consulta medico/enfermeiro (6 meses)',
    achieved: achievedA, points: achievedA ? 20 : 0, maxPoints: 20,
    lastDate: lastConsult,
    dueDate: getDueDate(lastConsult, 180),
    daysRemaining: lastConsult ? daysUntilDue(lastConsult, 180) : -1,
    details: achievedA ? 'Consulta em dia' : lastConsult ? 'Consulta vencida' : 'Nenhuma consulta registrada',
  })

  // B: >= 1 afericao PA nos ultimos 180 dias (15 pts)
  const bpRecords = measurements
    .filter(m => m.bp_systolic != null && m.bp_diastolic != null)
    .sort((a, b) => b.measurement_date.localeCompare(a.measurement_date))
  const lastBP = bpRecords[0]?.measurement_date || null
  const achievedB = isWithinPeriod(lastBP, 180)
  if (achievedB) totalScore += 15
  practices.push({
    code: 'B', name: 'Afericao de PA (6 meses)',
    achieved: achievedB, points: achievedB ? 15 : 0, maxPoints: 15,
    lastDate: lastBP,
    dueDate: getDueDate(lastBP, 180),
    daysRemaining: lastBP ? daysUntilDue(lastBP, 180) : -1,
    details: achievedB ? 'PA em dia' : lastBP ? 'PA vencida' : 'Nenhuma PA registrada',
  })

  // C: >= 1 registro simultaneo peso+altura nos ultimos 365 dias (15 pts)
  const whRecords = measurements
    .filter(m => m.weight_kg != null && m.height_cm != null)
    .sort((a, b) => b.measurement_date.localeCompare(a.measurement_date))
  const lastWH = whRecords[0]?.measurement_date || null
  const achievedC = isWithinPeriod(lastWH, 365)
  if (achievedC) totalScore += 15
  practices.push({
    code: 'C', name: 'Peso + Altura (12 meses)',
    achieved: achievedC, points: achievedC ? 15 : 0, maxPoints: 15,
    lastDate: lastWH,
    dueDate: getDueDate(lastWH, 365),
    daysRemaining: lastWH ? daysUntilDue(lastWH, 365) : -1,
    details: achievedC ? 'Peso/Altura em dia' : lastWH ? 'Peso/Altura vencido' : 'Nenhum registro peso/altura',
  })

  // D: >= 2 visitas ACS (intervalo min 30 dias) nos ultimos 365 dias (20 pts)
  if (isEAP) {
    maxScore -= 20
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
    if (achievedD) totalScore += 20
    practices.push({
      code: 'D', name: 'Visitas ACS (12 meses, min 30d intervalo)',
      achieved: achievedD, points: achievedD ? 20 : 0, maxPoints: 20,
      lastDate: lastAcsVisit,
      dueDate: getDueDate(lastAcsVisit, 365),
      daysRemaining: lastAcsVisit ? daysUntilDue(lastAcsVisit, 365) : -1,
      details: `${validVisits}/2 visitas validas`,
    })
  }

  // E: >= 1 HbA1c nos ultimos 365 dias (15 pts)
  const hba1cProcs = procedures
    .filter(p => p.procedure_code === HBA1C_CODE || p.procedure_name?.toLowerCase().includes('hemoglobina glicada') || p.procedure_name?.toLowerCase().includes('hba1c'))
    .sort((a, b) => b.procedure_date.localeCompare(a.procedure_date))
  const lastHbA1c = hba1cProcs[0]?.procedure_date || null
  const achievedE = isWithinPeriod(lastHbA1c, 365)
  if (achievedE) totalScore += 15
  practices.push({
    code: 'E', name: 'Hemoglobina Glicada - HbA1c (12 meses)',
    achieved: achievedE, points: achievedE ? 15 : 0, maxPoints: 15,
    lastDate: lastHbA1c,
    dueDate: getDueDate(lastHbA1c, 365),
    daysRemaining: lastHbA1c ? daysUntilDue(lastHbA1c, 365) : -1,
    details: achievedE
      ? `HbA1c em dia${hba1cProcs[0]?.result_value ? ` (${hba1cProcs[0].result_value})` : ''}`
      : lastHbA1c ? 'HbA1c vencida' : 'Nenhuma HbA1c registrada',
  })

  // F: >= 1 exame do pe nos ultimos 365 dias (15 pts)
  const footExams = procedures
    .filter(p => p.procedure_name?.toLowerCase().includes('exame do pe') || p.procedure_name?.toLowerCase().includes('pe diabetico'))
    .sort((a, b) => b.procedure_date.localeCompare(a.procedure_date))
  const lastFoot = footExams[0]?.procedure_date || null
  const achievedF = isWithinPeriod(lastFoot, 365)
  if (achievedF) totalScore += 15
  practices.push({
    code: 'F', name: 'Exame do Pe (12 meses)',
    achieved: achievedF, points: achievedF ? 15 : 0, maxPoints: 15,
    lastDate: lastFoot,
    dueDate: getDueDate(lastFoot, 365),
    daysRemaining: lastFoot ? daysUntilDue(lastFoot, 365) : -1,
    details: achievedF ? 'Exame do pe em dia' : lastFoot ? 'Exame do pe vencido' : 'Nenhum exame do pe registrado',
  })

  const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0

  return {
    indicator: 'C4',
    name: 'Diabetes',
    totalScore,
    maxScore,
    percentage,
    classification: getClassification(totalScore, maxScore),
    practices,
  }
}
