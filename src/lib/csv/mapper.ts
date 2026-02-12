export interface ColumnMapping {
  [systemField: string]: string // systemField -> csvColumn
}

export const PATIENT_FIELDS = [
  { key: 'name', label: 'Nome', required: true },
  { key: 'date_of_birth', label: 'Data de Nascimento', required: true },
  { key: 'sex', label: 'Sexo (M/F)', required: false },
  { key: 'cpf_or_cns', label: 'CPF ou CNS (auto-detecta)', required: false },
  { key: 'cpf', label: 'CPF (coluna separada)', required: false },
  { key: 'cns', label: 'CNS (coluna separada)', required: false },
  { key: 'micro_area', label: 'Microarea', required: false },
  { key: 'team_type', label: 'Tipo de Equipe (70/76)', required: false },
]

export const CONSULTATION_FIELDS = [
  { key: 'patient_cpf', label: 'CPF do Paciente', required: true },
  { key: 'patient_name', label: 'Nome do Paciente', required: false },
  { key: 'professional_type', label: 'Tipo Profissional', required: false },
  { key: 'professional_cbo', label: 'CBO Profissional', required: false },
  { key: 'consultation_date', label: 'Data da Consulta', required: true },
  { key: 'modality', label: 'Modalidade', required: false },
  { key: 'demand_type', label: 'Tipo de Demanda', required: false },
]

export const MEASUREMENT_FIELDS = [
  { key: 'patient_cpf', label: 'CPF do Paciente', required: true },
  { key: 'patient_name', label: 'Nome do Paciente', required: false },
  { key: 'measurement_date', label: 'Data', required: true },
  { key: 'weight_kg', label: 'Peso (kg)', required: false },
  { key: 'height_cm', label: 'Altura (cm)', required: false },
  { key: 'bp_systolic', label: 'PA Sistolica', required: false },
  { key: 'bp_diastolic', label: 'PA Diastolica', required: false },
]

export const PROCEDURE_FIELDS = [
  { key: 'patient_cpf', label: 'CPF do Paciente', required: true },
  { key: 'patient_name', label: 'Nome do Paciente', required: false },
  { key: 'procedure_code', label: 'Codigo SIGTAP', required: false },
  { key: 'procedure_name', label: 'Nome do Procedimento', required: false },
  { key: 'procedure_date', label: 'Data', required: true },
  { key: 'result_value', label: 'Resultado', required: false },
]

export const HOME_VISIT_FIELDS = [
  { key: 'patient_cpf', label: 'CPF do Paciente', required: true },
  { key: 'patient_name', label: 'Nome do Paciente', required: false },
  { key: 'visitor_cbo', label: 'CBO Visitante', required: false },
  { key: 'visit_date', label: 'Data da Visita', required: true },
  { key: 'visit_reason', label: 'Motivo', required: false },
]

export const VACCINATION_FIELDS = [
  { key: 'patient_cpf', label: 'CPF do Paciente', required: true },
  { key: 'patient_name', label: 'Nome do Paciente', required: false },
  { key: 'vaccine_code', label: 'Codigo Vacina', required: false },
  { key: 'vaccine_name', label: 'Nome Vacina', required: false },
  { key: 'dose_date', label: 'Data da Dose', required: true },
  { key: 'dose_number', label: 'Numero da Dose', required: false },
]

export const IMPORT_TYPES = [
  { key: 'patients', label: 'Pacientes', fields: PATIENT_FIELDS },
  { key: 'consultations', label: 'Consultas/Atendimentos', fields: CONSULTATION_FIELDS },
  { key: 'measurements', label: 'Medicoes (Peso, Altura, PA)', fields: MEASUREMENT_FIELDS },
  { key: 'procedures', label: 'Procedimentos/Exames', fields: PROCEDURE_FIELDS },
  { key: 'home_visits', label: 'Visitas Domiciliares', fields: HOME_VISIT_FIELDS },
  { key: 'vaccinations', label: 'Vacinacoes', fields: VACCINATION_FIELDS },
]

