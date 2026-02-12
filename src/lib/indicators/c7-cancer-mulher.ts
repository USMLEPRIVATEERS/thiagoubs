import type { IndicatorResult, GoodPracticeResult } from '@/types/indicator'
import type { PatientData } from './engine'
import { isWithinPeriod, daysUntilDue, getDueDate, ageInYears } from '@/lib/utils/dates'
import { getClassification } from '@/lib/utils/scoring'

// SIGTAP procedure codes (conforme nota tecnica oficial)
const PAPANICOLAU_CODES = [
  '02.03.01.001-9', // Exame citopatologico cervico-vaginal/microflora
  '02.03.01.008-6', // Exame citopatologico cervico vaginal/microflora-rastreamento
  '02.01.02.003-3', // Coleta de citopatologico de colo uterino
  '02.01.02.007-6', // Coleta de material do colo do utero para exame molecular HPV
  '02.01.02.008-4', // Entrega de material auto coleta para HPV
]
const MAMOGRAFIA_CODES = [
  '02.04.03.018-8', // Mamografia bilateral para rastreamento
  '02.04.03.003-0', // Mamografia
]
// HPV vaccine codes oficiais
const HPV_CODES = ['67', '93'] // 67=HPV quadrivalente, 93=HPV nonavalente

function isMedEnf(cbo?: string, type?: string): boolean {
  if (cbo) {
    return ['2231', '2251', '2252', '2253', '2235'].some(prefix => cbo.startsWith(prefix))
  }
  return type === 'medico' || type === 'enfermeiro'
}

export function calculateC7(data: PatientData): IndicatorResult {
  const { patient, consultations, procedures, vaccinations } = data
  const age = ageInYears(patient.date_of_birth)
  const practices: GoodPracticeResult[] = []
  let totalScore = 0
  let maxScore = 0

  // A: Rastreamento cancer cervical (Papanicolau) - 25-64 anos - 36 meses (20 pts)
  if (age >= 25 && age <= 64) {
    maxScore += 20
    const papProcs = procedures
      .filter(p => {
        if (PAPANICOLAU_CODES.includes(p.procedure_code)) return true
        const name = (p.procedure_name || '').toLowerCase()
        return name.includes('papanicolau') || name.includes('citopatologico') ||
          name.includes('citopatológico') || name.includes('colo uterino')
      })
      .sort((a, b) => b.procedure_date.localeCompare(a.procedure_date))
    const lastPap = papProcs[0]?.procedure_date || null
    const achievedA = isWithinPeriod(lastPap, 1095) // 36 meses
    if (achievedA) totalScore += 20
    practices.push({
      code: 'A', name: 'Papanicolau (36 meses)',
      achieved: achievedA, points: achievedA ? 20 : 0, maxPoints: 20,
      lastDate: lastPap,
      dueDate: getDueDate(lastPap, 1095),
      daysRemaining: lastPap ? daysUntilDue(lastPap, 1095) : -1,
      details: achievedA ? 'Papanicolau em dia' : lastPap ? 'Papanicolau vencido' : 'Nenhum papanicolau registrado',
    })
  }

  // B: Vacina HPV - 9-14 anos (meninas) (30 pts)
  if (age >= 9 && age <= 14 && patient.sex === 'F') {
    maxScore += 30
    const hpvVaccines = vaccinations.filter(v => {
      if (HPV_CODES.includes(v.vaccine_code)) return true
      const name = (v.vaccine_name || '').toLowerCase()
      return name.includes('hpv') || name.includes('papilomavirus')
    })
    const achievedB = hpvVaccines.length >= 1
    if (achievedB) totalScore += 30
    practices.push({
      code: 'B', name: 'Vacina HPV (9-14 anos)',
      achieved: achievedB, points: achievedB ? 30 : 0, maxPoints: 30,
      lastDate: hpvVaccines.length > 0 ? hpvVaccines.sort((a, b) => b.dose_date.localeCompare(a.dose_date))[0].dose_date : null,
      dueDate: null, daysRemaining: null,
      details: achievedB ? `${hpvVaccines.length} dose(s) HPV` : 'Vacina HPV pendente',
    })
  }

  // C: Atendimento saude sexual/reprodutiva - 14-69 anos - 12 meses (30 pts)
  if (age >= 14 && age <= 69) {
    maxScore += 30
    const srConsults = consultations
      .filter(c => isMedEnf(c.professional_cbo, c.professional_type))
      .sort((a, b) => b.consultation_date.localeCompare(a.consultation_date))
    const lastSR = srConsults[0]?.consultation_date || null
    const achievedC = isWithinPeriod(lastSR, 365)
    if (achievedC) totalScore += 30
    practices.push({
      code: 'C', name: 'Atendimento saude sexual/reprodutiva (12 meses)',
      achieved: achievedC, points: achievedC ? 30 : 0, maxPoints: 30,
      lastDate: lastSR,
      dueDate: getDueDate(lastSR, 365),
      daysRemaining: lastSR ? daysUntilDue(lastSR, 365) : -1,
      details: achievedC ? 'Consulta em dia' : lastSR ? 'Consulta vencida' : 'Nenhuma consulta registrada',
    })
  }

  // D: Mamografia - 50-69 anos - 24 meses (20 pts)
  if (age >= 50 && age <= 69) {
    maxScore += 20
    const mamProcs = procedures
      .filter(p => {
        if (MAMOGRAFIA_CODES.includes(p.procedure_code)) return true
        const name = (p.procedure_name || '').toLowerCase()
        return name.includes('mamografia') || name.includes('mamografica')
      })
      .sort((a, b) => b.procedure_date.localeCompare(a.procedure_date))
    const lastMam = mamProcs[0]?.procedure_date || null
    const achievedD = isWithinPeriod(lastMam, 730) // 24 meses
    if (achievedD) totalScore += 20
    practices.push({
      code: 'D', name: 'Mamografia (24 meses)',
      achieved: achievedD, points: achievedD ? 20 : 0, maxPoints: 20,
      lastDate: lastMam,
      dueDate: getDueDate(lastMam, 730),
      daysRemaining: lastMam ? daysUntilDue(lastMam, 730) : -1,
      details: achievedD ? 'Mamografia em dia' : lastMam ? 'Mamografia vencida' : 'Nenhuma mamografia registrada',
    })
  }

  if (maxScore === 0) maxScore = 100
  const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0

  return {
    indicator: 'C7',
    name: 'Saude da Mulher',
    totalScore,
    maxScore,
    percentage,
    classification: getClassification(totalScore, maxScore),
    practices,
  }
}
