import type { IndicatorResult, GoodPracticeResult } from '@/types/indicator'
import type { PatientData } from './engine'
import { gestationalWeeks, daysSince } from '@/lib/utils/dates'
import { getClassification } from '@/lib/utils/scoring'

const ACS_CBO = '5151-05'
const TACS_CBO = '3222-55'
const DENTIST_CBOS = ['2232', '3224'] // 2232=Dentista, 3224=TSB

export function calculateC3(data: PatientData): IndicatorResult {
  const { patient, consultations, measurements, homeVisits, vaccinations, procedures, pregnancies } = data
  const isEAP = patient.team_type === 76
  const practices: GoodPracticeResult[] = []
  let totalScore = 0
  let maxScore = 100

  const pregnancy = pregnancies.find(p => p.outcome === 'em_andamento') || pregnancies[0]
  if (!pregnancy) {
    return {
      indicator: 'C3',
      name: 'Gestacao e Puerperio',
      totalScore: 0,
      maxScore,
      percentage: 0,
      classification: 'regular',
      practices: [],
    }
  }

  const dumWeeks = pregnancy.dum ? gestationalWeeks(pregnancy.dum) : null

  // A: 1a consulta pre-natal ate 12a semana (10 pts)
  const firstPrenatal = pregnancy.first_prenatal_date
  let achievedA = false
  if (firstPrenatal && pregnancy.dum) {
    const dumDate = new Date(pregnancy.dum)
    const prenatalDate = new Date(firstPrenatal)
    const weeksDiff = Math.floor((prenatalDate.getTime() - dumDate.getTime()) / (7 * 24 * 60 * 60 * 1000))
    achievedA = weeksDiff <= 12
  }
  if (achievedA) totalScore += 10
  practices.push({
    code: 'A', name: '1a consulta pre-natal ate 12a semana',
    achieved: achievedA, points: achievedA ? 10 : 0, maxPoints: 10,
    lastDate: firstPrenatal || null, dueDate: null, daysRemaining: null,
    details: achievedA ? 'Pre-natal iniciado no 1o trimestre' : 'Pre-natal nao iniciado ate 12a semana',
  })

  // B: >= 7 consultas pre-natal (9 pts)
  const prenatalConsults = consultations.filter(c =>
    c.professional_type === 'medico' || c.professional_type === 'enfermeiro'
  )
  const achievedB = prenatalConsults.length >= 7
  if (achievedB) totalScore += 9
  practices.push({
    code: 'B', name: '>=7 consultas pre-natal',
    achieved: achievedB, points: achievedB ? 9 : 0, maxPoints: 9,
    lastDate: prenatalConsults.length > 0 ? prenatalConsults.sort((a, b) => b.consultation_date.localeCompare(a.consultation_date))[0].consultation_date : null,
    dueDate: null, daysRemaining: null,
    details: `${prenatalConsults.length}/7 consultas pre-natal`,
  })

  // C: >= 7 afericoes PA (9 pts)
  const bpRecords = measurements.filter(m => m.bp_systolic != null && m.bp_diastolic != null)
  const achievedC = bpRecords.length >= 7
  if (achievedC) totalScore += 9
  practices.push({
    code: 'C', name: '>=7 afericoes de PA',
    achieved: achievedC, points: achievedC ? 9 : 0, maxPoints: 9,
    lastDate: bpRecords.length > 0 ? bpRecords.sort((a, b) => b.measurement_date.localeCompare(a.measurement_date))[0].measurement_date : null,
    dueDate: null, daysRemaining: null,
    details: `${bpRecords.length}/7 afericoes de PA`,
  })

  // D: >= 7 registros simultaneos peso+altura (9 pts)
  const whRecords = measurements.filter(m => m.weight_kg != null && m.height_cm != null)
  const achievedD = whRecords.length >= 7
  if (achievedD) totalScore += 9
  practices.push({
    code: 'D', name: '>=7 registros peso+altura',
    achieved: achievedD, points: achievedD ? 9 : 0, maxPoints: 9,
    lastDate: whRecords.length > 0 ? whRecords.sort((a, b) => b.measurement_date.localeCompare(a.measurement_date))[0].measurement_date : null,
    dueDate: null, daysRemaining: null,
    details: `${whRecords.length}/7 registros peso+altura`,
  })

  // E: >= 3 visitas ACS/TACS apos 1o pre-natal (9 pts) — Isento eAP
  if (isEAP) {
    maxScore -= 9
    practices.push({
      code: 'E', name: '>=3 visitas ACS',
      achieved: true, points: 0, maxPoints: 0,
      lastDate: null, dueDate: null, daysRemaining: null,
      details: 'Isento (equipe eAP)', exempt: true,
    })
  } else {
  const acsVisits = homeVisits.filter(v => v.visitor_cbo === ACS_CBO || v.visitor_cbo === TACS_CBO)
  const achievedE = acsVisits.length >= 3
  if (achievedE) totalScore += 9
  practices.push({
    code: 'E', name: '>=3 visitas ACS/TACS',
    achieved: achievedE, points: achievedE ? 9 : 0, maxPoints: 9,
    lastDate: acsVisits.length > 0 ? acsVisits.sort((a, b) => b.visit_date.localeCompare(a.visit_date))[0].visit_date : null,
    dueDate: null, daysRemaining: null,
    details: `${acsVisits.length}/3 visitas ACS`,
  })
  }

  // F: Vacina dTpa apos 20a semana (9 pts)
  const dtpaVaccines = vaccinations.filter(v => v.vaccine_name?.toLowerCase().includes('dtpa') || v.vaccine_code?.toLowerCase().includes('dtpa'))
  const achievedF = dtpaVaccines.length >= 1
  if (achievedF) totalScore += 9
  practices.push({
    code: 'F', name: 'Vacina dTpa apos 20a semana',
    achieved: achievedF, points: achievedF ? 9 : 0, maxPoints: 9,
    lastDate: dtpaVaccines.length > 0 ? dtpaVaccines[0].dose_date : null,
    dueDate: null, daysRemaining: dumWeeks !== null && dumWeeks < 20 ? null : null,
    details: achievedF ? 'dTpa aplicada' : 'dTpa pendente',
  })

  // G: Testes rapidos 1o trimestre (9 pts)
  const firstTrimesterTests = procedures.filter(p =>
    ['sifilis', 'hiv', 'hepatite b', 'hepatite c', 'hepb', 'hepc'].some(t => p.procedure_name?.toLowerCase().includes(t))
  )
  const achievedG = firstTrimesterTests.length >= 4
  if (achievedG) totalScore += 9
  practices.push({
    code: 'G', name: 'Testes rapidos 1o trimestre',
    achieved: achievedG, points: achievedG ? 9 : 0, maxPoints: 9,
    lastDate: firstTrimesterTests.length > 0 ? firstTrimesterTests.sort((a, b) => b.procedure_date.localeCompare(a.procedure_date))[0].procedure_date : null,
    dueDate: null, daysRemaining: null,
    details: `${firstTrimesterTests.length} testes realizados no 1o trimestre`,
  })

  // H: Testes rapidos 3o trimestre (9 pts)
  const achievedH = false // Requires trimester filtering
  practices.push({
    code: 'H', name: 'Testes rapidos 3o trimestre',
    achieved: achievedH, points: achievedH ? 9 : 0, maxPoints: 9,
    lastDate: null, dueDate: null, daysRemaining: null,
    details: 'Testes do 3o trimestre pendentes de verificacao',
  })

  // I: >= 1 consulta puerperal (9 pts)
  const achievedI = false // Requires postpartum identification
  practices.push({
    code: 'I', name: '>=1 consulta puerperal',
    achieved: achievedI, points: achievedI ? 9 : 0, maxPoints: 9,
    lastDate: null, dueDate: null, daysRemaining: null,
    details: 'Consulta puerperal pendente',
  })

  // J: >= 1 visita ACS no puerperio (9 pts) — Isento eAP
  if (isEAP) {
    maxScore -= 9
    practices.push({
      code: 'J', name: '>=1 visita ACS no puerperio',
      achieved: true, points: 0, maxPoints: 0,
      lastDate: null, dueDate: null, daysRemaining: null,
      details: 'Isento (equipe eAP)', exempt: true,
    })
  } else {
    const achievedJ = false // Requires postpartum identification
    practices.push({
      code: 'J', name: '>=1 visita ACS/TACS no puerperio',
      achieved: achievedJ, points: achievedJ ? 9 : 0, maxPoints: 9,
      lastDate: null, dueDate: null, daysRemaining: null,
      details: 'Visita ACS puerperal pendente',
    })
  }

  // K: >= 1 atividade odontologica (9 pts)
  const dentistConsults = consultations.filter(c =>
    c.professional_type === 'dentista' || DENTIST_CBOS.some(cbo => c.professional_cbo?.startsWith(cbo))
  )
  const achievedK = dentistConsults.length >= 1
  if (achievedK) totalScore += 9
  practices.push({
    code: 'K', name: '>=1 atividade odontologica',
    achieved: achievedK, points: achievedK ? 9 : 0, maxPoints: 9,
    lastDate: dentistConsults.length > 0 ? dentistConsults[0].consultation_date : null,
    dueDate: null, daysRemaining: null,
    details: achievedK ? 'Atendimento odontologico realizado' : 'Atendimento odontologico pendente',
  })

  const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0

  return {
    indicator: 'C3',
    name: 'Gestacao e Puerperio',
    totalScore,
    maxScore,
    percentage,
    classification: getClassification(totalScore, maxScore),
    practices,
  }
}
