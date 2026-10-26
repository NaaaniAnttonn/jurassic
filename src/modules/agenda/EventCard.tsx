import { useSpace } from '../../context/SpaceContext'
import { IconBell, IconLock, IconRepeat } from '../../components/Icons'
import { fmtTime, sameDay } from './dates'
import { barStyle, eventColors, whoLabel } from './colors'
import type { CalEvent, Occurrence } from './types'

export default function EventCard({ occ, day, onOpen }: { occ: Occurrence; day: Date; onOpen: (e: CalEvent) => void }) {
  const { me, partner } = useSpace()
  const { event, start, end } = occ
  const startsToday = sameDay(start, day)
  const endsToday = sameDay(end, day)

  let time: string
  if (event.all_day) time = 'Journée'
  else if (startsToday) time = fmtTime(start)
  else if (endsToday) time = `→ ${fmtTime(end)}`
  else time = 'Journée'

  return (
    <button className="ag-event" onClick={() => onOpen(event)}>
      <span className="ag-event-bar" style={barStyle(eventColors(event, me, partner))} aria-hidden="true" />
      <span className={`ag-event-time${time === 'Journée' ? ' is-allday' : ''}`}>
        {time}
        {!event.all_day && startsToday && endsToday && <small>{fmtTime(end)}</small>}
      </span>
      <span className="ag-event-main">
        <span className="ag-event-title">{event.title}</span>
        <span className="ag-event-meta">
          <span>{whoLabel(event, me, partner)}</span>
          {event.location && <span>{event.location}</span>}
          {event.recurrence && <IconRepeat size={14} />}
          {event.reminder_minutes !== null && <IconBell size={14} />}
          {event.is_private && <IconLock size={14} />}
        </span>
      </span>
    </button>
  )
}
