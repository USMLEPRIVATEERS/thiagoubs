import type { Patient, Consultation, Measurement, Procedure, HomeVisit, Vaccination, Condition, Pregnancy } from '@/types/database'
import type { IndicatorResult, UrgentAction } from '@/types/indicator'
import { calculateC1 } from './c1-mais-acesso'
import { calculateC2 } from './c2-desenvolvimento-infantil'
import { calculateC3 } from './c3-gestacao-puerperio'
import { calculateC4 } from './c4-diabetes'
import { calculateC5 } from './c5-hipertensao'
import { calculateC6 } from './c6-idoso'
import { calculateC7 } from './c7-cancer-mulher'
import { ageInYears, ageInMonths } from '@/lib/utils/dates'

export interface PatientData {
  patient: Patient
  conditions: Condition[]
  consultations: Consultation[]
  measurements: Measurement[]
  procedures: Procedure[]
  homeVisits: HomeVisit[]
  vaccinations: Vaccination[]
  pregnancies: Pregnancy[]
}

const DIABETES_CID10 = /^E1[014]/
const DIABETES_CIAP2 = /^T(89|90)$/
// C5: CID-10 corrected - NOT including I16, goes up to I15.9 + O10/O11
const HYPERTENSION_CID10 = /^(I1[0-5]|O1[01])/
const HYPERTENSION_CIAP2 = /^K8[67]$/

export function getApplicableIndicators(data: PatientData): string[] {
  const { patient, conditions, pregnancies } = data
  const indicators: string[] = []
  const age = ageInYears(patient.date_of_birth)
  const ageMonths = ageInMonths(patient.date_of_birth)

  // C1 - All patients
  indicators.push('C1')

  // C2 - Children 0-24 months
  if (ageMonths <= 24) {
    indicators.push('C2')
  }

  // C3 - Pregnant or postpartum
  const activePregnancy = pregnancies.find(p => p.outcome === 'em_andamento')
  if (activePregnancy) {
    indicators.push('C3')
  }

  // C4 - Diabetes
  const hasDiabetes = conditions.some(
    c => c.status === 'active' && (
      (c.code_system === 'CID10' && DIABETES_CID10.test(c.code)) ||
      (c.code_system === 'CIAP2' && DIABETES_CIAP2.test(c.code))
    )
  )
  if (hasDiabetes) indicators.push('C4')

  // C5 - Hypertension
  const hasHypertension = conditions.some(
    c => c.status === 'active' && (
      (c.code_system === 'CID10' && HYPERTENSION_CID10.test(c.code)) ||
      (c.code_system === 'CIAP2' && HYPERTENSION_CIAP2.test(c.code))
    )
  )
  if (hasHypertension) indicators.push('C5')

  // C6 - Age 60+
  if (age >= 60) indicators.push('C6')

  // C7 - Women + trans men, 9-69 years
  // EXCLUSION: Female with gender_identity "mulher transgenero" is NOT included
  const isEligibleC7 = (
    (patient.sex === 'F' && patient.gender_identity !== 'mulher transgenero') ||
    (patient.sex === 'M' && patient.gender_identity === 'homem trans')
  ) && age >= 9 && age <= 69
  if (isEligibleC7) indicators.push('C7')

  return indicators
}

export function calculateAllIndicators(data: PatientData): IndicatorResult[] {
  const applicable = getApplicableIndicators(data)
  const results: IndicatorResult[] = []

  for (const code of applicable) {
    switch (code) {
      case 'C1': results.push(calculateC1(data)); break
      case 'C2': results.push(calculateC2(data)); break
      case 'C3': results.push(calculateC3(data)); break
      case 'C4': results.push(calculateC4(data)); break
      case 'C5': results.push(calculateC5(data)); break
      case 'C6': results.push(calculateC6(data)); break
      case 'C7': results.push(calculateC7(data)); break
    }
  }

  return results
}

export function getUrgentActions(data: PatientData): UrgentAction[] {
  const results = calculateAllIndicators(data)
  const actions: UrgentAction[] = []

  for (const result of results) {
    for (const practice of result.practices) {
      if (practice.exempt) continue

      if (practice.daysRemaining !== null && practice.daysRemaining < 0 && !practice.achieved) {
        actions.push({
          patientId: data.patient.id,
          patientName: data.patient.name,
          microArea: data.patient.micro_area,
          indicator: result.indicator,
          practiceCode: practice.code,
          practiceName: practice.name,
          daysOverdue: Math.abs(practice.daysRemaining),
          type: 'vencido',
        })
      } else if (practice.daysRemaining !== null && practice.daysRemaining >= 0 && practice.daysRemaining <= 30 && !practice.achieved) {
        actions.push({
          patientId: data.patient.id,
          patientName: data.patient.name,
          microArea: data.patient.micro_area,
          indicator: result.indicator,
          practiceCode: practice.code,
          practiceName: practice.name,
          daysUntilDue: practice.daysRemaining,
          type: 'vencendo',
        })
      }
    }
  }

  return actions.sort((a, b) => {
    if (a.type === 'vencido' && b.type !== 'vencido') return -1
    if (a.type !== 'vencido' && b.type === 'vencido') return 1
    if (a.type === 'vencido' && b.type === 'vencido') {
      return (b.daysOverdue || 0) - (a.daysOverdue || 0)
    }
    return (a.daysUntilDue || 0) - (b.daysUntilDue || 0)
  })
}
