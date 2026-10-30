import { addDays, fmtShort, fmtWeekday, startOfDay, startOfWeek, toDateInput } from '../agenda/dates'
import type { Recurrence } from '../agenda/types'

export const todayISO = () => toDateInput(new Date())
const parse = (iso: string) => new Date(`${iso}T00:00:00`)

/** n-ième échéance d'une répétition ; un 31 devient le dernier jour des mois plus courts */
function nth(base: Date, rec: Recurrence, i: number): Date {
  switch (rec) {
    case 'daily':
      return addDays(base, i)
    case 'weekly':
      return addDays(base, 7 * i)
    case 'monthly':
    case 'yearly': {
      const months = rec === 'monthly' ? i : 12 * i
      const y = base.getFullYear()
      const m = base.getMonth() + months
      const last = new Date(y, m + 1, 0).getDate()
      return new Date(y, m, Math.min(base.getDate(), last))
    }
  }
}

/** Prochaine échéance après l'actuelle et après aujourd'hui (une tâche en retard ne reste pas en retard) */
export function nextDue(due: string, rec: Recurrence, today = todayISO()): string {
  const base = parse(due)
  for (let i = 1; i < 5000; i++) {
    const d = toDateInput(nth(base, rec, i))
    if (d > today) return d
  }
  return today
}

export type Section = 'late' | 'today' | 'week' | 'later' | 'none'

export const SECTION_LABELS: Record<Section, string> = {
  late: 'En retard',
  today: 'Aujourd’hui',
  week: 'Cette semaine',
  later: 'Plus tard',
  none: 'Sans date',
}

export function sectionOf(due: string | null, today = todayISO()): Section {
  if (!due) return 'none'
  if (due < today) return 'late'
  if (due === today) return 'today'
  const sunday = toDateInput(addDays(startOfWeek(parse(today)), 6))
  return due <= sunday ? 'week' : 'later'
}

/** « Aujourd’hui », « Demain », « Hier », sinon « Mer. 5 nov. » */
export function fmtDue(due: string, today = todayISO()): string {
  const t = startOfDay(parse(today))
  if (due === today) return 'Aujourd’hui'
  if (due === toDateInput(addDays(t, 1))) return 'Demain'
  if (due === toDateInput(addDays(t, -1))) return 'Hier'
  const d = parse(due)
  return `${fmtWeekday(d)} ${fmtShort(d)}${d.getFullYear() !== t.getFullYear() ? ` ${d.getFullYear()}` : ''}`
}
