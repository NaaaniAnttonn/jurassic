import { useCallback, useMemo, useState } from 'react'
import { IconChevronLeft, IconChevronRight, IconPlus } from '../../components/Icons'
import {
  addDays, addMonths, endOfDay, fmtMonthYear, fmtShort, fmtWeekRange, fmtWeekday, sameDay, startOfDay, startOfMonth, startOfWeek,
} from './dates'
import { expand } from './recurrence'
import { useEvents } from './useEvents'
import DayView from './DayView'
import WeekView from './WeekView'
import MonthView from './MonthView'
import EventSheet from './EventSheet'
import ExternalEventSheet from './ExternalEventSheet'
import type { CalEvent } from './types'
import './agenda.css'

type View = 'day' | 'week' | 'month'
const VIEWS: [View, string][] = [['day', 'Jour'], ['week', 'Semaine'], ['month', 'Mois']]
const VIEW_KEY = 'jurassic.agenda.view'

function savedView(): View {
  try {
    const v = localStorage.getItem(VIEW_KEY)
    return v === 'day' || v === 'month' ? v : 'week'
  } catch {
    return 'week'
  }
}

type Sheet = { event: CalEvent | null; date: Date; timed?: boolean }

export default function AgendaPage() {
  const { events, loading, error, reload } = useEvents()
  const [view, setView] = useState<View>(savedView)
  const [cursor, setCursor] = useState(() => startOfDay(new Date()))
  const [sheet, setSheet] = useState<Sheet | null>(null)

  const changeView = (v: View) => {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* stockage indisponible : pas grave */
    }
  }

  const weekStart = startOfWeek(cursor)
  const range = useMemo(() => {
    if (view === 'day') return { from: startOfDay(cursor), to: endOfDay(cursor) }
    const from = view === 'week' ? startOfWeek(cursor) : startOfWeek(startOfMonth(cursor))
    return { from, to: endOfDay(addDays(from, view === 'week' ? 6 : 41)) }
  }, [view, cursor])
  const occurrences = useMemo(() => expand(events, range.from, range.to), [events, range])

  const move = useCallback(
    (dir: 1 | -1) => {
      if (view === 'day') setCursor((c) => addDays(c, dir))
      else if (view === 'week') setCursor((c) => addDays(c, 7 * dir))
      else setCursor((c) => addMonths(c, dir))
    },
    [view],
  )

  const today = startOfDay(new Date())
  const newEventDate =
    view === 'day'
      ? cursor
      : view === 'week'
        ? today >= weekStart && today <= addDays(weekStart, 6) ? today : weekStart
        : cursor.getMonth() === today.getMonth() && cursor.getFullYear() === today.getFullYear() ? today : startOfMonth(cursor)

  // Depuis le mois, toucher une case ouvre ce jour (sans changer la vue mémorisée)
  const pickDay = useCallback((day: Date) => {
    setCursor(day)
    setView('day')
  }, [])

  const openEvent = useCallback((event: CalEvent) => setSheet({ event, date: new Date(event.start_at) }), [])
  const closeSheet = useCallback(() => setSheet(null), [])

  const period =
    view === 'day'
      ? `${fmtWeekday(cursor)} ${fmtShort(cursor)}${sameDay(cursor, today) ? ' · auj.' : ''}`
      : view === 'week'
        ? fmtWeekRange(weekStart)
        : fmtMonthYear(cursor)

  return (
    <div className={`agenda${view === 'week' ? '' : ' is-fill'}`}>
      <div className="ag-toolbar">
        <div className="segmented segmented-compact" role="tablist" aria-label="Affichage">
          {VIEWS.map(([v, label]) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => changeView(v)}>{label}</button>
          ))}
        </div>
        <div className="ag-nav">
          <button className="icon-btn" onClick={() => move(-1)} aria-label="Période précédente"><IconChevronLeft /></button>
          <button className="ag-period" onClick={() => setCursor(today)} title="Revenir à aujourd’hui">{period}</button>
          <button className="icon-btn" onClick={() => move(1)} aria-label="Période suivante"><IconChevronRight /></button>
        </div>
      </div>

      {error && <p className="msg msg-error">Impossible de charger l’agenda : {error}</p>}

      {loading ? (
        <p className="muted ag-loading">Chargement de l’agenda…</p>
      ) : view === 'day' ? (
        <DayView
          day={cursor}
          occurrences={occurrences}
          onOpen={openEvent}
          onAdd={(start) => setSheet({ event: null, date: start, timed: true })}
          onMove={move}
        />
      ) : view === 'week' ? (
        <WeekView weekStart={weekStart} occurrences={occurrences} onOpen={openEvent} onAdd={(d) => setSheet({ event: null, date: d })} />
      ) : (
        <MonthView month={cursor} occurrences={occurrences} onPick={pickDay} />
      )}

      <button className="fab" onClick={() => setSheet({ event: null, date: newEventDate })} aria-label="Nouvel événement">
        <IconPlus size={28} />
      </button>

      {sheet?.event?.external ? (
        <ExternalEventSheet event={sheet.event} onClose={closeSheet} />
      ) : (
        sheet && <EventSheet event={sheet.event} date={sheet.date} timed={sheet.timed} onClose={closeSheet} onSaved={reload} />
      )}
    </div>
  )
}
