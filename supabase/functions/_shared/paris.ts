// Conversions heure de Paris <-> UTC (changements d'heure inclus), sans dépendance
export const TZ = 'Europe/Paris'

/** Décalage (en minutes) entre l'heure de Paris et UTC à un instant donné */
export function tzOffsetMin(d: Date): number {
  const p = parisParts(d)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return Math.round((asUtc - d.getTime()) / 60000)
}

/** Champs date/heure d'un instant, vus depuis Paris (mois de 1 à 12) */
export function parisParts(d: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(d)
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value)
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') }
}

/** Instant correspondant à une date/heure de Paris (mois de 1 à 12) */
export function parisToUtc(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, second)
  const guess = new Date(naive - tzOffsetMin(new Date(naive)) * 60000)
  return new Date(naive - tzOffsetMin(guess) * 60000)
}
