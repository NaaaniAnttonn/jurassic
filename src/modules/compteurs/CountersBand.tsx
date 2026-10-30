import { useState } from 'react'
import { useSpace } from '../../context/SpaceContext'
import { IconChevronRight, IconHeart } from '../../components/Icons'
import { toDateInput } from '../agenda/dates'
import { daysBetween, elapsed, fmtElapsedShort, fmtIn, nextAnniversary } from './dates'
import { useCountdowns } from './useCountdowns'
import CountersSheet from './CountersSheet'
import './compteurs.css'

/** Bande discrète en haut de l'agenda : temps ensemble et prochaine date importante */
export default function CountersBand() {
  const { space } = useSpace()
  const { countdowns, reload } = useCountdowns()
  const [open, setOpen] = useState(false)
  const today = toDateInput(new Date())
  const metOn = space?.met_on ?? null
  const next = countdowns[0]

  let together: string | null = null
  if (metOn && metOn <= today) {
    const anniv = nextAnniversary(metOn, today)
    together =
      anniv.inDays === 0 && anniv.years > 0
        ? `Joyeux anniversaire : ${anniv.years} an${anniv.years > 1 ? 's' : ''} ensemble !`
        : `${fmtElapsedShort(elapsed(metOn, today))} ensemble`
  }

  return (
    <>
      <button className={`counters-band${together || next ? '' : ' is-empty'}`} onClick={() => setOpen(true)}>
        <IconHeart size={18} />
        <span className="counters-band-text">
          {together || next ? (
            <>
              {together && <span>{together}</span>}
              {next && (
                <span>
                  {next.title} {fmtIn(daysBetween(today, next.date))}
                </span>
              )}
            </>
          ) : (
            <span>Ajoutez votre date de rencontre et vos dates importantes</span>
          )}
        </span>
        <IconChevronRight size={18} />
      </button>
      {open && <CountersSheet countdowns={countdowns} onChanged={reload} onClose={() => setOpen(false)} />}
    </>
  )
}
