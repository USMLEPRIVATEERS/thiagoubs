import { differenceInDays, addDays, parseISO, isValid } from 'date-fns'

export function today(): Date {
  return new Date()
}

export function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const date = parseISO(dateStr)
  if (!isValid(date)) return null
  return differenceInDays(today(), date)
}

export function daysUntilDue(lastDateStr: string | null, periodDays: number): number | null {
  if (!lastDateStr) return null
  const lastDate = parseISO(lastDateStr)
  if (!isValid(lastDate)) return null
  const dueDate = addDays(lastDate, periodDays)
  return differenceInDays(dueDate, today())
}

export function getDueDate(lastDateStr: string | null, periodDays: number): string | null {
  if (!lastDateStr) return null
  const lastDate = parseISO(lastDateStr)
  if (!isValid(lastDate)) return null
  return addDays(lastDate, periodDays).toISOString().split('T')[0]
}

export function isWithinPeriod(dateStr: string | null | undefined, periodDays: number): boolean {
  if (!dateStr) return false
  const days = daysSince(dateStr)
  if (days === null) return false
  return days <= periodDays
}

export function ageInYears(dateOfBirth: string | null | undefined): number {
  if (!dateOfBirth) return 0
  const dob = parseISO(dateOfBirth)
  if (!isValid(dob)) return 0
  const ageDays = differenceInDays(today(), dob)
  return Math.floor(ageDays / 365.25)
}

export function ageInMonths(dateOfBirth: string | null | undefined): number {
  if (!dateOfBirth) return 0
  const dob = parseISO(dateOfBirth)
  if (!isValid(dob)) return 0
  const ageDays = differenceInDays(today(), dob)
  return Math.floor(ageDays / 30.44)
}

export function gestationalWeeks(dumStr: string): number {
  const dum = parseISO(dumStr)
  const days = differenceInDays(today(), dum)
  return Math.floor(days / 7)
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  const date = parseISO(dateStr)
  if (!isValid(date)) return '-'
  return date.toLocaleDateString('pt-BR')
}
