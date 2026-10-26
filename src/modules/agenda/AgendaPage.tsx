import { useCallback, useMemo, useState } from 'react'
import { IconChevronLeft, IconChevronRight, IconPlus } from '../../components/Icons'
import { addDays, addMonths, endOfDay, fmtMonthYear, fmtWeekRange, startOfDay, startOfMonth, startOfWeek } from './dates'
import { expand } from './recurrence'
import { useEvents } from './useEvents'
import WeekView from './WeekView'
import MonthView from './MonthView'
import EventSheet from './EventSheet'
import type { CalEvent } from './types'
import './agenda.css'

type View = 'week' | 'month'
const VIEW_KEY = 'jurassic.agenda.view'

function savedView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'month' ? 'month' : 'week'
  } catch {
    return 'week'
  }
}

export default function AgendaPage() {
  const { events, loading, error, reload } = useEvents()
  const [view, setView] = useState<View>(savedView)
  const [cursor, setCursor] = useState(() => startOfDay(new Date()))
  const [selected, setSelected] = useState(() => startOfDay(new Date()))
  const [sheet, setSheet] = useState<{ event: CalEvent | null; date: Date } | null>(null)

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
    const from = view === 'week' ? startOfWeek(cursor) : startOfWeek(startOfMonth(cursor))
    return { from, to: endOfDay(addDays(from, view === 'week' ? 6 : 41)) }
  }, [view, cursor])
  const occurrences = useMemo(() => expand(events, range.from, range.to), [events, range])

  const move = (dir: 1 | -1) => {
    if (view === 'week') {
      setCursor(addDays(cursor, 7 * dir))
    } else {
      const next = addMonths(cursor, dir)
      setCursor(next)
      setSelected(next)
    }
  }

  const goToday = () => {
    const t = startOfDay(new Date())
    setCursor(t)
    setSelected(t)
  }

  const today = startOfDay(new Date())
  const weekHasToday = today >= weekStart && today <= addDays(weekStart, 6)
  const newEventDate = view === 'month' ? selected : weekHasToday ? today : weekStart

  const openEvent = useCallback((event: CalEvent) => setSheet({ event, date: new Date(event.start_at) }), [])
  const closeSheet = useCallback(() => setSheet(null), [])

  return (
    <div className="agenda">
      <div className="ag-toolbar">
        <div className="segmented segmented-compact" role="tablist" aria-label="Affichage">
          <button role="tab" aria-selected={view === 'week'} onClick={() => changeView('week')}>Semaine</button>
          <button role="tab" aria-selected={view === 'month'} onClick={() => changeView('month')}>Mois</button>
        </div>
        <div className="ag-nav">
          <button className="icon-btn" onClick={() => move(-1)} aria-label="Période précédente"><IconChevronLeft /></button>
          <button className="ag-period" onClick={goToday} title="Revenir à aujourd’hui">
            {view === 'week' ? fmtWeekRange(weekStart) : fmtMonthYear(cursor)}
          </button>
          <button className="icon-btn" onClick={() => move(1)} aria-label="Période suivante"><IconChevronRight /></button>
        </div>
      </div>

      {error && <p className="msg msg-error">Impossible de charger l’agenda : {error}</p>}

      {loading ? (
        <p className="muted ag-loading">Chargement de l’agenda…</p>
      ) : view === 'week' ? (
        <WeekView weekStart={weekStart} occurrences={occurrences} onOpen={openEvent} onAdd={(d) => setSheet({ event: null, date: d })} />
      ) : (
        <MonthView month={cursor} selected={selected} occurrences={occurrences} onSelect={setSelected} onOpen={openEvent} />
      )}

      <button className="fab" onClick={() => setSheet({ event: null, date: newEventDate })} aria-label="Nouvel événement">
        <IconPlus size={28} />
      </button>

      {sheet && <EventSheet event={sheet.event} date={sheet.date} onClose={closeSheet} onSaved={reload} />}
    </div>
  )
}
