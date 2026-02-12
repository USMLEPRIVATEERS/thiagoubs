import type { IndicatorResult, GoodPracticeResult } from '@/types/indicator'
import type { PatientData } from './engine'
import { isWithinPeriod, daysUntilDue, getDueDate, ageInYears } from '@/lib/utils/dates'
import { getClassification } from '@/lib/utils/scoring'

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
      .filter(p =>
        p.procedure_name?.toLowerCase().includes('papanicolau') ||
        p.procedure_name?.toLowerCase().includes('citopatologico') ||
        p.procedure_name?.toLowerCase().includes('colo')
      )
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
    const hpvVaccines = vaccinations
      .filter(v => v.vaccine_name?.toLowerCase().includes('hpv'))
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

  // C: Consulta saude sexual/reprodutiva - 14-69 anos - 12 meses (30 pts)
  if (age >= 14 && age <= 69) {
    maxScore += 30
    const srConsults = consultations
      .filter(c =>
        c.professional_type === 'medico' || c.professional_type === 'enfermeiro'
      )
      .sort((a, b) => b.consultation_date.localeCompare(a.consultation_date))
    const lastSR = srConsults[0]?.consultation_date || null
    const achievedC = isWithinPeriod(lastSR, 365)
    if (achievedC) totalScore += 30
    practices.push({
      code: 'C', name: 'Consulta saude sexual/reprodutiva (12 meses)',
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
      .filter(p =>
        p.procedure_name?.toLowerCase().includes('mamografia') ||
        p.procedure_name?.toLowerCase().includes('mama')
      )
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
