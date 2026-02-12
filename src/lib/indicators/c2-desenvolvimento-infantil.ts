import type { IndicatorResult, GoodPracticeResult } from '@/types/indicator'
import type { PatientData } from './engine'
import { daysSince } from '@/lib/utils/dates'
import { getClassification } from '@/lib/utils/scoring'

const ACS_CBO = '515105'
const TACS_CBO = '322255'

// CBOs medico/enfermeiro
function isMedEnf(cbo?: string, type?: string): boolean {
  if (cbo) {
    return ['2231', '2251', '2252', '2253', '2235'].some(prefix => cbo.startsWith(prefix))
  }
  return type === 'medico' || type === 'enfermeiro'
}

// Codigos de vacinas conforme e-SUS/SIGTAP
// Penta (DTP+HB+Hib) - 3 doses
const PENTA_CODES = ['09', '17', '29', '39', '42', '43', '46', '47', '58']
// VIP/Polio inativada - 3 doses
const VIP_CODES = ['22', '29', '43', '58']
// Triplice Viral / SCR / SCRV - 2 doses (nao considerar antes de 12 meses)
const SCR_CODES = ['24', '56']
// Pneumo 10V - 2 doses
const PNEUMO_CODES = ['26', '59', '106', '107']

function countVaccineDoses(vaccinations: { vaccine_code: string; vaccine_name?: string; dose_date: string }[], codes: string[], namePatterns: string[], minAgeDays?: number, dob?: string): number {
  return vaccinations.filter(v => {
    // Check age restriction (e.g. SCR must be after 12 months)
    if (minAgeDays != null && dob) {
      const birthDate = new Date(dob)
      const doseDate = new Date(v.dose_date)
      const ageDaysAtDose = Math.floor((doseDate.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24))
      if (ageDaysAtDose < minAgeDays) return false
    }
    if (codes.includes(v.vaccine_code)) return true
    const name = (v.vaccine_name || '').toLowerCase()
    return namePatterns.some(p => name.includes(p))
  }).length
}

export function calculateC2(data: PatientData): IndicatorResult {
  const { patient, consultations, measurements, homeVisits, vaccinations } = data
  const isEAP = patient.team_type === 76
  const practices: GoodPracticeResult[] = []
  let totalScore = 0
  let maxScore = 100

  const dayOfBirth = patient.date_of_birth
  const childAgeDays = daysSince(dayOfBirth)

  // A: 1a consulta ate o 30o dia de vida (20 pts)
  const first30DaysConsults = consultations.filter(c => {
    const consultDays = daysSince(c.consultation_date)
    if (consultDays === null || childAgeDays === null) return false
    const consultChildAge = childAgeDays - consultDays
    return consultChildAge <= 30 && consultChildAge >= 0 && isMedEnf(c.professional_cbo, c.professional_type)
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
  const medEnfConsults = consultations.filter(c => isMedEnf(c.professional_cbo, c.professional_type))
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
    const normCbo = (cbo: string) => cbo.replace(/[-.\s]/g, '')
    const acsVisits = homeVisits.filter(v => {
      const cbo = normCbo(v.visitor_cbo || '')
      return cbo === ACS_CBO || cbo === TACS_CBO
    })
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

  // E: Vacinacao completa - Penta(3), VIP(3), SCR(2 apos 12m), Pneumo 10V(2) (20 pts)
  const pentaDoses = countVaccineDoses(vaccinations, PENTA_CODES, ['penta', 'dtp', 'pentavalente'])
  const vipDoses = countVaccineDoses(vaccinations, VIP_CODES, ['vip', 'polio inativada', 'salk'])
  // SCR: 2 doses, nao considerar doses antes de 12 meses de vida (365 dias)
  const scrDoses = countVaccineDoses(vaccinations, SCR_CODES, ['triplice viral', 'scr', 'sarampo', 'scrv'], 365, dayOfBirth)
  const pneumoDoses = countVaccineDoses(vaccinations, PNEUMO_CODES, ['pneumo', 'pneumococica'])

  const pentaOk = pentaDoses >= 3
  const vipOk = vipDoses >= 3
  const scrOk = scrDoses >= 2
  const pneumoOk = pneumoDoses >= 2
  const achievedE = pentaOk && vipOk && scrOk && pneumoOk

  if (achievedE) totalScore += 20
  const vaccineDetails: string[] = []
  vaccineDetails.push(`Penta ${pentaDoses}/3${pentaOk ? ' OK' : ''}`)
  vaccineDetails.push(`VIP ${vipDoses}/3${vipOk ? ' OK' : ''}`)
  vaccineDetails.push(`SCR ${scrDoses}/2${scrOk ? ' OK' : ''}`)
  vaccineDetails.push(`Pneumo ${pneumoDoses}/2${pneumoOk ? ' OK' : ''}`)

  practices.push({
    code: 'E',
    name: 'Vacinacao completa (Penta+VIP+SCR+Pneumo)',
    achieved: achievedE,
    points: achievedE ? 20 : 0,
    maxPoints: 20,
    lastDate: vaccinations.length > 0
      ? vaccinations.sort((a, b) => b.dose_date.localeCompare(a.dose_date))[0].dose_date
      : null,
    dueDate: null,
    daysRemaining: null,
    details: vaccineDetails.join(' | '),
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
