import { useEffect, useState, type FormEvent } from 'react'
import { useSpace } from '../../context/SpaceContext'
import { errorMessage, supabase } from '../../lib/supabase'
import { sendPush } from '../../lib/push'
import { addDays, toDateInput } from '../agenda/dates'
import { RECURRENCE_LABELS, type Recurrence } from '../agenda/types'
import { fmtDue, todayISO } from './due'
import type { Task } from './types'

type Who = 'me' | 'partner' | 'both'
type Props = { task: Task | null; onClose: () => void; onSaved: () => void }

export default function TaskSheet({ task, onClose, onSaved }: Props) {
  const { space, me, partner } = useSpace()
  const isNew = !task
  const initialWho = (): Who => {
    if (!task || !me) return 'me'
    const hasMe = task.for_users.includes(me.id)
    const hasPartner = !!partner && task.for_users.includes(partner.id)
    return hasMe && hasPartner ? 'both' : hasPartner ? 'partner' : 'me'
  }
  const [title, setTitle] = useState(task?.title ?? '')
  const [notes, setNotes] = useState(task?.notes ?? '')
  const [who, setWho] = useState<Who>(initialWho)
  const [due, setDue] = useState(task?.due_date ?? '')
  const [recurrence, setRecurrence] = useState<Recurrence | ''>(task?.recurrence ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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

  const today = todayISO()
  const tomorrow = toDateInput(addDays(new Date(), 1))

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!space || !me) return
    const t = title.trim()
    if (!t) return setError('Donne un titre à la tâche.')

    const forUsers = who === 'me' || !partner ? [me.id] : who === 'partner' ? [partner.id] : [me.id, partner.id]
    const row = {
      title: t,
      notes: notes.trim() || null,
      for_users: forUsers,
      // Une tâche répétée a toujours une échéance : aujourd'hui par défaut
      due_date: due || (recurrence ? today : null),
      recurrence: recurrence || null,
    }

    setBusy(true)
    const { error: dbError } = isNew
      ? await supabase.from('tasks').insert({ ...row, space_id: space.id, created_by: me.id })
      : await supabase.from('tasks').update(row).eq('id', task.id)
    setBusy(false)
    if (dbError) return setError(errorMessage(dbError))

    // Tâche confiée à l'autre (à la création, ou quand on l'ajoute ensuite)
    const wasForPartner = !!partner && !!task?.for_users.includes(partner.id)
    if (partner && forUsers.includes(partner.id) && !wasForPartner) {
      const whom = forUsers.length > 1 ? 'pour vous deux' : 'pour toi'
      const when = row.due_date ? ` · ${fmtDue(row.due_date)}` : ''
      sendPush({ target: 'partner', title: `${me.display_name} a ajouté une tâche ${whom}`, body: `${t}${when}`, url: '/taches' }).catch(
        () => undefined,
      )
    }
    onSaved()
    onClose()
  }

  const remove = async () => {
    if (!task || !confirm('Supprimer cette tâche ?')) return
    setBusy(true)
    const { error: dbError } = await supabase.from('tasks').delete().eq('id', task.id)
    setBusy(false)
    if (dbError) return setError(errorMessage(dbError))
    onSaved()
    onClose()
  }

  const whoOptions: [Who, string][] = partner
    ? [['me', 'Moi'], ['partner', partner.display_name], ['both', 'Nous deux']]
    : [['me', 'Moi']]
  const dueOptions: [string, string][] = [[today, 'Aujourd’hui'], [tomorrow, 'Demain'], ['', 'Sans date']]

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet" role="dialog" aria-modal="true" aria-labelledby="task-sheet-title" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <header className="sheet-head">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <h2 id="task-sheet-title">{isNew ? 'Nouvelle tâche' : 'Modifier'}</h2>
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>Enregistrer</button>
        </header>

        <div className="sheet-body">
          <input
            className="sheet-title-input"
            placeholder="Titre"
            aria-label="Titre"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus={isNew}
            maxLength={200}
          />

          <div className="field">
            <span>Pour qui</span>
            <div className="chips" role="radiogroup" aria-label="Pour qui">
              {whoOptions.map(([value, label]) => (
                <button key={value} type="button" role="radio" aria-checked={who === value} className="chip" onClick={() => setWho(value)}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span>Échéance</span>
            <div className="chips" role="radiogroup" aria-label="Échéance rapide">
              {dueOptions.map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  role="radio"
                  aria-checked={due === value}
                  className="chip"
                  onClick={() => {
                    setDue(value)
                    if (!value) setRecurrence('')
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <input type="date" aria-label="Date d’échéance" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>

          <label className="field">
            <span>Répéter</span>
            <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence | '')}>
              <option value="">Jamais</option>
              {Object.entries(RECURRENCE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            {recurrence && (
              <small className="muted">
                Cocher la tâche la reprogramme à la prochaine échéance{due ? '' : ' (à partir d’aujourd’hui)'}.
              </small>
            )}
          </label>

          <label className="field">
            <span>Notes</span>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Facultatif" maxLength={2000} />
          </label>

          {error && <p className="msg msg-error">{error}</p>}

          {!isNew && (
            <button type="button" className="btn btn-danger btn-block" onClick={remove} disabled={busy}>
              Supprimer la tâche
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
