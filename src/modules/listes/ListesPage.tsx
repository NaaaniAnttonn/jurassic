import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSpace } from '../../context/SpaceContext'
import { errorMessage, supabase } from '../../lib/supabase'
import { IconChevronRight, IconListes, IconTrash } from '../../components/Icons'
import { useLists } from './useLists'
import type { List } from './types'
import './listes.css'

export default function ListesPage() {
  const { space, me } = useSpace()
  const { lists, items, loading, error, setError, reload } = useLists()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')

  const create = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || !space || !me) return
    setBusy(true)
    const { data, error: dbError } = await supabase
      .from('lists')
      .insert({ space_id: space.id, name: trimmed, created_by: me.id })
      .select('id')
      .single()
    setBusy(false)
    if (dbError) return setFormError(errorMessage(dbError))
    setName('')
    navigate(`/listes/${data.id}`)
  }

  const remove = async (list: List, count: number) => {
    if (!confirm(`Supprimer la liste « ${list.name} »${count ? ` et ses ${count} article${count > 1 ? 's' : ''}` : ''} ?`)) return
    const { error: dbError } = await supabase.from('lists').delete().eq('id', list.id)
    if (dbError) setError(errorMessage(dbError))
    reload()
  }

  if (loading) return <p className="muted lists-loading">Chargement des listes…</p>

  return (
    <div className="lists">
      {error && <p className="msg msg-error">Impossible de charger les listes : {error}</p>}

      {lists.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><IconListes size={40} /></div>
          <p>Aucune liste pour l’instant.</p>
        </div>
      ) : (
        <ul className="lists-grid">
          {lists.map((list) => {
            const its = items.filter((i) => i.list_id === list.id)
            const left = its.filter((i) => !i.checked).length
            const status = its.length === 0 ? 'Vide' : left === 0 ? 'Tout est coché' : `${left} à prendre`
            return (
              <li key={list.id} className="lists-item">
                <Link to={`/listes/${list.id}`} className="lists-card">
                  <span className="lists-card-main">
                    <span className="lists-card-name">{list.name}</span>
                    <span className="lists-card-status">{status}</span>
                  </span>
                  <IconChevronRight size={20} />
                </Link>
                <button className="icon-btn lists-trash" onClick={() => remove(list, its.length)} aria-label={`Supprimer la liste ${list.name}`}>
                  <IconTrash size={20} />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <form className="card lists-new" onSubmit={create}>
        <label className="field">
          <span>Nouvelle liste</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Valise Lyon, Bricolage" maxLength={60} />
        </label>
        {formError && <p className="msg msg-error">{formError}</p>}
        <button className="btn btn-secondary" disabled={busy || !name.trim()}>Créer la liste</button>
      </form>
    </div>
  )
}
