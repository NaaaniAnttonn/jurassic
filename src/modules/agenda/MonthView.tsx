import { useSpace } from '../../context/SpaceContext'
import { addDays, fmtDayLong, sameDay, startOfDay, startOfMonth, startOfWeek } from './dates'
import { onDay } from './recurrence'
import { eventColors } from './colors'
import EventCard from './EventCard'
import type { CalEvent, Occurrence } from './types'

const WEEKDAYS = [
  ['L', 'Lundi'], ['M', 'Mardi'], ['M', 'Mercredi'], ['J', 'Jeudi'], ['V', 'Vendredi'], ['S', 'Samedi'], ['D', 'Dimanche'],
]

type Props = {
  month: Date
  selected: Date
  occurrences: Occurrence[]
  onSelect: (d: Date) => void
  onOpen: (e: CalEvent) => void
}

export default function MonthView({ month, selected, occurrences, onSelect, onOpen }: Props) {
  const { me, partner } = useSpace()
  const gridStart = startOfWeek(startOfMonth(month))
  const today = startOfDay(new Date())
  const selectedItems = onDay(occurrences, selected)

  return (
    <div className="ag-month">
      <div className="ag-grid" role="grid" aria-label="Calendrier du mois">
        {WEEKDAYS.map(([short, long], i) => (
          <abbr key={i} className="ag-grid-head" title={long}>{short}</abbr>
        ))}
        {Array.from({ length: 42 }, (_, i) => {
          const day = addDays(gridStart, i)
          const items = onDay(occurrences, day)
          const dots = [...new Set(items.flatMap((o) => eventColors(o.event, me, partner)))].slice(0, 3)
          const cls = [
            'ag-cell',
            day.getMonth() !== month.getMonth() && 'is-out',
            sameDay(day, today) && 'is-today',
            sameDay(day, selected) && 'is-selected',
          ].filter(Boolean).join(' ')
          return (
            <button
              key={day.toISOString()}
              className={cls}
              onClick={() => onSelect(day)}
              aria-label={`${fmtDayLong(day)}, ${items.length} événement${items.length > 1 ? 's' : ''}`}
              aria-pressed={sameDay(day, selected)}
            >
              <span className="ag-cell-num">{day.getDate()}</span>
              <span className="ag-dots" aria-hidden="true">
                {dots.map((c) => <i key={c} style={{ background: c }} />)}
              </span>
            </button>
          )
        })}
      </div>

      <section className="ag-selected">
        <h2 className="ag-selected-title">{fmtDayLong(selected)}</h2>
        {selectedItems.length ? (
          <div className="ag-day-events">
            {selectedItems.map((o) => <EventCard key={`${o.event.id}-${o.start.getTime()}`} occ={o} day={selected} onOpen={onOpen} />)}
          </div>
        ) : (
          <p className="ag-nothing">Rien de prévu ce jour-là.</p>
        )}
      </section>
    </div>
  )
}
