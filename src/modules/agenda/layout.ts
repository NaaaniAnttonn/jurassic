import { DAY_MS, addDays, startOfDay } from './dates'
import type { Occurrence } from './types'

const MIN = 60_000

/** Dernier jour touché (un événement qui finit à minuit pile ne déborde pas sur le lendemain) */
export function lastDay(o: Occurrence) {
  return startOfDay(o.end > o.start ? new Date(o.end.getTime() - 1) : o.start)
}

// ---------- Vue mois : barres réparties sur des lignes, semaine par semaine ----------

export type Segment = {
  occ: Occurrence
  startCol: number // 0 = lundi
  endCol: number
  lane: number
  continuesBefore: boolean // commence la semaine précédente
  continuesAfter: boolean // se poursuit la semaine suivante
}

const cols = (s: Segment) => Array.from({ length: s.endCol - s.startCol + 1 }, (_, i) => s.startCol + i)

export function weekSegments(occurrences: Occurrence[], weekStart: Date): Segment[] {
  const weekEnd = addDays(weekStart, 7)
  // Arrondi : les jours de changement d'heure font 23 ou 25 h
  const col = (d: Date) => Math.round((startOfDay(d).getTime() - weekStart.getTime()) / DAY_MS)

  const segs: Segment[] = occurrences
    .filter((o) => o.start < weekEnd && lastDay(o) >= weekStart)
    .map((o) => {
      const s = col(o.start)
      const e = col(lastDay(o))
      return { occ: o, startCol: Math.max(0, s), endCol: Math.min(6, e), lane: 0, continuesBefore: s < 0, continuesAfter: e > 6 }
    })

  // Comme Google : par jour de début, les plus longs d'abord, puis journée entière, puis par heure
  segs.sort(
    (a, b) =>
      a.startCol - b.startCol ||
      b.endCol - b.startCol - (a.endCol - a.startCol) ||
      Number(b.occ.event.all_day) - Number(a.occ.event.all_day) ||
      a.occ.start.getTime() - b.occ.start.getTime(),
  )

  const used: boolean[][] = []
  for (const s of segs) {
    let lane = 0
    while (used[lane] && cols(s).some((c) => used[lane][c])) lane++
    used[lane] ??= Array(7).fill(false)
    for (const c of cols(s)) used[lane][c] = true
    s.lane = lane
  }
  return segs
}

/** Ce qui tient dans une case de maxLanes lignes ; le reste est compté pour « +N » */
export function fitSegments(segs: Segment[], maxLanes: number) {
  const lanes = Math.max(1, maxLanes)
  const need = Array(7).fill(0)
  const total = Array(7).fill(0)
  for (const s of segs) {
    for (const c of cols(s)) {
      need[c] = Math.max(need[c], s.lane + 1)
      total[c]++
    }
  }
  // Une case qui déborde garde sa dernière ligne pour « +N »
  const limit = need.map((n) => (n > lanes ? lanes - 1 : lanes))
  const visible = segs.filter((s) => cols(s).every((c) => s.lane < limit[c]))
  const shown = Array(7).fill(0)
  for (const s of visible) for (const c of cols(s)) shown[c]++
  const more = total.map((t, c) => ({ count: t - shown[c], lane: limit[c] }))
  return { visible, more }
}

// ---------- Vue jour : colonne horaire, chevauchements côte à côte ----------

export type Placed = {
  occ: Occurrence
  top: number // minutes depuis minuit
  height: number // minutes
  col: number
  cols: number
}

export function dayLayout(occurrences: Occurrence[], day: Date, minMinutes = 20) {
  const dayStart = startOfDay(day)
  const dayEnd = addDays(dayStart, 1)
  const inDay = occurrences.filter((o) => o.start < dayEnd && (o.end > dayStart || o.start >= dayStart))

  // Journée entière, ou 24 h et plus : rangée du haut
  const allDay = inDay.filter((o) => o.event.all_day || o.end.getTime() - o.start.getTime() >= DAY_MS)
  const timed = inDay
    .filter((o) => !allDay.includes(o))
    .map((o) => {
      const s = Math.max(o.start.getTime(), dayStart.getTime())
      const e = Math.min(o.end.getTime(), dayEnd.getTime())
      const top = Math.min((s - dayStart.getTime()) / MIN, 24 * 60 - minMinutes)
      const height = Math.max((e - s) / MIN, minMinutes)
      return { occ: o, top, height, col: 0, cols: 1 }
    })
    .sort((a, b) => a.top - b.top || b.height - a.height)

  // Groupes d'événements qui se chevauchent ; chaque groupe se partage la largeur
  let group: Placed[] = []
  let groupEnd = -1
  let colEnds: number[] = []
  const close = () => group.forEach((p) => (p.cols = colEnds.length))
  for (const p of timed) {
    if (p.top >= groupEnd) {
      close()
      group = []
      colEnds = []
    }
    let c = colEnds.findIndex((end) => end <= p.top)
    if (c === -1) c = colEnds.push(0) - 1
    colEnds[c] = p.top + p.height
    p.col = c
    group.push(p)
    groupEnd = Math.max(groupEnd, p.top + p.height)
  }
  close()

  return { allDay, timed: timed as Placed[] }
}
