export const DAY_MS = 86_400_000

export function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
export function endOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}
export function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
export function addMonths(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(1)
  x.setMonth(x.getMonth() + n)
  return x
}
/** Semaine du lundi au dimanche */
export function startOfWeek(d: Date) {
  const x = startOfDay(d)
  return addDays(x, -((x.getDay() + 6) % 7))
}
export function startOfMonth(d: Date) {
  const x = startOfDay(d)
  x.setDate(1)
  return x
}
export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

const pad = (n: number) => String(n).padStart(2, '0')
export const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const toTimeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
export const fromInputs = (date: string, time: string) => new Date(`${date}T${time}`)

const fr = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fr-FR', o)
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const fmtTime = (d: Date) => fr({ hour: '2-digit', minute: '2-digit' }).format(d)
export const fmtWeekday = (d: Date) => cap(fr({ weekday: 'short' }).format(d).replace('.', ''))
export const fmtDayLong = (d: Date) => cap(fr({ weekday: 'long', day: 'numeric', month: 'long' }).format(d))
export const fmtMonthYear = (d: Date) => cap(fr({ month: 'long', year: 'numeric' }).format(d))
export const fmtShort = (d: Date) => fr({ day: 'numeric', month: 'short' }).format(d)

export function fmtWeekRange(weekStart: Date) {
  const end = addDays(weekStart, 6)
  return `${fmtShort(weekStart)} – ${fmtShort(end)}`
}

/** Texte « quand » d'une occurrence, ex. « Mer. 28 oct. · 19:30 – 21:00 » */
export function fmtWhen(start: Date, end: Date, allDay: boolean) {
  const day = `${fmtWeekday(start)} ${fmtShort(start)}`
  if (allDay) return sameDay(start, end) ? `${day}, toute la journée` : `Du ${fmtShort(start)} au ${fmtShort(end)}`
  if (sameDay(start, end)) return `${day}, ${fmtTime(start)} – ${fmtTime(end)}`
  return `${day} ${fmtTime(start)} – ${fmtShort(end)} ${fmtTime(end)}`
}
