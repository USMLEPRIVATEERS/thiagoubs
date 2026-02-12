// ============================================================
// TAGS = Boas Práticas dos Indicadores (conforme PDFs oficiais)
// O Thiago clica em cada boa prática cumprida por paciente.
// ============================================================

export interface GoodPractice {
  tag: string        // tag stored on patient
  label: string      // display label
  points: number     // points when achieved
  exemptEAP76: boolean // exempt for eAP type 76?
}

export interface IndicatorSpec {
  code: string
  name: string
  description: string
  eligibilityTags: string[]  // tags that make a patient eligible
  practices: GoodPractice[]
  maxPoints: number
}

// ============================================================
// ELEGIBILIDADE — quem entra em cada indicador
// ============================================================
export const ELIGIBILITY_TAGS = [
  'Criança 0-24 meses',
  'Gestante',
  'Puérpera',
  'Diabetes',
  'Hipertensão',
  'Idoso 60+',
  'Mulher 25-64',
  'Menina 9-14',
  'Pessoa 14-69 (saúde sexual)',
  'Mulher 50-69',
]

// ============================================================
// C2 — Cuidado no Desenvolvimento Infantil (0-24m)
// ============================================================
const C2: IndicatorSpec = {
  code: 'C2',
  name: 'Desenvolvimento Infantil',
  description: 'Crianças de 0 a 24 meses',
  eligibilityTags: ['Criança 0-24 meses'],
  practices: [
    { tag: 'C2-A', label: '1ª consulta médico/enf até 30 dias de vida', points: 20, exemptEAP76: false },
    { tag: 'C2-B', label: '≥9 consultas médico/enf até 2 anos', points: 20, exemptEAP76: false },
    { tag: 'C2-C', label: '≥9 registros peso+altura até 2 anos', points: 20, exemptEAP76: false },
    { tag: 'C2-D', label: '≥2 visitas ACS (1ª até 30d, 2ª até 6m)', points: 20, exemptEAP76: true },
    { tag: 'C2-E', label: 'Vacinação completa (Penta+VIP+Tríplice+Pneumo)', points: 20, exemptEAP76: false },
  ],
  maxPoints: 100,
}

// ============================================================
// C3 — Cuidado na Gestação e Puerpério
// ============================================================
const C3: IndicatorSpec = {
  code: 'C3',
  name: 'Gestação e Puerpério',
  description: 'Gestantes e puérperas (até 42 dias pós-parto)',
  eligibilityTags: ['Gestante', 'Puérpera'],
  practices: [
    { tag: 'C3-A', label: '1ª consulta médico/enf até 12ª semana', points: 10, exemptEAP76: false },
    { tag: 'C3-B', label: '≥7 consultas médico/enf na gestação', points: 9, exemptEAP76: false },
    { tag: 'C3-C', label: '≥7 aferições de PA na gestação', points: 9, exemptEAP76: false },
    { tag: 'C3-D', label: '≥7 registros peso+altura na gestação', points: 9, exemptEAP76: false },
    { tag: 'C3-E', label: '≥3 visitas ACS após 1ª consulta pré-natal', points: 9, exemptEAP76: true },
    { tag: 'C3-F', label: 'Vacina dTpa a partir da 20ª semana', points: 9, exemptEAP76: false },
    { tag: 'C3-G', label: 'Testes sífilis+HIV+HepB+HepC no 1º tri', points: 9, exemptEAP76: false },
    { tag: 'C3-H', label: 'Testes sífilis+HIV no 3º tri', points: 9, exemptEAP76: false },
    { tag: 'C3-I', label: '≥1 consulta médico/enf no puerpério', points: 9, exemptEAP76: false },
    { tag: 'C3-J', label: '≥1 visita ACS no puerpério', points: 9, exemptEAP76: true },
    { tag: 'C3-K', label: '≥1 atendimento saúde bucal (dentista/TSB)', points: 9, exemptEAP76: false },
  ],
  maxPoints: 100,
}

