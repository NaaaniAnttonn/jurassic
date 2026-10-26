import { useState, type FormEvent } from 'react'
import { errorMessage, supabase } from '../lib/supabase'

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setInfo('')
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name.trim() }, emailRedirectTo: window.location.origin },
        })
        if (error) throw error
        if (!data.session) setInfo('Compte créé. Clique sur le lien reçu par e-mail, puis connecte-toi.')
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth-hero">
        <span className="wordmark wordmark-xl">Jurassic</span>
        <p>Notre agenda, nos listes et nos tâches, à deux.</p>
      </div>

      <form className="card auth-card" onSubmit={submit}>
        <div className="segmented" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => setMode('login')}>Se connecter</button>
          <button type="button" role="tab" aria-selected={mode === 'signup'} onClick={() => setMode('signup')}>Créer un compte</button>
        </div>

        {mode === 'signup' && (
          <label className="field">
            <span>Prénom</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="given-name" />
          </label>
        )}
        <label className="field">
          <span>E-mail</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label className="field">
          <span>Mot de passe</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </label>

        {error && <p className="msg msg-error">{error}</p>}
        {info && <p className="msg msg-info">{info}</p>}

        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? '…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
        </button>
      </form>
    </div>
  )
}
