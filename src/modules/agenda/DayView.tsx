import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { useSpace } from '../../context/SpaceContext'
import { fmtTime, sameDay, startOfDay } from './dates'
import { dayLayout } from './layout'
import { chipStyle, eventColors } from './colors'
import { useFillHeight } from './useFillHeight'
import type { CalEvent, Occurrence } from './types'

const HOUR_PX = 52
const PX_PER_MIN = HOUR_PX / 60
const HOURS = Array.from({ length: 24 }, (_, h) => h)

type Props = {
  day: Date
  occurrences: Occurrence[]
  onOpen: (e: CalEvent) => void
  onAdd: (start: Date) => void
}

export default function DayView({ day, occurrences, onOpen, onAdd }: Props) {
  const { me, partner } = useSpace()
  const { ref, height } = useFillHeight<HTMLDivElement>()
  const scroller = useRef<HTMLDivElement>(null)
  const [now, setNow] = useState(() => new Date())
  const { allDay, timed } = dayLayout(occurrences, day)
  const isToday = sameDay(day, now)
  const nowMin = now.getHours() * 60 + now.getMinutes()

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  // À l'ouverture et à chaque changement de jour : l'heure actuelle, sinon le premier événement, sinon 8 h
  const firstTop = timed[0]?.top
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const target = isToday ? nowMin - 90 : firstTop !== undefined ? firstTop - 30 : 8 * 60
    el.scrollTop = Math.max(0, target * PX_PER_MIN)
  }, [day.getTime(), height === undefined])

  // Toucher un créneau vide : nouvel événement à la demi-heure touchée
  const addAt = (e: MouseEvent<HTMLDivElement>) => {
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top
    const minutes = Math.min(23 * 60 + 30, Math.max(0, Math.floor(y / PX_PER_MIN / 30) * 30))
    const start = startOfDay(day)
    start.setHours(0, minutes, 0, 0)
    onAdd(start)
  }

  return (
    <div className="ag-dayview" ref={ref} style={{ height }}>
      {allDay.length > 0 && (
        <div className="ag-dv-allday">
          {allDay.map((o) => (
            <button
              key={`${o.event.id}-${o.start.getTime()}`}
              className="ag-chip ag-dv-allday-chip"
              style={chipStyle(eventColors(o.event, me, partner), !!o.event.external)}
              onClick={() => onOpen(o.event)}
            >
              {o.event.title}
            </button>
          ))}
        </div>
      )}

      <div className="ag-dv-scroll" ref={scroller}>
        <div className="ag-dv-grid" style={{ height: 24 * HOUR_PX }}>
          {HOURS.map((h) => (
            <div key={h} className="ag-dv-hour" style={{ top: h * HOUR_PX }}>
              {h > 0 && <span>{String(h).padStart(2, '0')}:00</span>}
            </div>
          ))}

          <div className="ag-dv-slots" onClick={addAt} role="presentation">
            {timed.map((p) => {
              const ev = p.occ.event
              const px = p.height * PX_PER_MIN
              return (
                <button
                  key={`${ev.id}-${p.occ.start.getTime()}`}
                  className={`ag-dv-event${px < 34 ? ' is-short' : ''}`}
                  style={{
                    top: p.top * PX_PER_MIN,
                    height: px - 2,
                    left: `${(100 * p.col) / p.cols}%`,
                    width: `calc(${100 / p.cols}% - 3px)`,
                    ...chipStyle(eventColors(ev, me, partner), !!ev.external),
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpen(ev)
                  }}
                >
                  <span className="ag-dv-event-title">{ev.title}</span>
                  <span className="ag-dv-event-time">
                    {fmtTime(p.occ.start)} – {fmtTime(p.occ.end)}
                    {ev.location && px >= 60 ? ` · ${ev.location}` : ''}
                  </span>
                </button>
              )
            })}

            {isToday && <div className="ag-dv-now" style={{ top: nowMin * PX_PER_MIN }} aria-label={`Il est ${fmtTime(now)}`} />}
          </div>
        </div>
      </div>
    </div>
  )
}