// ============================================================
// C4 — Cuidado da Pessoa com Diabetes
// ============================================================
const C4: IndicatorSpec = {
  code: 'C4',
  name: 'Diabetes',
  description: 'Pacientes com diabetes ativa',
  eligibilityTags: ['Diabetes'],
  practices: [
    { tag: 'C4-A', label: '≥1 consulta médico/enf a cada 6 meses', points: 20, exemptEAP76: false },
    { tag: 'C4-B', label: '≥1 aferição de PA a cada 6 meses', points: 15, exemptEAP76: false },
    { tag: 'C4-C', label: '≥1 registro peso+altura a cada 12 meses', points: 15, exemptEAP76: false },
    { tag: 'C4-D', label: '≥2 visitas ACS (intervalo mín. 30d) a cada 12 meses', points: 20, exemptEAP76: true },
    { tag: 'C4-E', label: '≥1 HbA1c solicitada/avaliada a cada 12 meses', points: 15, exemptEAP76: false },
    { tag: 'C4-F', label: '≥1 exame do pé diabético a cada 12 meses', points: 15, exemptEAP76: false },
  ],
  maxPoints: 100,
}

// ============================================================
// C5 — Cuidado da Pessoa com Hipertensão
// ============================================================
const C5: IndicatorSpec = {
  code: 'C5',
  name: 'Hipertensão',
  description: 'Pacientes com hipertensão ativa',
  eligibilityTags: ['Hipertensão'],
  practices: [
    { tag: 'C5-A', label: '≥1 consulta médico/enf a cada 6 meses', points: 25, exemptEAP76: false },
    { tag: 'C5-B', label: '≥1 aferição de PA a cada 6 meses', points: 25, exemptEAP76: false },
    { tag: 'C5-C', label: '≥1 registro peso+altura a cada 12 meses', points: 25, exemptEAP76: false },
    { tag: 'C5-D', label: '≥2 visitas ACS (intervalo mín. 30d) a cada 12 meses', points: 25, exemptEAP76: true },
  ],
  maxPoints: 100,
}

// ============================================================
// C6 — Cuidado da Pessoa Idosa
// ============================================================
const C6: IndicatorSpec = {
  code: 'C6',
  name: 'Pessoa Idosa',
  description: 'Pacientes com 60 anos ou mais',
  eligibilityTags: ['Idoso 60+'],
  practices: [
    { tag: 'C6-A', label: '≥1 consulta médico/enf a cada 12 meses', points: 25, exemptEAP76: false },
    { tag: 'C6-B', label: '≥1 registro peso+altura a cada 12 meses', points: 25, exemptEAP76: false },
    { tag: 'C6-C', label: '≥2 visitas ACS (intervalo mín. 30d) a cada 12 meses', points: 25, exemptEAP76: true },
    { tag: 'C6-D', label: '1 dose vacina influenza a cada 12 meses', points: 25, exemptEAP76: false },
  ],
  maxPoints: 100,
}

// ============================================================
// C7 — Cuidado da Mulher na Prevenção do Câncer
// Cálculo diferente: cada BP tem seu próprio denominador (faixa etária)
// Fórmula: (A + B + C + D) × 100
// Onde cada = (nº cumprindo / nº elegível na faixa) × peso
// ============================================================
const C7: IndicatorSpec = {
  code: 'C7',
  name: 'Prevenção do Câncer na Mulher',
  description: 'Mulheres 9-69 anos (faixa específica por BP)',
  eligibilityTags: ['Mulher 25-64', 'Menina 9-14', 'Pessoa 14-69 (saúde sexual)', 'Mulher 50-69'],
  practices: [
    { tag: 'C7-A', label: 'Rastreamento câncer colo uterino (25-64, a cada 36m)', points: 20, exemptEAP76: false },
    { tag: 'C7-B', label: '≥1 dose vacina HPV (meninas 9-14)', points: 30, exemptEAP76: false },
    { tag: 'C7-C', label: 'Atendimento saúde sexual/reprodutiva (14-69, a cada 12m)', points: 30, exemptEAP76: false },
    { tag: 'C7-D', label: 'Rastreamento câncer mama (50-69, a cada 24m)', points: 20, exemptEAP76: false },
  ],
  maxPoints: 100,
}

