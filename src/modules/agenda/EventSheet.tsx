import { useEffect, useState, type FormEvent } from 'react'
import { useSpace } from '../../context/SpaceContext'
import { errorMessage, supabase, type Profile } from '../../lib/supabase'
import { sendPush } from '../../lib/push'
import { fmtWhen, fromInputs, sameDay, toDateInput, toTimeInput } from './dates'
import { RECURRENCE_LABELS, type CalEvent, type Recurrence } from './types'

type Who = 'me' | 'partner' | 'both'

const REMINDERS_TIMED: [string, string][] = [
  ['', 'Aucun'], ['0', 'Au début'], ['15', '15 min avant'], ['30', '30 min avant'],
  ['60', '1 h avant'], ['120', '2 h avant'], ['1440', 'La veille, même heure'],
]
const REMINDERS_ALLDAY: [string, string][] = [
  ['', 'Aucun'], ['0', 'Le jour même à 9 h'], ['1440', 'La veille à 9 h'],
]

type Form = {
  title: string
  allDay: boolean
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  location: string
  notes: string
  who: Who
  recurrence: Recurrence | ''
  until: string
  reminder: string
  isPrivate: boolean
}

function initialForm(ev: CalEvent | null, date: Date, me: Profile | null, partner: Profile | null): Form {
  if (ev) {
    const s = new Date(ev.start_at)
    const e = new Date(ev.end_at)
    const hasMe = !!me && ev.for_users.includes(me.id)
    const hasPartner = !!partner && ev.for_users.includes(partner.id)
    return {
      title: ev.title,
      allDay: ev.all_day,
      startDate: toDateInput(s),
      startTime: ev.all_day ? '09:00' : toTimeInput(s),
      endDate: toDateInput(e),
      endTime: ev.all_day ? '10:00' : toTimeInput(e),
      location: ev.location ?? '',
      notes: ev.notes ?? '',
      who: hasMe && hasPartner ? 'both' : hasPartner ? 'partner' : 'me',
      recurrence: ev.recurrence ?? '',
      until: ev.recurrence_until ?? '',
      reminder: ev.reminder_minutes === null ? '' : String(ev.reminder_minutes),
      isPrivate: ev.is_private,
    }
  }
  const now = new Date()
  const start = new Date(date)
  if (sameDay(date, now)) {
    start.setHours(now.getHours() + 1, 0, 0, 0)
  } else {
    start.setHours(9, 0, 0, 0)
  }
  const end = new Date(start.getTime() + 3_600_000)
  return {
    title: '', allDay: false,
    startDate: toDateInput(start), startTime: toTimeInput(start),
    endDate: toDateInput(end), endTime: toTimeInput(end),
    location: '', notes: '', who: partner ? 'both' : 'me',
    recurrence: '', until: '', reminder: '', isPrivate: false,
  }
}

type Props = { event: CalEvent | null; date: Date; onClose: () => void; onSaved: () => void }

