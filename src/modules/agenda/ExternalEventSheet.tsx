import { useEffect } from 'react'
import { useSpace } from '../../context/SpaceContext'
import { fmtWhen } from './dates'
import { whoLabel } from './colors'
import type { CalEvent } from './types'

/** Fiche en lecture seule d'un événement importé (Google, iCloud...) */
export default function ExternalEventSheet({ event, onClose }: { event: CalEvent; onClose: () => void }) {
  const { me, partner } = useSpace()
  const mine = event.created_by === me?.id

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="ext-title" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Fermer</button>
          <h2>Agenda importé</h2>
          <span />
        </header>

        <div className="sheet-body">
          <h3 id="ext-title" className="ext-title">{event.title}</h3>
          <dl className="kv ext-kv">
            <dt>Quand</dt>
            <dd>{fmtWhen(new Date(event.start_at), new Date(event.end_at), event.all_day)}</dd>
            <dt>Pour</dt>
            <dd>{whoLabel(event, me, partner)}</dd>
            <dt>Agenda</dt>
            <dd>{event.external?.calendarName}</dd>
            {event.location && (
              <>
                <dt>Lieu</dt>
                <dd>{event.location}</dd>
              </>
            )}
          </dl>
          {event.notes && <p className="ext-notes">{event.notes}</p>}
          <p className="muted small">
            {mine
              ? 'Pour le modifier, passe par ton agenda d’origine : Jurassic se met à jour tout seul (environ toutes les 15 minutes).'
              : `Cet événement vient de l’agenda de ${partner?.display_name ?? 'ton/ta partenaire'}.`}
          </p>
        </div>
      </div>
    </div>
  )
}
