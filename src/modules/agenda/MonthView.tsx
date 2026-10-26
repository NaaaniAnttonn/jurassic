import { useSpace } from '../../context/SpaceContext'
import { addDays, fmtDayLong, sameDay, startOfDay, startOfMonth, startOfWeek } from './dates'
import { fitSegments, weekSegments } from './layout'
import { chipStyle, eventColors } from './colors'
import { useFillHeight } from './useFillHeight'
import type { Occurrence } from './types'

const WEEKDAYS = [
  ['L', 'Lundi'], ['M', 'Mardi'], ['M', 'Mercredi'], ['J', 'Jeudi'], ['V', 'Vendredi'], ['S', 'Samedi'], ['D', 'Dimanche'],
]
const HEAD_PX = 22 // rangée L M M J V S D
const NUM_PX = 24 // numéro du jour en haut de la case
const LANE_PX = 18 // une étiquette + son espacement

type Props = {
  month: Date
  occurrences: Occurrence[]
  onPick: (day: Date) => void
}

export default function MonthView({ month, occurrences, onPick }: Props) {
  const { me, partner } = useSpace()
  const { ref, height } = useFillHeight<HTMLDivElement>()
  const today = startOfDay(new Date())

  // 5 ou 6 semaines selon le mois
  const gridStart = startOfWeek(startOfMonth(month))
  const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1)
  const weeks = Math.ceil(Math.round((nextMonth.getTime() - gridStart.getTime()) / 86_400_000) / 7)
  const rowPx = height ? (height - HEAD_PX) / weeks : 96
  const maxLanes = Math.floor((rowPx - NUM_PX - 2) / LANE_PX)

  return (
    <div className="ag-month" ref={ref} style={{ height }}>
      <div className="ag-mhead" aria-hidden="true">
        {WEEKDAYS.map(([short, long], i) => (
          <abbr key={i} title={long}>{short}</abbr>
        ))}
      </div>
      <div className="ag-mweeks" style={{ gridTemplateRows: `repeat(${weeks}, minmax(0, 1fr))` }}>
        {Array.from({ length: weeks }, (_, w) => {
          const weekStart = addDays(gridStart, 7 * w)
          const { visible, more } = fitSegments(weekSegments(occurrences, weekStart), maxLanes)
          return (
            <div key={weekStart.toISOString()} className="ag-mweek">
              {Array.from({ length: 7 }, (_, i) => {
                const day = addDays(weekStart, i)
                const count = visible.filter((s) => s.startCol <= i && s.endCol >= i).length + more[i].count
                const cls = ['ag-mcell', day.getMonth() !== month.getMonth() && 'is-out', sameDay(day, today) && 'is-today']
                  .filter(Boolean).join(' ')
                return (
                  <button
                    key={i}
                    className={cls}
                    onClick={() => onPick(day)}
                    aria-label={`${fmtDayLong(day)}, ${count ? `${count} événement${count > 1 ? 's' : ''}` : 'rien de prévu'}`}
                  >
                    <span className="ag-mnum">{day.getDate()}</span>
                  </button>
                )
              })}

              <div className="ag-mlayer" aria-hidden="true">
                {visible.map((s) => {
                  const ev = s.occ.event
                  const cls = ['ag-chip', s.continuesBefore && 'cont-before', s.continuesAfter && 'cont-after'].filter(Boolean).join(' ')
                  return (
                    <span
                      key={`${ev.id}-${s.occ.start.getTime()}`}
                      className={cls}
                      style={{
                        gridColumn: `${s.startCol + 1} / ${s.endCol + 2}`,
                        gridRow: s.lane + 1,
                        ...chipStyle(eventColors(ev, me, partner), !!ev.external),
                      }}
                    >
                      {ev.title}
                    </span>
                  )
                })}
                {more.map((m, c) =>
                  m.count > 0 ? (
                    <span key={`more-${c}`} className="ag-more" style={{ gridColumn: c + 1, gridRow: m.lane + 1 }}>
                      +{m.count}
                    </span>
                  ) : null,
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
