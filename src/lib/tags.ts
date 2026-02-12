// All available tags organized by category
export const TAG_CATEGORIES: Record<string, string[]> = {
  'Condições Crônicas': [
    'Hipertensão',
    'Diabetes Tipo 1',
    'Diabetes Tipo 2',
    'Obesidade',
    'Doença renal crônica',
    'Asma',
    'DPOC',
    'Insuficiência cardíaca',
    'AVC prévio',
    'Cardiopatia',
  ],
  'Saúde da Mulher': [
    'Gestante',
    'Puérpera',
    'Mulher 25-64 anos',
    'Uso de anticoncepcional',
  ],
  'Saúde da Criança': [
    'Criança < 1 ano',
    'Criança 1-2 anos',
    'Criança 2-5 anos',
  ],
  'Doenças Infecciosas': [
    'Tuberculose',
    'Hanseníase',
    'HIV/AIDS',
    'Sífilis',
    'Hepatite B',
    'Hepatite C',
  ],
  'Saúde Mental': [
    'Depressão',
    'Ansiedade',
    'Esquizofrenia',
    'Transtorno bipolar',
    'Uso de álcool/drogas',
    'Deficiência intelectual',
    'Autismo',
  ],
  'Situação Social / Risco': [
    'Acamado',
    'Domiciliado',
    'Tabagista',
    'Etilista',
    'Bolsa Família',
    'Vulnerabilidade social',
    'Idoso 60+',
    'Idoso 80+',
  ],
  'Acompanhamento em dia': [
    'Pré-natal em dia',
    'Puericultura em dia',
    'Vacinação em dia',
    'Citopatológico em dia',
    'Consulta periódica em dia',
    'PA controlada',
    'Glicemia controlada',
    'HbA1c em dia',
    'Exames laboratoriais em dia',
    'Tratamento TB em dia',
    'Tratamento Hanseníase em dia',
    'Acompanhamento saúde mental em dia',
    'Visita domiciliar em dia',
  ],
}

// All tags as flat array
export const ALL_TAGS = Object.values(TAG_CATEGORIES).flat()

// Which tags make a patient ELIGIBLE for each indicator
export const INDICATOR_TAGS: Record<string, string[]> = {
  C1: ['Gestante'],
  C2: ['Criança < 1 ano', 'Criança 1-2 anos'],
  C3: ['Hipertensão', 'Diabetes Tipo 1', 'Diabetes Tipo 2'],
  C4: ['Mulher 25-64 anos'],
  C5: ['Depressão', 'Ansiedade', 'Esquizofrenia', 'Transtorno bipolar', 'Uso de álcool/drogas'],
  C6: ['Tuberculose'],
  C7: ['Hanseníase'],
}

// Tags that indicate the patient is "in compliance" for each indicator
export const INDICATOR_COMPLIANCE_TAGS: Record<string, string[]> = {
  C1: ['Pré-natal em dia'],
  C2: ['Puericultura em dia', 'Vacinação em dia'],
  C3: ['PA controlada', 'Glicemia controlada', 'HbA1c em dia', 'Consulta periódica em dia'],
  C4: ['Citopatológico em dia'],
  C5: ['Acompanhamento saúde mental em dia'],
  C6: ['Tratamento TB em dia'],
  C7: ['Tratamento Hanseníase em dia'],
}

// Color for each category
export const TAG_CATEGORY_COLORS: Record<string, string> = {
  'Condições Crônicas': 'bg-red-100 text-red-700',
  'Saúde da Mulher': 'bg-pink-100 text-pink-700',
  'Saúde da Criança': 'bg-blue-100 text-blue-700',
  'Doenças Infecciosas': 'bg-orange-100 text-orange-700',
  'Saúde Mental': 'bg-purple-100 text-purple-700',
  'Situação Social / Risco': 'bg-yellow-100 text-yellow-700',
  'Acompanhamento em dia': 'bg-green-100 text-green-700',
}

// Get color class for a tag
export function getTagColor(tag: string): string {
  for (const [category, tags] of Object.entries(TAG_CATEGORIES)) {
    if (tags.includes(tag)) {
      return TAG_CATEGORY_COLORS[category] || 'bg-gray-100 text-gray-700'
    }
  }
  return 'bg-gray-100 text-gray-700'
}

// Get which indicators a patient is eligible for based on tags
export function getIndicatorsForTags(tags: string[]): string[] {
  const indicators: string[] = []
  for (const [code, eligibilityTags] of Object.entries(INDICATOR_TAGS)) {
    if (eligibilityTags.some(t => tags.includes(t))) {
      indicators.push(code)
    }
  }
  return indicators
}

// Check if patient is compliant for a given indicator based on tags
export function isCompliantForIndicator(tags: string[], indicator: string): boolean {
  const complianceTags = INDICATOR_COMPLIANCE_TAGS[indicator]
  if (!complianceTags) return false
  return complianceTags.every(t => tags.includes(t))
}
