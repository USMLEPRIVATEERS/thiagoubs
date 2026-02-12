export interface Patient {
  id: string
  name: string
  date_of_birth: string
  sex: 'M' | 'F'
  gender_identity?: string
  cpf?: string
  cns?: string
  micro_area?: number
  team_type: 70 | 76
  tags?: string[]
  status: 'active' | 'moved' | 'deceased'
  created_at: string
  updated_at: string
}

export interface Condition {
  id: string
  patient_id: string
  code: string
  code_system: 'CID10' | 'CIAP2'
  description?: string
  status: 'active' | 'resolved'
  diagnosed_date?: string
  resolved_date?: string
  created_at: string
}

export interface Consultation {
  id: string
  patient_id: string
  professional_type: string
  professional_cbo?: string
  consultation_date: string
  modality: 'presencial' | 'remota' | 'domiciliar'
  demand_type: 'programada' | 'espontanea'
  notes?: string
  created_at: string
}

export interface Measurement {
  id: string
  patient_id: string
  measurement_date: string
  weight_kg?: number
  height_cm?: number
  bp_systolic?: number
  bp_diastolic?: number
  professional_cbo?: string
  created_at: string
}

export interface Procedure {
  id: string
  patient_id: string
  procedure_code: string
  procedure_name?: string
  procedure_date: string
  result_value?: string
  professional_cbo?: string
  created_at: string
}

export interface HomeVisit {
  id: string
  patient_id: string
  visitor_cbo: string
  visit_date: string
  visit_reason?: string
  created_at: string
}

export interface Vaccination {
  id: string
  patient_id: string
  vaccine_code: string
  vaccine_name?: string
  dose_date: string
  dose_number?: number
  created_at: string
}

export interface Pregnancy {
  id: string
  patient_id: string
  dum?: string
  dpp?: string
  delivery_date?: string
  outcome: 'em_andamento' | 'parto' | 'aborto'
  first_prenatal_date?: string
  created_at: string
}

export interface IndicatorScore {
  id: string
  patient_id: string
  indicator: IndicatorCode
  total_score: number
  max_possible_score: number
  breakdown: Record<string, GoodPracticeBreakdown>
  last_calculated: string
}

export interface GoodPracticeBreakdown {
  points: number
  maxPoints: number
  achieved: boolean
  details: string
  lastDate?: string
  dueDate?: string
  daysRemaining?: number
}

export interface CsvImport {
  id: string
  filename: string
  import_date: string
  indicator?: string
  rows_imported?: number
  status: 'processing' | 'completed' | 'error'
  error_log?: string
}

export type IndicatorCode = 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6' | 'C7'
