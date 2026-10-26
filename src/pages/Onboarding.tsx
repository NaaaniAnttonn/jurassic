import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSpace } from '../context/SpaceContext'
import { errorMessage, supabase } from '../lib/supabase'

export default function Onboarding() {
  const { signOut } = useAuth()
  const { me, refresh } = useSpace()
  const [spaceName, setSpaceName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<'create' | 'join' | null>(null)
  const [error, setError] = useState('')

  const create = async (e: FormEvent) => {
    e.preventDefault()
    setBusy('create')
    setError('')
    const { error } = await supabase.rpc('create_space', { p_name: spaceName })
    if (error) setError(errorMessage(error))
    else await refresh()
    setBusy(null)
  }

  const join = async (e: FormEvent) => {
    e.preventDefault()
    setBusy('join')
    setError('')
    const { error } = await supabase.rpc('join_space', { p_code: code })
    if (error) setError(errorMessage(error))
    else await refresh()
    setBusy(null)
  }

  return (
    <div className="onboarding">
      <h1 className="onboarding-title">Salut {me?.display_name}.</h1>
      <p className="lead">Jurassic fonctionne à deux. L’un crée l’espace, l’autre le rejoint avec un code.</p>

      <form className="card" onSubmit={create}>
        <h2>Créer notre espace</h2>
        <label className="field">
          <span>Nom de l’espace</span>
          <input value={spaceName} onChange={(e) => setSpaceName(e.target.value)} placeholder="Notre espace" />
        </label>
        <button className="btn btn-primary btn-block" disabled={busy !== null}>
          {busy === 'create' ? '…' : 'Créer l’espace'}
        </button>
      </form>

      <form className="card" onSubmit={join}>
        <h2>Rejoindre avec un code</h2>
        <label className="field">
          <span>Code à 6 caractères</span>
          <input
            className="input-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            required
            autoCapitalize="characters"
            autoComplete="off"
          />
        </label>
        <button className="btn btn-secondary btn-block" disabled={busy !== null || code.length < 6}>
          {busy === 'join' ? '…' : 'Rejoindre l’espace'}
        </button>
      </form>

      {error && <p className="msg msg-error">{error}</p>}

      <button className="btn btn-ghost" onClick={signOut}>Se déconnecter</button>
    </div>
  )
}
