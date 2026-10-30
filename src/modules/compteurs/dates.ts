// Calculs de dates des compteurs (dates AAAA-MM-JJ, en heure locale)
const parse = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m, d }
}
const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate() // m de 1 à 12
const toUtc = (iso: string) => {
  const { y, m, d } = parse(iso)
  return Date.UTC(y, m - 1, d)
}

/** Jours entre deux dates (positif si `to` est après `from`) */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000)
}

/** Années, mois et jours écoulés, comme on les compte à la main */
export function elapsed(since: string, today: string) {
  const a = parse(since)
  const b = parse(today)
  let years = b.y - a.y
  let months = b.m - a.m
  let days = b.d - a.d
  if (days < 0) {
    months--
    // Jours du mois précédant `today` (un 31 janvier → 28 février compte 28 jours)
    const pm = b.m === 1 ? 12 : b.m - 1
    const py = b.m === 1 ? b.y - 1 : b.y
    days += daysInMonth(py, pm)
  }
  if (months < 0) {
    years--
    months += 12
  }
  return { years, months, days, total: daysBetween(since, today) }
}

/** Prochain anniversaire (aujourd'hui compris) : date et nombre d'années fêtées */
export function nextAnniversary(since: string, today: string) {
  const a = parse(since)
  const t = parse(today)
  const on = (y: number) => {
    const d = Math.min(a.d, daysInMonth(y, a.m)) // 29 février → 28 les autres années
    return `${y}-${String(a.m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  let year = t.y
  if (on(year) < today) year++
  return { date: on(year), years: year - a.y, inDays: daysBetween(today, on(year)) }
}

const unit = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`

/** « 3 ans, 4 mois et 12 jours » (les zéros sont omis) */
export function fmtElapsed(e: { years: number; months: number; days: number }) {
  const parts = [
    e.years && unit(e.years, 'an', 'ans'),
    e.months && unit(e.months, 'mois', 'mois'),
    e.days && unit(e.days, 'jour', 'jours'),
  ].filter(Boolean) as string[]
  if (!parts.length) return 'Aujourd’hui'
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} et ${parts[parts.length - 1]}` : parts[0]
}

/** Version courte pour la bande : « 3 a 4 m 12 j » */
export function fmtElapsedShort(e: { years: number; months: number; days: number }) {
  const parts = [
    e.years && `${e.years} an${e.years > 1 ? 's' : ''}`,
    e.months && `${e.months} mois`,
    (e.days || (!e.years && !e.months)) && `${e.days} j`,
  ].filter(Boolean)
  return parts.join(' ')
}

/** « aujourd'hui », « demain », « dans 23 jours » */
export function fmtIn(days: number) {
  if (days === 0) return 'aujourd’hui'
  if (days === 1) return 'demain'
  return `dans ${days} jours`
}
