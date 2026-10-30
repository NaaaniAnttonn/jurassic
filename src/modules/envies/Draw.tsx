import { useCallback, useEffect, useRef, useState } from 'react'
import { IconDice } from '../../components/Icons'
import type { Wish } from './types'

type Props = { category: string; wishes: Wish[]; onOpen: (w: Wish) => void; onClose: () => void }

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Tirage au sort d'une envie dans une catégorie, avec un petit défilement façon machine à sous */
export default function Draw({ category, wishes, onOpen, onClose }: Props) {
  const [shown, setShown] = useState<Wish | null>(null)
  const [rolling, setRolling] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval>>()
  const last = useRef<string | null>(null)

  const roll = useCallback(() => {
    if (!wishes.length) return
    // Jamais deux fois la même d'affilée (s'il y a le choix)
    const pool = wishes.length > 1 ? wishes.filter((w) => w.id !== last.current) : wishes
    const pick = pool[Math.floor(Math.random() * pool.length)]
    last.current = pick.id
    clearInterval(timer.current)
    if (reduceMotion() || wishes.length === 1) {
      setShown(pick)
      return
    }
    setRolling(true)
    let ticks = 0
    timer.current = setInterval(() => {
      ticks++
      if (ticks >= 12) {
        clearInterval(timer.current)
        setShown(pick)
        setRolling(false)
      } else {
        setShown(wishes[Math.floor(Math.random() * wishes.length)])
      }
    }, 70)
  }, [wishes])

  useEffect(() => {
    roll()
    return () => clearInterval(timer.current)
    // Un seul tirage à l'ouverture
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="sheet-backdrop draw-backdrop" onClick={onClose}>
      <div className="draw" role="dialog" aria-modal="true" aria-labelledby="draw-title" onClick={(e) => e.stopPropagation()}>
        <p id="draw-title" className="draw-category">
          <IconDice size={18} /> {category} · {wishes.length} envie{wishes.length > 1 ? 's' : ''}
        </p>
        <p className={`draw-result${rolling ? ' is-rolling' : ''}`} aria-live="polite">
          {shown?.title}
        </p>
        {!rolling && shown?.notes && <p className="draw-notes">{shown.notes}</p>}
        <div className="draw-actions">
          <button className="btn btn-ghost" onClick={onClose}>Fermer</button>
          <button className="btn btn-secondary" onClick={roll} disabled={rolling || wishes.length < 2}>Relancer</button>
          <button className="btn btn-primary" onClick={() => shown && onOpen(shown)} disabled={rolling || !shown}>Voir</button>
        </div>
      </div>
    </div>
  )
}
