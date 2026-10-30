import { useCallback, useRef, useState } from 'react'
import { useSpace } from '../../context/SpaceContext'
import { errorMessage, supabase } from '../../lib/supabase'
import { sendPush } from '../../lib/push'
import { IconCheck, IconPlus, IconRepeat, IconTaches } from '../../components/Icons'
import { useTasks } from './useTasks'
import { SECTION_LABELS, fmtDue, nextDue, sectionOf, todayISO, type Section } from './due'
import TaskSheet from './TaskSheet'
import type { Task } from './types'
import './todo.css'

type Filter = 'all' | 'mine'
const FILTER_KEY = 'jurassic.taches.filtre'
const SECTIONS: Section[] = ['late', 'today', 'week', 'later', 'none']

function savedFilter(): Filter {
  try {
    return localStorage.getItem(FILTER_KEY) === 'mine' ? 'mine' : 'all'
  } catch {
    return 'all'
  }
}

type Toast = { text: string; undo?: () => void }

export default function TodoPage() {
  const { me, partner } = useSpace()
  const { tasks, loading, error, setError, reload, patchTasks, setTasks } = useTasks()
  const [filter, setFilter] = useState<Filter>(savedFilter)
  const [sheet, setSheet] = useState<{ task: Task | null } | null>(null)
  const [showDone, setShowDone] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()

  const changeFilter = (f: Filter) => {
    setFilter(f)
    try {
      localStorage.setItem(FILTER_KEY, f)
    } catch {
      /* stockage indisponible : pas grave */
    }
  }

  const showToast = (t: Toast) => {
    clearTimeout(toastTimer.current)
    setToast(t)
    toastTimer.current = setTimeout(() => setToast(null), 5000)
  }

  const closeSheet = useCallback(() => setSheet(null), [])

  const today = todayISO()
  const visible = tasks.filter((t) => filter === 'all' || (me && t.for_users.includes(me.id)))
  const open = visible.filter((t) => !t.done)
  const done = visible.filter((t) => t.done).sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? ''))

  const who = (t: Task) => {
    const hasMe = !!me && t.for_users.includes(me.id)
    const hasPartner = !!partner && t.for_users.includes(partner.id)
    const label = hasMe && hasPartner ? 'Vous deux' : hasPartner ? partner!.display_name : 'Toi'
    const colors = [hasMe && me!.color, hasPartner && partner!.color].filter(Boolean) as string[]
    return { label, colors: colors.length ? colors : ['var(--muted)'] }
  }

  // L'autre est prévenu(e) quand on termine une tâche qu'il/elle avait créée
  const notifyDone = (t: Task) => {
    if (!partner || !me || t.created_by !== partner.id) return
    sendPush({ target: 'partner', title: `${me.display_name} a terminé une tâche`, body: t.title, url: '/taches' }).catch(() => undefined)
  }

  const toggle = async (t: Task) => {
    if (!me) return
    if (t.done) {
      patchTasks([t.id], { done: false, done_at: null, done_by: null })
      return
    }
    if (t.recurrence && t.due_date) {
      // Tâche répétée : on la reprogramme au lieu de la terminer
      const previous = t.due_date
      const next = nextDue(t.due_date, t.recurrence, today)
      await patchTasks([t.id], { due_date: next })
      notifyDone(t)
      showToast({ text: `« ${t.title} » reprogrammée : ${fmtDue(next, today)}`, undo: () => patchTasks([t.id], { due_date: previous }) })
      return
    }
    await patchTasks([t.id], { done: true, done_at: new Date().toISOString(), done_by: me.id })
    notifyDone(t)
    showToast({ text: `« ${t.title} » terminée.`, undo: () => patchTasks([t.id], { done: false, done_at: null, done_by: null }) })
  }

  const clearDone = async () => {
    if (!confirm(`Effacer les ${done.length} tâche${done.length > 1 ? 's' : ''} terminée${done.length > 1 ? 's' : ''} ?`)) return
    const ids = done.map((t) => t.id)
    setTasks((prev) => prev.filter((t) => !ids.includes(t.id)))
    const { error: dbError } = await supabase.from('tasks').delete().in('id', ids)
    if (dbError) {
      setError(errorMessage(dbError))
      reload()
    }
  }

  const row = (t: Task) => {
    const w = who(t)
    const section = sectionOf(t.due_date, today)
    return (
      <li key={t.id} className={`task-row${t.done ? ' is-done' : ''}`}>
        <button
          type="button"
          role="checkbox"
          aria-checked={t.done}
          aria-label={t.done ? `Rouvrir ${t.title}` : t.recurrence ? `Fait : ${t.title} (reprogrammer)` : `Terminer ${t.title}`}
          className="task-check"
          style={{ borderColor: t.done ? undefined : w.colors[0] }}
          onClick={() => toggle(t)}
        >
          {t.done && <IconCheck size={16} />}
        </button>
        <button type="button" className="task-main" onClick={() => setSheet({ task: t })}>
          <span className="task-title">{t.title}</span>
          <span className="task-meta">
            <span className="task-who">
              {w.colors.map((c) => <i key={c} style={{ background: c }} aria-hidden="true" />)}
              {w.label}
            </span>
            {t.due_date && !t.done && (section === 'late' || section === 'week' || section === 'later') && (
              <span className={section === 'late' ? 'task-late' : undefined}>{fmtDue(t.due_date, today)}</span>
            )}
            {t.recurrence && <IconRepeat size={14} />}
            {t.notes && <span className="task-notes">{t.notes}</span>}
          </span>
        </button>
      </li>
    )
  }

  if (loading) return <p className="muted tasks-loading">Chargement des tâches…</p>

  return (
    <div className="tasks">
      <div className="segmented segmented-compact tasks-filter" role="tablist" aria-label="Filtre">
        <button role="tab" aria-selected={filter === 'all'} onClick={() => changeFilter('all')}>Toutes</button>
        <button role="tab" aria-selected={filter === 'mine'} onClick={() => changeFilter('mine')}>Les miennes</button>
      </div>

      {error && <p className="msg msg-error">Impossible de charger les tâches : {error}</p>}

      {open.length === 0 && (
        <div className="empty">
          <div className="empty-icon"><IconTaches size={40} /></div>
          <p>{done.length ? 'Tout est fait. Bravo !' : 'Rien à faire pour l’instant.'}</p>
        </div>
      )}

      {SECTIONS.map((s) => {
        const list = open.filter((t) => sectionOf(t.due_date, today) === s)
        if (!list.length) return null
        return (
          <section key={s} className={`tasks-section is-${s}`}>
            <h2 className="tasks-section-title">
              {SECTION_LABELS[s]} <span>{list.length}</span>
            </h2>
            <ul className="tasks-list">{list.map(row)}</ul>
          </section>
        )
      })}

      {done.length > 0 && (
        <section className="tasks-section tasks-done">
          <div className="tasks-done-head">
            <button className="tasks-done-toggle" onClick={() => setShowDone(!showDone)} aria-expanded={showDone}>
              {done.length} terminée{done.length > 1 ? 's' : ''}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={clearDone}>Effacer</button>
          </div>
          {showDone && <ul className="tasks-list">{done.map(row)}</ul>}
        </section>
      )}

      <button className="fab" onClick={() => setSheet({ task: null })} aria-label="Nouvelle tâche">
        <IconPlus size={28} />
      </button>

      {toast && (
        <div className="msg msg-info toast toast-action" role="status">
          <span>{toast.text}</span>
          {toast.undo && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                toast.undo?.()
                setToast(null)
              }}
            >
              Annuler
            </button>
          )}
        </div>
      )}

      {sheet && <TaskSheet task={sheet.task} onClose={closeSheet} onSaved={reload} />}
    </div>
  )
}
