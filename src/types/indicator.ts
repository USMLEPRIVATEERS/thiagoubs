export interface GoodPracticeResult {
  code: string
  name: string
  achieved: boolean
  points: number
  maxPoints: number
  lastDate: string | null
  dueDate: string | null
  daysRemaining: number | null
  details: string
  exempt?: boolean
}

export type Classification = 'otimo' | 'bom' | 'suficiente' | 'regular'

export interface IndicatorResult {
  indicator: string
  name: string
  totalScore: number
  maxScore: number
  percentage: number
  classification: Classification
  practices: GoodPracticeResult[]
}

export interface IndicatorSummary {
  code: string
  name: string
  description: string
  totalPatients: number
  avgScore: number
  classification: Classification
  counts: {
    otimo: number
    bom: number
    suficiente: number
    regular: number
  }
}

export interface UrgentAction {
  patientId: string
  patientName: string
  microArea?: string | number
  indicator: string
  practiceCode: string
  practiceName: string
  daysOverdue?: number
  daysUntilDue?: number
  type: 'vencido' | 'vencendo'
}

export const INDICATOR_NAMES: Record<string, string> = {
  C1: 'Mais Acesso',
  C2: 'Desenvolvimento Infantil',
  C3: 'Gestacao e Puerperio',
  C4: 'Diabetes',
  C5: 'Hipertensao',
  C6: 'Pessoa Idosa',
  C7: 'Saude da Mulher',
}

export const INDICATOR_DESCRIPTIONS: Record<string, string> = {
  C1: 'Acesso a Atencao Primaria - Demanda programada vs. espontanea',
  C2: 'Cuidado no Desenvolvimento Infantil (0-24 meses)',
  C3: 'Cuidado na Gestacao e Puerperio',
  C4: 'Cuidado da Pessoa com Diabetes',
  C5: 'Cuidado da Pessoa com Hipertensao',
  C6: 'Cuidado da Pessoa Idosa (60+ anos)',
  C7: 'Prevencao do Cancer na Mulher',
}
