import { addDays, fmtDayLong, fmtWeekday, sameDay, startOfDay } from './dates'
import { onDay } from './recurrence'
import EventCard from './EventCard'
import type { CalEvent, Occurrence } from './types'

type Props = {
  weekStart: Date
  occurrences: Occurrence[]
  onOpen: (e: CalEvent) => void
  onAdd: (day: Date) => void
}

export default function WeekView({ weekStart, occurrences, onOpen, onAdd }: Props) {
  const today = startOfDay(new Date())

  return (
    <div className="ag-week">
      {Array.from({ length: 7 }, (_, i) => {
        const day = addDays(weekStart, i)
        const items = onDay(occurrences, day)
        const cls = ['ag-day', sameDay(day, today) && 'is-today', day < today && 'is-past'].filter(Boolean).join(' ')
        return (
          <section key={day.toISOString()} className={cls}>
            <button className="ag-day-head" onClick={() => onAdd(day)} aria-label={`Ajouter un événement : ${fmtDayLong(day)}`}>
              <span className="ag-day-name">{fmtWeekday(day)}</span>
              <span className="ag-day-num">{day.getDate()}</span>
            </button>
            <div className="ag-day-events">
              {items.length ? (
                items.map((o) => <EventCard key={`${o.event.id}-${o.start.getTime()}`} occ={o} day={day} onOpen={onOpen} />)
              ) : (
                <p className="ag-nothing">Rien de prévu</p>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
