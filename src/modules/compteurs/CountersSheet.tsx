import { useEffect, useState, type FormEvent } from 'react'
import { useSpace } from '../../context/SpaceContext'
import { errorMessage, supabase } from '../../lib/supabase'
import { IconClose } from '../../components/Icons'
import { fmtDayLong, toDateInput } from '../agenda/dates'
import { daysBetween, elapsed, fmtElapsed, fmtIn, nextAnniversary } from './dates'
import type { Countdown } from './useCountdowns'

type Props = { countdowns: Countdown[]; onChanged: () => void; onClose: () => void }

const longDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`)
  return `${fmtDayLong(d)} ${d.getFullYear()}`
}

export default function CountersSheet({ countdowns, onChanged, onClose }: Props) {
  const { space, me, refresh } = useSpace()
  const today = toDateInput(new Date())
  const metOn = space?.met_on ?? null
  const [metInput, setMetInput] = useState(metOn ?? '')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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

  const saveMetOn = async () => {
    if (!space) return
    const { error: dbError } = await supabase.from('spaces').update({ met_on: metInput || null }).eq('id', space.id)
    if (dbError) return setError(errorMessage(dbError))
    setError('')
    refresh()
  }

  const add = async (e: FormEvent) => {
    e.preventDefault()
    if (!space || !me) return
    const t = title.trim()
    if (!t || !date) return setError('Donne un nom et une date.')
    if (date < today) return setError('Choisis une date à venir.')
    setBusy(true)
    const { error: dbError } = await supabase.from('countdowns').insert({ space_id: space.id, title: t, date, created_by: me.id })
    setBusy(false)
    if (dbError) return setError(errorMessage(dbError))
    setTitle('')
    setDate('')
    setError('')
    onChanged()
  }

  const remove = async (c: Countdown) => {
    if (!confirm(`Supprimer « ${c.title} » ?`)) return
    const { error: dbError } = await supabase.from('countdowns').delete().eq('id', c.id)
    if (dbError) return setError(errorMessage(dbError))
    onChanged()
  }

  const since = metOn && metOn <= today ? elapsed(metOn, today) : null
  const anniv = metOn && metOn <= today ? nextAnniversary(metOn, today) : null

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="counters-title" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Fermer</button>
          <h2 id="counters-title">Compteurs</h2>
          <span />
        </header>

        <div className="sheet-body">
          <section className="card counters-together">
            {since && anniv ? (
              <>
                <p className="counters-big">{fmtElapsed(since)}</p>
                <p className="muted">
                  ensemble · {since.total.toLocaleString('fr-FR')} jour{since.total > 1 ? 's' : ''} depuis le {longDate(metOn!).toLowerCase()}
                </p>
                {anniv.years > 0 && (
                  <p className="counters-anniv">
                    {anniv.inDays === 0
                      ? `Joyeux anniversaire : ${anniv.years} an${anniv.years > 1 ? 's' : ''} aujourd’hui !`
                      : `${anniv.years} an${anniv.years > 1 ? 's' : ''} ${fmtIn(anniv.inDays)}`}
                  </p>
                )}
              </>
            ) : (
              <p className="muted">Indiquez votre date de rencontre pour voir le temps passé ensemble.</p>
            )}
            <div className="counters-met">
              <label className="field">
                <span>Date de rencontre</span>
                <input type="date" value={metInput} max={today} onChange={(e) => setMetInput(e.target.value)} />
              </label>
              <button className="btn btn-secondary btn-sm" onClick={saveMetOn} disabled={(metInput || null) === metOn}>Enregistrer</button>
            </div>
          </section>

          <h3 className="counters-subtitle">Comptes à rebours</h3>
          {countdowns.length === 0 && <p className="muted small">Vacances, anniversaire, concert… ajoutez une date à attendre.</p>}
          <ul className="counters-list">
            {countdowns.map((c) => {
              const n = daysBetween(today, c.date)
              return (
                <li key={c.id} className="counters-item">
                  <span className="counters-days">
                    {n === 0 ? 'J' : <>{n}<small>{n > 1 ? 'jours' : 'jour'}</small></>}
                  </span>
                  <span className="counters-item-main">
                    <span className="counters-item-title">{c.title}</span>
                    <span className="muted small">{longDate(c.date)}</span>
                  </span>
                  <button className="icon-btn" onClick={() => remove(c)} aria-label={`Supprimer ${c.title}`}><IconClose size={18} /></button>
                </li>
              )
            })}
          </ul>

          <form className="counters-add" onSubmit={add}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Lisbonne" aria-label="Nom" maxLength={80} />
            <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
            <button className="btn btn-primary btn-sm" disabled={busy}>Ajouter</button>
          </form>

          {error && <p className="msg msg-error">{error}</p>}
        </div>
      </div>
    </div>
  )
}
