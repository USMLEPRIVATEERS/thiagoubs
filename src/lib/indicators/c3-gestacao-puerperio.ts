import type { IndicatorResult, GoodPracticeResult } from '@/types/indicator'
import type { PatientData } from './engine'
// gestational weeks calculated locally relative to DUM
import { getClassification } from '@/lib/utils/scoring'

const ACS_CBO = '515105'
const TACS_CBO = '322255'
const DENTIST_CBOS = ['2232', '3224'] // 2232=Dentista, 3224=TSB

function isMedEnf(cbo?: string, type?: string): boolean {
  if (cbo) {
    return ['2231', '2251', '2252', '2253', '2235'].some(prefix => cbo.startsWith(prefix))
  }
  return type === 'medico' || type === 'enfermeiro'
}

function isAcsTacs(cbo: string): boolean {
  const norm = cbo.replace(/[-.\s]/g, '')
  return norm === ACS_CBO || norm === TACS_CBO
}

function isDentist(cbo?: string, type?: string): boolean {
  if (cbo) {
    return DENTIST_CBOS.some(prefix => cbo.startsWith(prefix))
  }
  return type === 'dentista'
}

// Codigos SIGTAP para testes rapidos
const SIFILIS_CODES = ['02.14.01.007-0', '02.02.03.117-9']
const HIV_CODES = ['02.14.01.005-4', '02.02.03.030-0']
const HEPB_CODES = ['02.14.01.006-2', '02.02.03.070-9']
const HEPC_CODES = ['02.14.01.008-9', '02.02.03.069-5']

function hasSifilis(procedureCode: string, procedureName?: string): boolean {
  if (SIFILIS_CODES.includes(procedureCode)) return true
  const name = (procedureName || '').toLowerCase()
  return name.includes('sifilis') || name.includes('sífilis') || name.includes('vdrl') || name.includes('treponema')
}

function hasHIV(procedureCode: string, procedureName?: string): boolean {
  if (HIV_CODES.includes(procedureCode)) return true
  const name = (procedureName || '').toLowerCase()
  return name.includes('hiv') || name.includes('anti-hiv')
}

function hasHepB(procedureCode: string, procedureName?: string): boolean {
  if (HEPB_CODES.includes(procedureCode)) return true
  const name = (procedureName || '').toLowerCase()
  return name.includes('hepatite b') || name.includes('hbsag') || name.includes('hepb')
}

