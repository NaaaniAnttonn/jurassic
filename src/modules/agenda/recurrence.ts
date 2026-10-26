import { DAY_MS } from './dates'
import type { CalEvent, Occurrence, Recurrence } from './types'

/** n-ième répétition d'une date (null si elle n'existe pas : 31 du mois, 29 février) */
function nth(start: Date, rec: Recurrence, i: number): Date | null {
  const d = new Date(start)
  switch (rec) {
    case 'daily':
      d.setDate(d.getDate() + i)
      return d
    case 'weekly':
      d.setDate(d.getDate() + 7 * i)
      return d
    case 'monthly':
      d.setMonth(d.getMonth() + i)
      return d.getDate() === start.getDate() ? d : null
    case 'yearly':
      d.setFullYear(d.getFullYear() + i)
      return d.getMonth() === start.getMonth() ? d : null
  }
}

/** Toutes les occurrences visibles entre from et to, triées par début */
export function expand(events: CalEvent[], from: Date, to: Date): Occurrence[] {
  const out: Occurrence[] = []

  for (const event of events) {
    const start = new Date(event.start_at)
    const end = new Date(event.end_at)
    const duration = end.getTime() - start.getTime()

    if (!event.recurrence) {
      if (end >= from && start <= to) out.push({ event, start, end })
      continue
    }

    const until = event.recurrence_until ? new Date(`${event.recurrence_until}T23:59:59`) : null
    let i0 = 0
    if (event.recurrence === 'daily' || event.recurrence === 'weekly') {
      const step = (event.recurrence === 'daily' ? 1 : 7) * DAY_MS
      i0 = Math.max(0, Math.floor((from.getTime() - start.getTime() - duration) / step) - 1)
    }

    for (let i = i0; i < i0 + 1000; i++) {
      const occ = nth(start, event.recurrence, i)
      if (!occ) continue
      if (occ > to || (until && occ > until)) break
      const occEnd = new Date(occ.getTime() + duration)
      if (occEnd >= from) out.push({ event, start: occ, end: occEnd })
    }
  }

  return out.sort((a, b) => a.start.getTime() - b.start.getTime() || Number(b.event.all_day) - Number(a.event.all_day))
}

/** Occurrences qui touchent un jour donné */
export function onDay(occurrences: Occurrence[], dayStart: Date) {
  const dayEnd = new Date(dayStart.getTime() + DAY_MS - 1)
  return occurrences.filter((o) => o.start <= dayEnd && o.end >= dayStart)
}
