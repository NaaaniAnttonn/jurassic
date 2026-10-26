import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSpace } from '../context/SpaceContext'
import InstallHint from '../components/InstallHint'
import CalendarSync from '../modules/agenda/CalendarSync'
import { disablePush, enablePush, getPushState, sendPush, type PushState } from '../lib/push'
import { errorMessage, supabase } from '../lib/supabase'

const COLORS = ['#2E7D5B', '#C2410C', '#7C3AED', '#0E7490', '#BE185D', '#A16207']

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const { space, me, partner, refresh } = useSpace()

  const [name, setName] = useState(me?.display_name ?? '')
  const [color, setColor] = useState(me?.color ?? COLORS[0])
  const [spaceName, setSpaceName] = useState(space?.name ?? '')
  const [pushState, setPushState] = useState<PushState | null>(null)
  const [msg, setMsg] = useState<{ type: 'info' | 'error'; text: string } | null>(null)

  useEffect(() => {
    getPushState().then(setPushState)
  }, [])

  const flash = (type: 'info' | 'error', text: string) => {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 3500)
  }

  const saveProfile = async () => {
    const { error } = await supabase.from('profiles').update({ display_name: name.trim(), color }).eq('id', user!.id)
    if (error) return flash('error', errorMessage(error))
    await refresh()
    flash('info', 'Profil enregistré.')
  }

  const saveSpace = async () => {
    const { error } = await supabase.from('spaces').update({ name: spaceName.trim() || 'Notre espace' }).eq('id', space!.id)
    if (error) return flash('error', errorMessage(error))
    await refresh()
    flash('info', 'Espace renommé.')
  }

  const togglePush = async () => {
    try {
      if (pushState === 'on') await disablePush()
      else await enablePush(user!.id)
      setPushState(await getPushState())
    } catch (e) {
      flash('error', errorMessage(e))
    }
  }

  const testPush = async (target: 'me' | 'partner') => {
    try {
      const res = await sendPush(
        target === 'me'
          ? { target: 'me', title: 'Test Jurassic', body: 'Les notifications fonctionnent sur cet appareil.' }
          : { target: 'partner', title: `${me?.display_name} pense à toi`, body: 'Petit coucou depuis Jurassic.' },
      )
      flash('info', res.total === 0 ? 'Aucun appareil abonné aux notifications.' : `Notification envoyée (${res.sent}/${res.total}).`)
    } catch (e) {
      flash('error', errorMessage(e))
    }
  }

  const leave = async () => {
    if (!confirm('Quitter l’espace ? S’il est vide ensuite, toutes ses données seront supprimées.')) return
    const { error } = await supabase.rpc('leave_space')
    if (error) return flash('error', errorMessage(error))
    await refresh()
  }

  return (
    <div className="settings">
      <section className="card">
        <h2>Mon profil</h2>
        <label className="field">
          <span>Prénom</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="field">
          <span>Ma couleur</span>
          <div className="swatches" role="radiogroup" aria-label="Ma couleur">
            {COLORS.map((c) => (
              <button
                key={c}
                role="radio"
                aria-checked={color === c}
                aria-label={c}
                className="swatch"
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>
        <button className="btn btn-primary" onClick={saveProfile}>Enregistrer le profil</button>
      </section>

      <section className="card">
        <h2>Notre espace</h2>
        <label className="field">
          <span>Nom</span>
          <input value={spaceName} onChange={(e) => setSpaceName(e.target.value)} />
        </label>
        <button className="btn btn-secondary" onClick={saveSpace}>Renommer</button>
        <dl className="kv">
          <dt>Membres</dt>
          <dd>{[me?.display_name, partner?.display_name ?? 'en attente'].join(' et ')}</dd>
          <dt>Code d’invitation</dt>
          <dd><code>{space?.invite_code}</code></dd>
        </dl>
      </section>

      <section className="card">
        <h2>Notifications</h2>
        {pushState === 'needs-install' && <p className="muted">Sur iPhone, installe d’abord Jurassic sur l’écran d’accueil (voir ci-dessous), puis ouvre-la depuis l’icône.</p>}
        {pushState === 'unsupported' && <p className="muted">Ce navigateur ne gère pas les notifications.</p>}
        {pushState === 'denied' && <p className="muted">Notifications bloquées. Autorise-les dans les réglages du téléphone pour Jurassic.</p>}
        {(pushState === 'on' || pushState === 'off') && (
          <>
            <button className={`btn ${pushState === 'on' ? 'btn-secondary' : 'btn-primary'}`} onClick={togglePush}>
              {pushState === 'on' ? 'Désactiver sur cet appareil' : 'Activer sur cet appareil'}
            </button>
            {pushState === 'on' && (
              <div className="row">
                <button className="btn btn-ghost" onClick={() => testPush('me')}>M’envoyer un test</button>
                {partner && <button className="btn btn-ghost" onClick={() => testPush('partner')}>Faire coucou à {partner.display_name}</button>}
              </div>
            )}
          </>
        )}
      </section>

      <CalendarSync onMessage={flash} />

      <section className="card">
        <h2>Installer l’app</h2>
        <InstallHint />
      </section>

      {msg && <p className={`msg msg-${msg.type} toast`} role="status">{msg.text}</p>}

      <div className="row row-end">
        <button className="btn btn-ghost" onClick={signOut}>Se déconnecter</button>
        <button className="btn btn-danger" onClick={leave}>Quitter l’espace</button>
      </div>
    </div>
  )
}