function hasHepC(procedureCode: string, procedureName?: string): boolean {
  if (HEPC_CODES.includes(procedureCode)) return true
  const name = (procedureName || '').toLowerCase()
  return name.includes('hepatite c') || name.includes('anti-hcv') || name.includes('hepc')
}

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

  const dum = pregnancy.dum
  const deliveryDate = pregnancy.delivery_date

  // Calcula semana gestacional de um procedimento relativo a DUM
  function gestWeeksAtDate(dateStr: string): number | null {
    if (!dum) return null
    const dumDate = new Date(dum)
    const procDate = new Date(dateStr)
    const diffMs = procDate.getTime() - dumDate.getTime()
    return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000))
  }

  // Verifica se data esta no 1o trimestre (ate 12 semanas)
  function isFirstTrimester(dateStr: string): boolean {
    const weeks = gestWeeksAtDate(dateStr)
    if (weeks === null) return true // se nao tem DUM, aceita
    return weeks >= 0 && weeks <= 12
  }

  // Verifica se data esta no 3o trimestre (a partir de 28 semanas)
  function isThirdTrimester(dateStr: string): boolean {
    const weeks = gestWeeksAtDate(dateStr)
    if (weeks === null) return false
    return weeks >= 28
  }

  // Verifica se data esta no puerperio (ate 42 dias apos parto)
  function isPuerperalPeriod(dateStr: string): boolean {
    if (!deliveryDate) return false
    const delivery = new Date(deliveryDate)
    const date = new Date(dateStr)
    const diffDays = Math.floor((date.getTime() - delivery.getTime()) / (1000 * 60 * 60 * 24))
    return diffDays >= 0 && diffDays <= 42
  }

  // A: 1a consulta pre-natal ate 12a semana (10 pts)
  const firstPrenatal = pregnancy.first_prenatal_date
  let achievedA = false
  if (firstPrenatal && dum) {
    const weeks = gestWeeksAtDate(firstPrenatal)
    achievedA = weeks !== null && weeks <= 12
  }
  if (achievedA) totalScore += 10
  practices.push({
    code: 'A', name: '1a consulta pre-natal ate 12a semana',
    achieved: achievedA, points: achievedA ? 10 : 0, maxPoints: 10,
    lastDate: firstPrenatal || null, dueDate: null, daysRemaining: null,
    details: achievedA ? 'Pre-natal iniciado no 1o trimestre' : 'Pre-natal nao iniciado ate 12a semana',
  })

  // B: >= 7 consultas pre-natal medico/enfermeiro (9 pts)
  const prenatalConsults = consultations.filter(c => isMedEnf(c.professional_cbo, c.professional_type))
  const achievedB = prenatalConsults.length >= 7
  if (achievedB) totalScore += 9
  practices.push({
    code: 'B', name: '>=7 consultas pre-natal medico/enfermeiro',
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
    const acsVisits = homeVisits.filter(v => isAcsTacs(v.visitor_cbo))
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
  const dtpaVaccines = vaccinations.filter(v => {
    const name = (v.vaccine_name || '').toLowerCase()
    const code = (v.vaccine_code || '').toLowerCase()
    const isDtpa = name.includes('dtpa') || code.includes('dtpa') || name.includes('triplice bacteriana') || name.includes('difteria')
    if (!isDtpa) return false
    // Verifica se foi apos 20a semana
    if (dum) {
      const weeks = gestWeeksAtDate(v.dose_date)
      if (weeks !== null && weeks < 20) return false
    }
    return true
  })
  const achievedF = dtpaVaccines.length >= 1
  if (achievedF) totalScore += 9
  practices.push({
    code: 'F', name: 'Vacina dTpa apos 20a semana',
    achieved: achievedF, points: achievedF ? 9 : 0, maxPoints: 9,
    lastDate: dtpaVaccines.length > 0 ? dtpaVaccines[0].dose_date : null,
    dueDate: null, daysRemaining: null,
    details: achievedF ? 'dTpa aplicada' : 'dTpa pendente',
  })

  // G: Testes rapidos 1o trimestre - sifilis + HIV + HepB + HepC (9 pts)
  const firstTriProcs = procedures.filter(p => isFirstTrimester(p.procedure_date))
  const hasSifilis1 = firstTriProcs.some(p => hasSifilis(p.procedure_code, p.procedure_name))
  const hasHIV1 = firstTriProcs.some(p => hasHIV(p.procedure_code, p.procedure_name))
  const hasHepB1 = firstTriProcs.some(p => hasHepB(p.procedure_code, p.procedure_name))
  const hasHepC1 = firstTriProcs.some(p => hasHepC(p.procedure_code, p.procedure_name))
  const achievedG = hasSifilis1 && hasHIV1 && hasHepB1 && hasHepC1
  if (achievedG) totalScore += 9
  const testDetails1: string[] = []
  testDetails1.push(`Sifilis: ${hasSifilis1 ? 'OK' : 'Falta'}`)
  testDetails1.push(`HIV: ${hasHIV1 ? 'OK' : 'Falta'}`)
  testDetails1.push(`HepB: ${hasHepB1 ? 'OK' : 'Falta'}`)
  testDetails1.push(`HepC: ${hasHepC1 ? 'OK' : 'Falta'}`)
  practices.push({
    code: 'G', name: 'Testes rapidos 1o trimestre (sifilis+HIV+HepB+HepC)',
    achieved: achievedG, points: achievedG ? 9 : 0, maxPoints: 9,
    lastDate: firstTriProcs.length > 0 ? firstTriProcs.sort((a, b) => b.procedure_date.localeCompare(a.procedure_date))[0].procedure_date : null,
    dueDate: null, daysRemaining: null,
    details: testDetails1.join(' | '),
  })

  // H: Testes rapidos 3o trimestre - sifilis + HIV (9 pts)
  const thirdTriProcs = procedures.filter(p => isThirdTrimester(p.procedure_date))
  const hasSifilis3 = thirdTriProcs.some(p => hasSifilis(p.procedure_code, p.procedure_name))
  const hasHIV3 = thirdTriProcs.some(p => hasHIV(p.procedure_code, p.procedure_name))
  const achievedH = hasSifilis3 && hasHIV3
  if (achievedH) totalScore += 9
  practices.push({
    code: 'H', name: 'Testes rapidos 3o trimestre (sifilis+HIV)',
    achieved: achievedH, points: achievedH ? 9 : 0, maxPoints: 9,
    lastDate: thirdTriProcs.length > 0 ? thirdTriProcs.sort((a, b) => b.procedure_date.localeCompare(a.procedure_date))[0].procedure_date : null,
    dueDate: null, daysRemaining: null,
    details: `Sifilis: ${hasSifilis3 ? 'OK' : 'Falta'} | HIV: ${hasHIV3 ? 'OK' : 'Falta'}`,
  })

  // I: >= 1 consulta medico/enfermeiro no puerperio (ate 42 dias pos-parto) (9 pts)
  const puerperalConsults = consultations.filter(c =>
    isMedEnf(c.professional_cbo, c.professional_type) && isPuerperalPeriod(c.consultation_date)
  )
  const achievedI = puerperalConsults.length >= 1
  if (achievedI) totalScore += 9
  practices.push({
    code: 'I', name: '>=1 consulta puerperal (ate 42 dias pos-parto)',
    achieved: achievedI, points: achievedI ? 9 : 0, maxPoints: 9,
    lastDate: puerperalConsults.length > 0 ? puerperalConsults[0].consultation_date : null,
    dueDate: null, daysRemaining: null,
    details: achievedI
      ? 'Consulta puerperal realizada'
      : deliveryDate
        ? 'Consulta puerperal pendente'
        : 'Aguardando parto para verificar puerperio',
  })

  // J: >= 1 visita ACS no puerperio (ate 42 dias pos-parto) (9 pts) — Isento eAP
  if (isEAP) {
    maxScore -= 9
    practices.push({
      code: 'J', name: '>=1 visita ACS no puerperio',
      achieved: true, points: 0, maxPoints: 0,
      lastDate: null, dueDate: null, daysRemaining: null,
      details: 'Isento (equipe eAP)', exempt: true,
    })
  } else {
    const puerperalVisits = homeVisits.filter(v =>
      isAcsTacs(v.visitor_cbo) && isPuerperalPeriod(v.visit_date)
    )
    const achievedJ = puerperalVisits.length >= 1
    if (achievedJ) totalScore += 9
    practices.push({
      code: 'J', name: '>=1 visita ACS/TACS no puerperio',
      achieved: achievedJ, points: achievedJ ? 9 : 0, maxPoints: 9,
      lastDate: puerperalVisits.length > 0 ? puerperalVisits[0].visit_date : null,
      dueDate: null, daysRemaining: null,
      details: achievedJ
        ? 'Visita ACS puerperal realizada'
        : deliveryDate
          ? 'Visita ACS puerperal pendente'
          : 'Aguardando parto para verificar puerperio',
    })
  }

  // K: >= 1 atividade odontologica (9 pts)
  const dentistConsults = consultations.filter(c => isDentist(c.professional_cbo, c.professional_type))
  const achievedK = dentistConsults.length >= 1
  if (achievedK) totalScore += 9
  practices.push({
    code: 'K', name: '>=1 atendimento saude bucal (dentista/TSB)',
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
