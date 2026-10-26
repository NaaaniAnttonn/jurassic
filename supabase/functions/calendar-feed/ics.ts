// Génération du fichier iCal (RFC 5545) servi aux agendas Google / Apple
import { parisParts, parisToUtc } from '../_shared/paris.ts'

export type FeedEvent = {
  uid: string
  title: string
  location: string | null
  notes: string | null
  start_at: string
  end_at: string
  all_day: boolean
  recurrence: 'daily' | 'weekly' | 'monthly' | 'yearly' | null
  recurrence_until: string | null // date AAAA-MM-JJ
  updated_at: string
}

const VTIMEZONE = [
  'BEGIN:VTIMEZONE', 'TZID:Europe/Paris',
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST',
  'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET',
  'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
  'END:VTIMEZONE',
]

const pad = (n: number, w = 2) => String(n).padStart(w, '0')

/** 20261028 (jour vu depuis Paris, éventuellement décalé de n jours) */
function parisDate(d: Date, addDays = 0): string {
  const p = parisParts(d)
  const x = new Date(Date.UTC(p.year, p.month - 1, p.day + addDays))
  return `${x.getUTCFullYear()}${pad(x.getUTCMonth() + 1)}${pad(x.getUTCDate())}`
}

/** 20261028T193000 (heure locale de Paris) */
function parisDateTime(d: Date): string {
  const p = parisParts(d)
  return `${p.year}${pad(p.month)}${pad(p.day)}T${pad(p.hour)}${pad(p.minute)}${pad(p.second)}`
}

/** 20261028T183000Z */
function utcDateTime(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Coupe les lignes à 75 octets sans casser un caractère accentué */
function fold(line: string): string {
  const enc = new TextEncoder()
  if (enc.encode(line).length <= 75) return line
  const out: string[] = []
  let cur = ''
  let bytes = 0
  for (const ch of line) {
    const n = enc.encode(ch).length
    if (bytes + n > (out.length ? 74 : 75)) {
      out.push(cur)
      cur = ''
      bytes = 0
    }
    cur += ch
    bytes += n
  }
  out.push(cur)
  return out.join('\r\n ')
}

const FREQ = { daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY' } as const

function vevent(ev: FeedEvent, now: Date): string[] {
  const start = new Date(ev.start_at)
  const end = new Date(ev.end_at)
  const lines = [
    'BEGIN:VEVENT',
    `UID:${ev.uid}`,
    `DTSTAMP:${utcDateTime(now)}`,
    `LAST-MODIFIED:${utcDateTime(new Date(ev.updated_at))}`,
    `SUMMARY:${escapeText(ev.title)}`,
  ]

  if (ev.all_day) {
    // Fin exclusive : le lendemain du dernier jour
    lines.push(`DTSTART;VALUE=DATE:${parisDate(start)}`, `DTEND;VALUE=DATE:${parisDate(end, 1)}`)
  } else {
    lines.push(`DTSTART;TZID=Europe/Paris:${parisDateTime(start)}`, `DTEND;TZID=Europe/Paris:${parisDateTime(end)}`)
  }

  if (ev.recurrence) {
    let rule = `RRULE:FREQ=${FREQ[ev.recurrence]}`
    if (ev.recurrence_until) {
      const [y, m, d] = ev.recurrence_until.split('-').map(Number)
      // Avec un DTSTART à fuseau, UNTIL doit être en UTC : 23:59:59 à Paris ce jour-là
      rule += ev.all_day ? `;UNTIL=${y}${pad(m)}${pad(d)}` : `;UNTIL=${utcDateTime(parisToUtc(y, m, d, 23, 59, 59))}`
    }
    lines.push(rule)
  }

  if (ev.location) lines.push(`LOCATION:${escapeText(ev.location)}`)
  if (ev.notes) lines.push(`DESCRIPTION:${escapeText(ev.notes)}`)
  lines.push('END:VEVENT')
  return lines
}

export function buildCalendar(name: string, events: FeedEvent[], now = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Jurassic//Agenda//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(name)}`,
    'X-WR-TIMEZONE:Europe/Paris',
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
    'X-PUBLISHED-TTL:PT15M',
    ...VTIMEZONE,
    ...events.flatMap((ev) => vevent(ev, now)),
    'END:VCALENDAR',
  ]
  return lines.map(fold).join('\r\n') + '\r\n'
}
