import type { Classification } from '@/types/indicator'

export function getClassification(score: number, maxScore: number): Classification {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0
  if (pct > 75) return 'otimo'
  if (pct > 50) return 'bom'
  if (pct > 25) return 'suficiente'
  return 'regular'
}

// C1 classification per spec:
// Otimo: >50% e ≤70%
// Bom: >40% e ≤50% OR >70% e ≤80%
// Suficiente: >30% e ≤40% OR >80% e ≤90%
// Regular: ≤30% OR >90%
export function getC1Classification(pctProgramada: number): Classification {
  if (pctProgramada > 50 && pctProgramada <= 70) return 'otimo'
  if ((pctProgramada > 40 && pctProgramada <= 50) || (pctProgramada > 70 && pctProgramada <= 80)) return 'bom'
  if ((pctProgramada > 30 && pctProgramada <= 40) || (pctProgramada > 80 && pctProgramada <= 90)) return 'suficiente'
  return 'regular' // ≤30% ou >90%
}

export function classificationColor(c: Classification): string {
  switch (c) {
    case 'otimo': return '#16a34a'
    case 'bom': return '#3b82f6'
    case 'suficiente': return '#ea580c'
    case 'regular': return '#991b1b'
  }
}

export function classificationBg(c: Classification): string {
  switch (c) {
    case 'otimo': return 'bg-green-100 text-green-800'
    case 'bom': return 'bg-blue-100 text-blue-800'
    case 'suficiente': return 'bg-orange-100 text-orange-800'
    case 'regular': return 'bg-red-100 text-red-800'
  }
}

export function classificationLabel(c: Classification): string {
  switch (c) {
    case 'otimo': return 'Otimo'
    case 'bom': return 'Bom'
    case 'suficiente': return 'Suficiente'
    case 'regular': return 'Regular'
  }
}