export default function EventSheet({ event, date, onClose, onSaved }: Props) {
  const { space, me, partner } = useSpace()
  const [f, setF] = useState<Form>(() => initialForm(event, date, me, partner))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const isNew = !event
  const canChangePrivacy = isNew || event.created_by === me?.id

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setF((prev) => ({ ...prev, [key]: value }))

  // Fermeture avec Échap + blocage du défilement derrière
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const changeStartDate = (v: string) =>
    setF((p) => ({ ...p, startDate: v, endDate: p.endDate < v ? v : p.endDate }))

  const changeStartTime = (v: string) =>
    setF((p) => {
      if (p.startDate !== p.endDate || p.endTime > v) return { ...p, startTime: v }
      const end = new Date(fromInputs(p.startDate, v).getTime() + 3_600_000)
      return sameDay(end, fromInputs(p.startDate, v))
        ? { ...p, startTime: v, endTime: toTimeInput(end) }
        : { ...p, startTime: v, endTime: '23:59' }
    })

  const toggleAllDay = (allDay: boolean) =>
    setF((p) => {
      const list = allDay ? REMINDERS_ALLDAY : REMINDERS_TIMED
      return { ...p, allDay, reminder: list.some(([v]) => v === p.reminder) ? p.reminder : '' }
    })

  const notifyPartner = (verb: string, forUsers: string[], when: string, title: string) => {
    if (!partner || !me || f.isPrivate || !forUsers.includes(partner.id)) return
    sendPush({ target: 'partner', title: `${me.display_name} a ${verb} un événement`, body: `${title}\n${when}`, url: '/agenda' }).catch(
      () => undefined,
    )
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!me || !space) return
    setError('')

    const title = f.title.trim()
    const start = f.allDay ? fromInputs(f.startDate, '00:00') : fromInputs(f.startDate, f.startTime)
    const end = f.allDay ? new Date(`${f.endDate}T23:59:59`) : fromInputs(f.endDate, f.endTime)
    if (!title) return setError('Donne un titre à l’événement.')
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return setError('Vérifie les dates et les heures.')
    if (end < start) return setError('La fin doit être après le début.')
    if (f.recurrence && f.until && f.until < f.startDate) return setError('La date de fin de répétition est avant le début.')

    const forUsers = f.isPrivate
      ? [me.id]
      : f.who === 'me' || !partner
        ? [me.id]
        : f.who === 'partner'
          ? [partner.id]
          : [me.id, partner.id]

    const row = {
      title,
      location: f.location.trim() || null,
      notes: f.notes.trim() || null,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      all_day: f.allDay,
      recurrence: f.recurrence || null,
      recurrence_until: f.recurrence && f.until ? f.until : null,
      for_users: forUsers,
      is_private: f.isPrivate,
      reminder_minutes: f.reminder === '' ? null : Number(f.reminder),
    }

    setBusy(true)
    const { error: dbError } = isNew
      ? await supabase.from('events').insert({ ...row, space_id: space.id, created_by: me.id })
      : await supabase.from('events').update(row).eq('id', event.id)
    setBusy(false)
    if (dbError) return setError(errorMessage(dbError))

    notifyPartner(isNew ? 'ajouté' : 'modifié', forUsers, fmtWhen(start, end, f.allDay), title)
    onSaved()
    onClose()
  }

  const remove = async () => {
    if (!event) return
    const question = event.recurrence ? 'Supprimer toutes les occurrences de cet événement ?' : 'Supprimer cet événement ?'
    if (!confirm(question)) return
    setBusy(true)
    const { error: dbError } = await supabase.from('events').delete().eq('id', event.id)
    setBusy(false)
    if (dbError) return setError(errorMessage(dbError))
    notifyPartner('supprimé', event.for_users, fmtWhen(new Date(event.start_at), new Date(event.end_at), event.all_day), event.title)
    onSaved()
    onClose()
  }

  const reminders = f.allDay ? REMINDERS_ALLDAY : REMINDERS_TIMED
  const whoOptions: [Who, string][] = partner
    ? [['me', 'Moi'], ['partner', partner.display_name], ['both', 'Nous deux']]
    : [['me', 'Moi']]

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={save}
      >
        <header className="sheet-head">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <h2 id="sheet-title">{isNew ? 'Nouvel événement' : 'Modifier'}</h2>
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>Enregistrer</button>
        </header>

        <div className="sheet-body">
          <input
            className="sheet-title-input"
            placeholder="Titre"
            aria-label="Titre"
            value={f.title}
            onChange={(e) => set('title', e.target.value)}
            autoFocus={isNew}
            maxLength={200}
          />

          <label className="switch-row">
            <span>Journée entière</span>
            <input type="checkbox" role="switch" checked={f.allDay} onChange={(e) => toggleAllDay(e.target.checked)} />
          </label>

          <div className="datetime-row">
            <span className="datetime-label">Début</span>
            <input type="date" aria-label="Date de début" value={f.startDate} onChange={(e) => changeStartDate(e.target.value)} required />
            {!f.allDay && <input type="time" aria-label="Heure de début" value={f.startTime} onChange={(e) => changeStartTime(e.target.value)} required />}
          </div>
          <div className="datetime-row">
            <span className="datetime-label">Fin</span>
            <input type="date" aria-label="Date de fin" value={f.endDate} min={f.startDate} onChange={(e) => set('endDate', e.target.value)} required />
            {!f.allDay && <input type="time" aria-label="Heure de fin" value={f.endTime} onChange={(e) => set('endTime', e.target.value)} required />}
          </div>

          <div className="field">
            <span>Pour qui</span>
            <div className="chips" role="radiogroup" aria-label="Pour qui">
              {whoOptions.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={(f.isPrivate ? 'me' : f.who) === value}
                  disabled={f.isPrivate}
                  className="chip"
                  onClick={() => set('who', value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {canChangePrivacy && (
            <label className="switch-row">
              <span>
                Privé
                <small>Visible uniquement par toi</small>
              </span>
              <input type="checkbox" role="switch" checked={f.isPrivate} onChange={(e) => set('isPrivate', e.target.checked)} />
            </label>
          )}

          <div className="field-pair">
            <label className="field">
              <span>Répéter</span>
              <select value={f.recurrence} onChange={(e) => set('recurrence', e.target.value as Recurrence | '')}>
                <option value="">Jamais</option>
                {Object.entries(RECURRENCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            {f.recurrence && (
              <label className="field">
                <span>Jusqu’au (facultatif)</span>
                <input type="date" value={f.until} min={f.startDate} onChange={(e) => set('until', e.target.value)} />
              </label>
            )}
          </div>

          <label className="field">
            <span>Rappel</span>
            <select value={f.reminder} onChange={(e) => set('reminder', e.target.value)}>
              {reminders.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Lieu</span>
            <input value={f.location} onChange={(e) => set('location', e.target.value)} placeholder="Facultatif" />
          </label>

          <label className="field">
            <span>Notes</span>
            <textarea rows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Facultatif" />
          </label>

          {!isNew && event.recurrence && (
            <p className="muted small">Les modifications s’appliquent à toutes les occurrences.</p>
          )}
          {error && <p className="msg msg-error">{error}</p>}

          {!isNew && (
            <button type="button" className="btn btn-danger btn-block" onClick={remove} disabled={busy}>
              Supprimer l’événement
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
