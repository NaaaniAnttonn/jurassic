import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useSpace } from '../../context/SpaceContext'
import { errorMessage, supabase } from '../../lib/supabase'
import './agenda.css'

type ExternalCalendar = {
  id: string
  name: string
  shared: boolean
  last_synced_at: string | null
  last_error: string | null
}

type Props = { onMessage: (type: 'info' | 'error', text: string) => void }

const FEED_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar-feed?token=`
const fmtSync = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

async function syncNow(calendarId?: string) {
  const { data, error } = await supabase.functions.invoke('sync-calendars', { body: calendarId ? { calendar_id: calendarId } : {} })
  if (error) throw error
  return (data as { results: { ok: boolean; error?: string }[] }).results
}

/** Réglages : abonner Google / Apple à Jurassic, et importer leurs agendas dans Jurassic */
export default function CalendarSync({ onMessage }: Props) {
  const { space, me, partner } = useSpace()
  const [token, setToken] = useState<string | null>(null)
  const [calendars, setCalendars] = useState<ExternalCalendar[]>([])
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)

  const feedUrl = token ? FEED_BASE + token : ''
  const webcalUrl = feedUrl.replace(/^https?:/, 'webcal:')

  const loadCalendars = useCallback(async () => {
    const { data } = await supabase
      .from('external_calendars')
      .select('id, name, shared, last_synced_at, last_error')
      .order('created_at')
    setCalendars((data as ExternalCalendar[]) ?? [])
  }, [])

  useEffect(() => {
    loadCalendars()
  }, [loadCalendars])

  // ---------- Export ----------

  const showLink = async (regenerate = false) => {
    if (regenerate && !confirm('Créer un nouveau lien ? L’ancien cessera de fonctionner partout où il est ajouté.')) return
    const { data, error } = await supabase.rpc('feed_token', { p_regenerate: regenerate })
    if (error) return onMessage('error', errorMessage(error))
    setToken(data as string)
    if (regenerate) onMessage('info', 'Nouveau lien créé. Pense à le remettre dans ton agenda.')
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl)
      onMessage('info', 'Lien copié.')
    } catch {
      onMessage('error', 'Copie impossible : sélectionne le lien à la main.')
    }
  }

  // ---------- Import ----------

  const report = (results: { ok: boolean; error?: string }[]) => {
    const failed = results.find((r) => !r.ok)
    if (failed) onMessage('error', failed.error ?? 'Synchronisation impossible.')
    else onMessage('info', 'Agenda synchronisé.')
  }

  const add = async (e: FormEvent) => {
    e.preventDefault()
    if (!space || !me) return
    const link = url.trim()
    if (!/^(https?|webcal):\/\//i.test(link)) return onMessage('error', 'Le lien doit commencer par https:// ou webcal://')
    setBusy(true)
    const { data, error } = await supabase
      .from('external_calendars')
      .insert({ space_id: space.id, user_id: me.id, name: name.trim() || 'Mon agenda', url: link })
      .select('id')
      .single()
    if (error) {
      setBusy(false)
      return onMessage('error', errorMessage(error))
    }
    setName('')
    setUrl('')
    try {
      report(await syncNow(data.id))
    } catch (err) {
      onMessage('error', errorMessage(err))
    }
    await loadCalendars()
    setBusy(false)
  }

  const syncAll = async () => {
    setBusy(true)
    try {
      report(await syncNow())
    } catch (err) {
      onMessage('error', errorMessage(err))
    }
    await loadCalendars()
    setBusy(false)
  }

  const toggleShared = async (cal: ExternalCalendar, shared: boolean) => {
    setCalendars((list) => list.map((c) => (c.id === cal.id ? { ...c, shared } : c)))
    const { error } = await supabase.from('external_calendars').update({ shared }).eq('id', cal.id)
    if (error) {
      onMessage('error', errorMessage(error))
      loadCalendars()
    }
  }

  const remove = async (cal: ExternalCalendar) => {
    if (!confirm(`Retirer « ${cal.name} » de Jurassic ? Ses événements disparaîtront de l’agenda (pas de ton agenda d’origine).`)) return
    const { error } = await supabase.from('external_calendars').delete().eq('id', cal.id)
    if (error) return onMessage('error', errorMessage(error))
    loadCalendars()
  }

  return (
    <>
      <section className="card">
        <h2>Voir Jurassic dans ton agenda</h2>
        <p className="muted sync-intro">
          Abonne Google Agenda ou le Calendrier de l’iPhone à Jurassic : les événements s’y affichent et se mettent à jour
          tout seuls (lecture seule). L’iPhone actualise souvent, Google peut mettre plusieurs heures.
        </p>
        {!token ? (
          <button className="btn btn-secondary" onClick={() => showLink()}>Afficher mon lien</button>
        ) : (
          <>
            <label className="field">
              <span>Ton lien personnel (garde-le pour toi : il montre aussi tes événements privés)</span>
              <input className="sync-link" readOnly value={feedUrl} onFocus={(e) => e.target.select()} />
            </label>
            <div className="row">
              <button className="btn btn-secondary" onClick={copyLink}>Copier le lien</button>
              <a className="btn btn-ghost" href={webcalUrl}>Ouvrir dans Calendrier (iPhone)</a>
            </div>
            <details className="sync-help">
              <summary>Comment l’ajouter ?</summary>
              <p>Google Agenda (sur ordinateur)</p>
              <ol>
                <li>Copie le lien ci-dessus.</li>
                <li>Sur calendar.google.com, à gauche : « Autres agendas » → « + » → « À partir de l’URL ».</li>
                <li>Colle le lien → « Ajouter l’agenda ». Il apparaît aussi dans l’appli Google Agenda du téléphone.</li>
              </ol>
              <p>iPhone</p>
              <ol>
                <li>Touche « Ouvrir dans Calendrier », puis « S’abonner ».</li>
                <li>Sinon : Réglages → Calendrier → Comptes → Ajouter un compte → Autre → « Ajouter un calendrier avec abonnement », et colle le lien.</li>
              </ol>
            </details>
            <button className="btn btn-ghost" onClick={() => showLink(true)}>Créer un nouveau lien</button>
          </>
        )}
      </section>

      <section className="card">
        <h2>Importer ton agenda</h2>
        <p className="muted sync-intro">
          Affiche dans Jurassic les événements de ton Google Agenda ou de ton calendrier iCloud (lecture seule, mis à jour
          environ toutes les 15 minutes).
        </p>

        {calendars.length > 0 && (
          <ul className="sync-list">
            {calendars.map((cal) => (
              <li key={cal.id} className="sync-item">
                <div className="sync-item-head">
                  <span className="sync-item-name">{cal.name}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => remove(cal)}>Retirer</button>
                </div>
                {cal.last_error ? (
                  <p className="sync-status is-error">{cal.last_error}</p>
                ) : (
                  <p className="sync-status">{cal.last_synced_at ? `À jour le ${fmtSync(cal.last_synced_at)}` : 'En attente de synchronisation'}</p>
                )}
                {partner && (
                  <label className="switch-row">
                    <span>Visible par {partner.display_name}</span>
                    <input type="checkbox" role="switch" checked={cal.shared} onChange={(e) => toggleShared(cal, e.target.checked)} />
                  </label>
                )}
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={add}>
          <label className="field">
            <span>Nom</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Google perso, iCloud" maxLength={60} />
          </label>
          <label className="field">
            <span>Adresse iCal de l’agenda</span>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… ou webcal://…" inputMode="url" autoCapitalize="off" autoCorrect="off" required />
          </label>
          <details className="sync-help">
            <summary>Où trouver cette adresse ?</summary>
            <p>Google Agenda (sur ordinateur)</p>
            <ol>
              <li>Sur calendar.google.com : roue crantée → Paramètres.</li>
              <li>À gauche, clique sur ton agenda, puis « Intégrer l’agenda ».</li>
              <li>Copie « Adresse secrète au format iCal ».</li>
            </ol>
            <p>iCloud (sur iPhone)</p>
            <ol>
              <li>Appli Calendrier → « Calendriers » en bas → (i) à côté de ton calendrier.</li>
              <li>Active « Calendrier public », puis « Partager le lien… » → Copier.</li>
              <li>Attention : toute personne qui a ce lien peut voir ce calendrier.</li>
            </ol>
          </details>
          <div className="row">
            <button type="submit" className="btn btn-primary" disabled={busy}>Ajouter</button>
            {calendars.length > 0 && (
              <button type="button" className="btn btn-ghost" onClick={syncAll} disabled={busy}>Synchroniser maintenant</button>
            )}
          </div>
        </form>
      </section>
    </>
  )
}
