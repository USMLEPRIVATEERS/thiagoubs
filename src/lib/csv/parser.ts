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
