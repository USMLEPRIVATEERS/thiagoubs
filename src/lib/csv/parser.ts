import Papa from 'papaparse'

export interface ParsedCSV {
  headers: string[]
  rows: Record<string, string>[]
  errors: string[]
}

export function parseCSV(file: File): Promise<ParsedCSV> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete(results) {
        const headers = results.meta.fields || []
        const rows = results.data as Record<string, string>[]
        const errors = results.errors.map(e => `Linha ${e.row}: ${e.message}`)
        resolve({ headers, rows, errors })
      },
      error(err) {
        resolve({ headers: [], rows: [], errors: [err.message] })
      },
    })
  })
}

export function parsePastedText(text: string): ParsedCSV {
  const lines = text.split('\n').filter(l => l.trim() !== '')
  if (lines.length === 0) {
    return { headers: [], rows: [], errors: ['Texto vazio'] }
  }

  // Detect delimiter: tab or semicolon
  const firstLine = lines[0]
  const tabCount = (firstLine.match(/\t/g) || []).length
  const semiCount = (firstLine.match(/;/g) || []).length
  const delimiter = tabCount >= semiCount ? '\t' : ';'

  const headers = lines[0].split(delimiter).map(h => h.trim())
  const rows: Record<string, string>[] = []
  const errors: string[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map(c => c.trim())
    const row: Record<string, string> = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = cols[j] || ''
    }
    rows.push(row)
  }

  return { headers, rows, errors }
}
