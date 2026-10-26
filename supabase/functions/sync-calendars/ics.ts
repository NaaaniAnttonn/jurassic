// Lecture d'un agenda iCal (Google, iCloud...) : occurrences comprises dans une fenêtre de temps
import ICAL from 'npm:ical.js@1.5.0'
import { parisToUtc } from '../_shared/paris.ts'

export type ImportedEvent = {
  uid: string
  title: string
  location: string | null
  notes: string | null
  start_at: string
  end_at: string
  all_day: boolean
}

const MAX_OCCURRENCES = 5000
const MAX_ITERATIONS = 50_000 // répétition quotidienne depuis très longtemps

// deno-lint-ignore no-explicit-any
type Any = any

const text = (v: unknown, max: number) => {
  const s = typeof v === 'string' ? v.trim() : ''
  return s ? s.slice(0, max) : null
}

const cancelled = (c: Any) => String(c.getFirstPropertyValue('status') ?? '').toUpperCase() === 'CANCELLED'

/** Heure sans fuseau connu (« flottante ») : on la considère comme heure de Paris */
function toDate(t: Any): Date {
  const zone = t.zone?.tzid
  if (!zone || zone === 'floating') return parisToUtc(t.year, t.month, t.day, t.hour, t.minute, t.second)
  return t.toJSDate()
}

function occurrence(uid: string, item: Any, start: Any, end: Any): ImportedEvent {
  const allDay = !!start.isDate
  let startAt: Date
  let endAt: Date
  if (allDay) {
    // Même convention que l'appli : de 00:00 au dernier jour 23:59:59 (DTEND est exclusif)
    startAt = parisToUtc(start.year, start.month, start.day)
    const last = end && end.compare(start) > 0 ? end : null
    endAt = last
      ? new Date(parisToUtc(last.year, last.month, last.day).getTime() - 1000)
      : new Date(parisToUtc(start.year, start.month, start.day + 1).getTime() - 1000)
  } else {
    startAt = toDate(start)
    endAt = end ? toDate(end) : startAt
    if (endAt < startAt) endAt = startAt
  }
  return {
    uid,
    title: text(item.summary, 200) ?? 'Occupé',
    location: text(item.location, 300),
    notes: text(item.description, 2000),
    start_at: startAt.toISOString(),
    end_at: endAt.toISOString(),
    all_day: allDay,
  }
}

export function parseIcs(source: string, from: Date, to: Date): ImportedEvent[] {
  const root = new ICAL.Component(ICAL.parse(source))
  for (const tz of root.getAllSubcomponents('vtimezone')) ICAL.TimezoneService.register(tz)

  // Les modifications d'une seule occurrence (RECURRENCE-ID) sont rattachées à leur série
  const vevents: Any[] = root.getAllSubcomponents('vevent')
  const masters = vevents.filter((v) => !v.hasProperty('recurrence-id'))
  const masterUids = new Set(masters.map((v) => v.getFirstPropertyValue('uid')))
  const orphans = vevents.filter((v) => v.hasProperty('recurrence-id') && !masterUids.has(v.getFirstPropertyValue('uid')))

  const out: ImportedEvent[] = []
  const overlaps = (s: Date, e: Date) => e >= from && s <= to

  for (const comp of [...masters, ...orphans]) {
    if (out.length >= MAX_OCCURRENCES) break
    if (cancelled(comp)) continue
    const ev = new ICAL.Event(comp)
    if (!ev.startDate) continue
    const uid = String(ev.uid ?? crypto.randomUUID())

    if (!ev.isRecurring() || comp.hasProperty('recurrence-id')) {
      const o = occurrence(uid, ev, ev.startDate, ev.endDate)
      if (overlaps(new Date(o.start_at), new Date(o.end_at))) out.push(o)
      continue
    }

    for (const ex of vevents) {
      if (ex.hasProperty('recurrence-id') && ex.getFirstPropertyValue('uid') === ev.uid) ev.relateException(ex)
    }

    const it = ev.iterator()
    let next: Any
    for (let i = 0; i < MAX_ITERATIONS && out.length < MAX_OCCURRENCES && (next = it.next()); i++) {
      if (toDate(next) > to) break
      const details = ev.getOccurrenceDetails(next)
      if (cancelled(details.item.component)) continue
      const o = occurrence(uid, details.item, details.startDate, details.endDate)
      if (overlaps(new Date(o.start_at), new Date(o.end_at))) out.push(o)
    }
  }

  return out.sort((a, b) => a.start_at.localeCompare(b.start_at))
}
