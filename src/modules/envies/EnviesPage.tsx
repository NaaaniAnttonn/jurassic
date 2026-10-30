import { useCallback, useRef, useState } from 'react'
import { useSpace } from '../../context/SpaceContext'
import { IconCheck, IconChevronLeft, IconChevronRight, IconHeart, IconPlus } from '../../components/Icons'
import { fmtShort, toDateInput } from '../agenda/dates'
import { useWishes } from './useWishes'
import { useSignedUrls } from './photos'
import { notifyPartner } from './notify'
import { DEFAULT_CATEGORIES, categoriesOf, type Wish } from './types'
import WishSheet from './WishSheet'
import './envies.css'

type View = 'todo' | 'done'
const VIEW_KEY = 'jurassic.envies.vue'
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

function savedView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'done' ? 'done' : 'todo'
  } catch {
    return 'todo'
  }
}

const parse = (iso: string) => new Date(`${iso}T00:00:00`)

export default function EnviesPage() {
  const { me, partner } = useSpace()
  const { wishes, photos, loading, error, reload, patchWish } = useWishes()
  const [view, setView] = useState<View>(savedView)
  const [category, setCategory] = useState<string | null>(null) // filtre (null = toutes)
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [sheet, setSheet] = useState<{ wish: Wish | null } | null>(null)
  const [toast, setToast] = useState<{ text: string; undo: () => void } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()

  const changeView = (v: View) => {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* stockage indisponible : pas grave */
    }
  }
  const closeSheet = useCallback(() => setSheet(null), [])

  const categories = categoriesOf(wishes)
  const todo = wishes.filter((w) => !w.done_on)
  const done = wishes.filter((w) => w.done_on)

  // Vignette : la première photo de chaque envie
  const photosOf = (id: string) => photos.filter((p) => p.wish_id === id)
  const covers = new Map<string, string>()
  for (const p of photos) if (!covers.has(p.wish_id)) covers.set(p.wish_id, p.thumb_path)
  const coverUrls = useSignedUrls([...covers.values()])

  const thumb = (w: Wish) => {
    const path = covers.get(w.id)
    if (!path) return null
    const n = photosOf(w.id).length
    return (
      <span className="wish-thumb" aria-label={`${n} photo${n > 1 ? 's' : ''}`}>
        {coverUrls[path] && <img src={coverUrls[path]} alt="" />}
        {n > 1 && <span>{n}</span>}
      </span>
    )
  }

  const markDone = (w: Wish) => {
    if (!me) return
    const today = toDateInput(new Date())
    patchWish(w.id, { done_on: today, done_by: me.id })
    if (partner) notifyPartner(`${me.display_name} a coché une envie`, `« ${w.title} », réalisée aujourd’hui`)
    clearTimeout(toastTimer.current)
    setToast({ text: `« ${w.title} » réalisée aujourd’hui.`, undo: () => patchWish(w.id, { done_on: null, done_by: null }) })
    toastTimer.current = setTimeout(() => setToast(null), 5000)
  }

  if (loading) return <p className="muted wishes-loading">Chargement des envies…</p>

  // ---------- À faire : par catégorie ----------
  const todoView = () => {
    const shown = categories.filter((c) => (category ? c === category : true))
    const groups = shown.map((c) => ({ c, items: todo.filter((w) => w.category === c) })).filter((g) => g.items.length)
    return (
      <>
        <div className="wish-filter" role="radiogroup" aria-label="Catégorie">
          <button role="radio" aria-checked={category === null} className="chip" onClick={() => setCategory(null)}>
            Toutes <span>{todo.length}</span>
          </button>
          {categories.map((c) => {
            const n = todo.filter((w) => w.category === c).length
            if (!n && !DEFAULT_CATEGORIES.includes(c)) return null
            return (
              <button key={c} role="radio" aria-checked={category === c} className="chip" onClick={() => setCategory(c)}>
                {c} <span>{n}</span>
              </button>
            )
          })}
        </div>

        {groups.length === 0 && (
          <div className="empty">
            <div className="empty-icon"><IconHeart size={40} /></div>
            <p>{category ? `Rien dans « ${category} » pour l’instant.` : 'Notez ici tout ce que vous avez envie de faire ensemble.'}</p>
          </div>
        )}

        {groups.map(({ c, items }) => (
          <section key={c} className="wish-section">
            <h2 className="wish-section-title">{c} <span>{items.length}</span></h2>
            <ul className="wish-list">
              {items.map((w) => (
                <li key={w.id} className="wish-row">
                  <button type="button" role="checkbox" aria-checked={false} aria-label={`C’est fait : ${w.title}`} className="wish-check" onClick={() => markDone(w)} />
                  <button type="button" className="wish-main" onClick={() => setSheet({ wish: w })}>
                    <span className="wish-title">{w.title}</span>
                    {w.notes && <span className="wish-notes">{w.notes}</span>}
                  </button>
                  {thumb(w)}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </>
    )
  }

  // ---------- Réalisées : bilan de l'année ----------
  const doneView = () => {
    const years = [...new Set([new Date().getFullYear(), ...done.map((w) => parse(w.done_on!).getFullYear())])].sort()
    const ofYear = done.filter((w) => parse(w.done_on!).getFullYear() === year).sort((a, b) => b.done_on!.localeCompare(a.done_on!))
    const byCategory = categories.map((c) => ({ c, n: ofYear.filter((w) => w.category === c).length })).filter((x) => x.n)
    const months = MONTHS.map((label, m) => ({ label, items: ofYear.filter((w) => parse(w.done_on!).getMonth() === m) }))
      .filter((x) => x.items.length)
      .reverse()

    return (
      <>
        <div className="recap-year">
          <button className="icon-btn" onClick={() => setYear(year - 1)} disabled={year <= years[0]} aria-label="Année précédente"><IconChevronLeft /></button>
          <span>{year}</span>
          <button className="icon-btn" onClick={() => setYear(year + 1)} disabled={year >= years[years.length - 1]} aria-label="Année suivante"><IconChevronRight /></button>
        </div>

        <section className="card recap-summary">
          <p className="recap-total">
            <strong>{ofYear.length}</strong> {ofYear.length > 1 ? 'envies réalisées' : 'envie réalisée'} ensemble
          </p>
          {byCategory.length > 0 && (
            <ul className="recap-cats">
              {byCategory.map(({ c, n }) => <li key={c}>{c} <strong>{n}</strong></li>)}
            </ul>
          )}
        </section>

        {ofYear.length === 0 && <p className="muted wish-empty">Rien de coché en {year} pour l’instant.</p>}

        {months.map(({ label, items }) => (
          <section key={label} className="wish-section">
            <h2 className="wish-section-title">{label} <span>{items.length}</span></h2>
            <ul className="wish-list">
              {items.map((w) => (
                <li key={w.id} className="wish-row is-done">
                  <span className="wish-check" aria-hidden="true"><IconCheck size={16} /></span>
                  <button type="button" className="wish-main" onClick={() => setSheet({ wish: w })}>
                    <span className="wish-title">{w.title}</span>
                    <span className="wish-meta">
                      {fmtShort(parse(w.done_on!))} · {w.category}
                    </span>
                  </button>
                  {thumb(w)}
                </li>
              ))}
            </ul>
          </section>
        ))}
        {ofYear.length > 0 && <p className="muted small wish-hint">Touchez une envie pour changer sa date ou la remettre à faire.</p>}
      </>
    )
  }

  return (
    <div className="wishes">
      <div className="segmented segmented-compact" role="tablist" aria-label="Affichage">
        <button role="tab" aria-selected={view === 'todo'} onClick={() => changeView('todo')}>À faire</button>
        <button role="tab" aria-selected={view === 'done'} onClick={() => changeView('done')}>Réalisées</button>
      </div>

      {error && <p className="msg msg-error">Impossible de charger les envies : {error}</p>}

      {view === 'todo' ? todoView() : doneView()}

      <button className="fab" onClick={() => setSheet({ wish: null })} aria-label="Nouvelle envie">
        <IconPlus size={28} />
      </button>

      {toast && (
        <div className="msg msg-info toast toast-action" role="status">
          <span>{toast.text}</span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              toast.undo()
              setToast(null)
            }}
          >
            Annuler
          </button>
        </div>
      )}

      {sheet && (
        <WishSheet
          wish={sheet.wish}
          photos={sheet.wish ? photosOf(sheet.wish.id) : []}
          categories={categories}
          defaultCategory={category ?? DEFAULT_CATEGORIES[0]}
          onClose={closeSheet}
          onSaved={reload}
        />
      )}
    </div>
  )
}