// Map of C7 practice -> which eligibility tag determines the denominator
export const C7_PRACTICE_ELIGIBILITY: Record<string, string> = {
  'C7-A': 'Mulher 25-64',
  'C7-B': 'Menina 9-14',
  'C7-C': 'Pessoa 14-69 (saúde sexual)',
  'C7-D': 'Mulher 50-69',
}

// ============================================================
// All indicators (C1 excluded — it's a team-level ratio, not per-patient)
// ============================================================
export const INDICATORS: Record<string, IndicatorSpec> = {
  C2, C3, C4, C5, C6, C7,
}

export const INDICATOR_LIST = [C2, C3, C4, C5, C6, C7]

// All good practice tags (flat)
export const ALL_PRACTICE_TAGS = INDICATOR_LIST.flatMap(i => i.practices.map(p => p.tag))

// All tags (eligibility + practices)
export const ALL_TAGS = [...ELIGIBILITY_TAGS, ...ALL_PRACTICE_TAGS]

// ============================================================
// Tag categories for the TagSelector UI
// ============================================================
export const TAG_CATEGORIES: Record<string, string[]> = {
  'Elegibilidade': ELIGIBILITY_TAGS,
  'C2 — Desenvolvimento Infantil': C2.practices.map(p => p.tag),
  'C3 — Gestação e Puerpério': C3.practices.map(p => p.tag),
  'C4 — Diabetes': C4.practices.map(p => p.tag),
  'C5 — Hipertensão': C5.practices.map(p => p.tag),
  'C6 — Pessoa Idosa': C6.practices.map(p => p.tag),
  'C7 — Prevenção Câncer Mulher': C7.practices.map(p => p.tag),
}

// ============================================================
// Colors
// ============================================================
export const TAG_CATEGORY_COLORS: Record<string, string> = {
  'Elegibilidade': 'bg-indigo-100 text-indigo-700',
  'C2 — Desenvolvimento Infantil': 'bg-blue-100 text-blue-700',
  'C3 — Gestação e Puerpério': 'bg-pink-100 text-pink-700',
  'C4 — Diabetes': 'bg-orange-100 text-orange-700',
  'C5 — Hipertensão': 'bg-red-100 text-red-700',
  'C6 — Pessoa Idosa': 'bg-purple-100 text-purple-700',
  'C7 — Prevenção Câncer Mulher': 'bg-teal-100 text-teal-700',
}

export function getTagColor(tag: string): string {
  for (const [category, tags] of Object.entries(TAG_CATEGORIES)) {
    if (tags.includes(tag)) {
      return TAG_CATEGORY_COLORS[category] || 'bg-gray-100 text-gray-700'
    }
  }
  return 'bg-gray-100 text-gray-700'
}

// Get label for a practice tag
export function getTagLabel(tag: string): string {
  for (const ind of INDICATOR_LIST) {
    const p = ind.practices.find(p => p.tag === tag)
    if (p) return p.label
  }
  return tag
}

// ============================================================
// Scoring functions
// ============================================================

// Get which indicators a patient is eligible for
export function getIndicatorsForTags(tags: string[]): string[] {
  const indicators: string[] = []
  for (const ind of INDICATOR_LIST) {
    if (ind.eligibilityTags.some(t => tags.includes(t))) {
      indicators.push(ind.code)
    }
  }
  return indicators
}

// Calculate score for a patient on a specific indicator
export function calculateScore(
  tags: string[],
  indicatorCode: string,
  teamType: 70 | 76
): { score: number; maxPossible: number; percentage: number; practices: { tag: string; label: string; points: number; achieved: boolean; exempt: boolean }[] } {
  const ind = INDICATORS[indicatorCode]
  if (!ind) return { score: 0, maxPossible: 0, percentage: 0, practices: [] }

  let score = 0
  let maxPossible = 0
  const practices = ind.practices.map(p => {
    const exempt = p.exemptEAP76 && teamType === 76
    const achieved = tags.includes(p.tag)

    if (!exempt) {
      maxPossible += p.points
      if (achieved) score += p.points
    }

    return { tag: p.tag, label: p.label, points: p.points, achieved, exempt }
  })

  const percentage = maxPossible > 0 ? (score / maxPossible) * 100 : 0

  return { score, maxPossible, percentage, practices }
}
