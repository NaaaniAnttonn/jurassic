import { useState } from 'react'
import { useSpace } from '../../context/SpaceContext'
import { IconChevronDown, IconHeart } from '../../components/Icons'
import { toDateInput } from '../agenda/dates'
import { daysBetween, elapsed, fmtElapsedShort, nextAnniversary } from './dates'
import { useCountdowns } from './useCountdowns'
import CountersSheet from './CountersSheet'
import './compteurs.css'

const OPEN_KEY = 'jurassic.compteurs.deroule'

/** « aujourd'hui », « demain », « 23 j » */
const shortIn = (n: number) => (n === 0 ? 'aujourd’hui' : n === 1 ? 'demain' : `${n} j`)

function savedOpen() {
  try {
    return localStorage.getItem(OPEN_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Bande en haut de l'agenda : repliée sur une ligne (temps ensemble + prochaine échéance),
 * la flèche déroule toutes les échéances ; toucher le texte ouvre la fiche des compteurs.
 */
export default function CountersBand() {
  const { space } = useSpace()
  const { countdowns, reload } = useCountdowns()
  const [sheet, setSheet] = useState(false)
  const [expanded, setExpanded] = useState(savedOpen)
  const today = toDateInput(new Date())
  const metOn = space?.met_on ?? null
  const [next, ...others] = countdowns

  const toggle = () => {
    setExpanded(!expanded)
    try {
      localStorage.setItem(OPEN_KEY, expanded ? '0' : '1')
    } catch {
      /* stockage indisponible : pas grave */
    }
  }

  let together: string | null = null
  if (metOn && metOn <= today) {
    const anniv = nextAnniversary(metOn, today)
    together =
      anniv.inDays === 0 && anniv.years > 0
        ? `Joyeux anniversaire : ${anniv.years} an${anniv.years > 1 ? 's' : ''} ensemble !`
        : `${fmtElapsedShort(elapsed(metOn, today))} ensemble`
  }
  const empty = !together && !next

  return (
    <>
      <div className={`counters-band${empty ? ' is-empty' : ''}${expanded ? ' is-expanded' : ''}`}>
        <button className="counters-band-main" onClick={() => setSheet(true)}>
          <IconHeart size={18} />
          {empty ? (
            <span className="counters-band-line">Ajoutez votre date de rencontre et vos dates importantes</span>
          ) : (
            <span className="counters-band-line">
              {/* Replié avec une échéance : « ensemble » saute pour laisser la place à la date */}
              {together && <span className="counters-band-together">{next && !expanded ? together.replace(/ ensemble$/, '') : together}</span>}
              {next && !expanded && (
                <>
                  {together && <span className="counters-band-sep">·</span>}
                  <span className="counters-band-next">{next.title}</span>
                  <span className="counters-band-days">{shortIn(daysBetween(today, next.date))}</span>
                  {others.length > 0 && <span className="counters-band-more">+{others.length}</span>}
                </>
              )}
            </span>
          )}
        </button>
        {countdowns.length > 0 && (
          <button
            className="icon-btn counters-band-toggle"
            onClick={toggle}
            aria-expanded={expanded}
            aria-label={expanded ? 'Replier les échéances' : 'Voir toutes les échéances'}
          >
            <IconChevronDown size={20} />
          </button>
        )}

        {expanded && countdowns.length > 0 && (
          <button className="counters-band-chips" onClick={() => setSheet(true)}>
            {countdowns.map((c) => (
              <span key={c.id} className="counters-chip">
                {c.title} · <strong>{shortIn(daysBetween(today, c.date))}</strong>
              </span>
            ))}
          </button>
        )}
      </div>
      {sheet && <CountersSheet countdowns={countdowns} onChanged={reload} onClose={() => setSheet(false)} />}
    </>
  )
}