export function autoMapColumns(csvHeaders: string[], systemFields: { key: string, label: string }[]): ColumnMapping {
  const mapping: ColumnMapping = {}

  const normalizations: Record<string, string[]> = {
    name: ['nome', 'nome_paciente', 'nome do paciente', 'paciente', 'nm_paciente'],
    date_of_birth: ['data_nascimento', 'dn', 'dt_nascimento', 'data de nascimento', 'nascimento'],
    sex: ['sexo', 'genero', 'sx'],
    cpf_or_cns: ['cpf/cns', 'cpf_ou_cns', 'cpf_cns', 'documento', 'nr_documento'],
    cpf: ['cpf', 'cpf_paciente', 'nr_cpf'],
    cns: ['cns', 'cartao_sus', 'nr_cns'],
    micro_area: ['micro_area', 'microarea', 'ma', 'area'],
    team_type: ['tipo_equipe', 'equipe', 'tp_equipe'],
    patient_cpf: ['cpf', 'cpf_paciente', 'nr_cpf'],
    patient_name: ['nome', 'nome_paciente', 'paciente'],
    professional_type: ['profissional', 'tipo_profissional', 'tp_profissional'],
    professional_cbo: ['cbo', 'cbo_profissional', 'nr_cbo'],
    consultation_date: ['data', 'data_atendimento', 'dt_atendimento', 'data_consulta'],
    modality: ['modalidade', 'tipo_atendimento'],
    demand_type: ['demanda', 'tipo_demanda', 'tp_demanda'],
    measurement_date: ['data', 'data_medicao', 'dt_medicao'],
    weight_kg: ['peso', 'peso_kg', 'weight'],
    height_cm: ['altura', 'altura_cm', 'height'],
    bp_systolic: ['pa_sistolica', 'sistolica', 'pas'],
    bp_diastolic: ['pa_diastolica', 'diastolica', 'pad'],
    procedure_code: ['codigo', 'cod_procedimento', 'sigtap'],
    procedure_name: ['procedimento', 'nome_procedimento', 'desc_procedimento'],
    procedure_date: ['data', 'data_procedimento', 'dt_procedimento'],
    result_value: ['resultado', 'valor', 'result'],
    visitor_cbo: ['cbo', 'cbo_visitante', 'profissional'],
    visit_date: ['data', 'data_visita', 'dt_visita'],
    visit_reason: ['motivo', 'razao'],
    vaccine_code: ['codigo', 'cod_vacina'],
    vaccine_name: ['vacina', 'nome_vacina'],
    dose_date: ['data', 'data_dose', 'dt_dose', 'data_vacinacao'],
    dose_number: ['dose', 'nr_dose', 'numero_dose'],
  }

  for (const field of systemFields) {
    const possibleNames = normalizations[field.key] || [field.key]
    const csvLower = csvHeaders.map(h => h.toLowerCase().trim().replace(/\s+/g, '_'))

    for (const possible of possibleNames) {
      const idx = csvLower.indexOf(possible)
      if (idx >= 0) {
        mapping[field.key] = csvHeaders[idx]
        break
      }
    }
  }

  return mapping
}

// Auto-detect whether a value is CPF or CNS
// CPF: 11 digits (possibly formatted as XXX.XXX.XXX-XX)
// CNS: 15 digits
export function detectCpfOrCns(value: string): { type: 'cpf' | 'cns' | null; cleaned: string } {
  if (!value) return { type: null, cleaned: '' }
  const digits = value.replace(/\D/g, '')
  if (digits.length === 11) return { type: 'cpf', cleaned: digits }
  if (digits.length === 15) return { type: 'cns', cleaned: digits }
  // If it has dots/dashes typical of CPF formatting, try CPF
  if (/^\d{3}[.\s]?\d{3}[.\s]?\d{3}[-.\s]?\d{2}$/.test(value.trim())) {
    return { type: 'cpf', cleaned: digits }
  }
  // Default: if <= 11 digits treat as partial CPF, if > 11 treat as CNS
  if (digits.length > 0 && digits.length <= 11) return { type: 'cpf', cleaned: digits }
  if (digits.length > 11) return { type: 'cns', cleaned: digits }
  return { type: null, cleaned: '' }
}

export function parseDate(value: string): string | null {
  if (!value) return null
  // Try DD/MM/YYYY
  const brMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2].padStart(2, '0')}-${brMatch[1].padStart(2, '0')}`
  }
  // Try YYYY-MM-DD
  const isoMatch = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`
  }
  return null
}
