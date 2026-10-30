import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useSpace } from '../../context/SpaceContext'
import { errorMessage, supabase } from '../../lib/supabase'
import { sendPush } from '../../lib/push'
import { IconBell, IconChevronLeft, IconGrip, IconPlus, IconTrash } from '../../components/Icons'
import { useLists } from './useLists'
import { useDragSort } from './useDragSort'
import ItemRow from './ItemRow'
import { normalize, summarize, type ListItem } from './types'
import './listes.css'

export default function ListPage() {
  const { listId } = useParams()
  const navigate = useNavigate()
  const { space, me, partner } = useSpace()
  const { lists, items, setItems, loading, error, setError, reload, patchItems } = useLists()
  const [text, setText] = useState('')
  const [quantity, setQuantity] = useState('')
  const [notice, setNotice] = useState('')
  const [highlight, setHighlight] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [showChecked, setShowChecked] = useState(true)
  const [notifying, setNotifying] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const list = lists.find((l) => l.id === listId)
  const mine = items.filter((i) => i.list_id === listId)
  const todo = mine.filter((i) => !i.checked).sort((a, b) => a.position - b.position)
  const done = mine.filter((i) => i.checked).sort((a, b) => (b.checked_at ?? '').localeCompare(a.checked_at ?? ''))
  // Mes ajouts dont l'autre n'a pas encore été prévenu(e)
  const pending = todo.filter((i) => i.added_by === me?.id && !i.notified)

  const { handleProps, rowProps, dragging } = useDragSort(todo, (id, position) => patchItems([id], { position }))

  const flash = (msg: string) => {
    setNotice(msg)
    setTimeout(() => setNotice(''), 3000)
  }

  if (loading) return <p className="muted lists-loading">Chargement…</p>
  if (!list || !space || !me) {
    return (
      <div className="empty">
        <p>Cette liste n’existe plus.</p>
        <Link className="btn btn-secondary" to="/listes">Retour aux listes</Link>
      </div>
    )
  }

  const add = async (e: FormEvent) => {
    e.preventDefault()
    const t = text.trim()
    const q = quantity.trim() || null
    if (!t) return
    setText('')
    setQuantity('')
    input.current?.focus()

    // Déjà là : on le signale ; déjà coché : on le remet dans la liste
    const dup = mine.find((i) => normalize(i.text) === normalize(t))
    if (dup && !dup.checked) {
      setHighlight(dup.id)
      setTimeout(() => setHighlight(null), 1600)
      if (q && q !== dup.quantity) patchItems([dup.id], { quantity: q })
      return flash(`« ${dup.text} » est déjà dans la liste.`)
    }
    if (dup) {
      patchItems([dup.id], {
        checked: false, checked_at: null, quantity: q ?? dup.quantity,
        added_by: me.id, notified: false, created_at: new Date().toISOString(),
      })
      return
    }

    const item: ListItem = {
      id: crypto.randomUUID(),
      list_id: list.id,
      space_id: space.id,
      text: t,
      quantity: q,
      position: Math.max(0, ...mine.map((i) => i.position)) + 1,
      checked: false,
      checked_at: null,
      added_by: me.id,
      created_at: new Date().toISOString(),
      notified: false,
    }
    setItems((prev) => [...prev, item])
    const { error: dbError } = await supabase.from('list_items').insert({
      id: item.id, list_id: item.list_id, space_id: item.space_id, text: item.text,
      quantity: item.quantity, position: item.position, added_by: item.added_by,
    })
    if (dbError) {
      setError(errorMessage(dbError))
      reload()
    }
  }

  const toggle = (item: ListItem) =>
    patchItems([item.id], { checked: !item.checked, checked_at: item.checked ? null : new Date().toISOString() })

  const remove = async (ids: string[]) => {
    setItems((prev) => prev.filter((i) => !ids.includes(i.id)))
    const { error: dbError } = await supabase.from('list_items').delete().in('id', ids)
    if (dbError) {
      setError(errorMessage(dbError))
      reload()
    }
  }

  const clearChecked = () => {
    if (confirm(`Retirer les ${done.length} article${done.length > 1 ? 's' : ''} coché${done.length > 1 ? 's' : ''} ?`)) {
      remove(done.map((i) => i.id))
    }
  }

  // Entrée ou toucher ailleurs : on enregistre au moment où le champ perd le focus (une seule fois)
  const rename = async () => {
    const name = renaming?.trim()
    setRenaming(null)
    if (!name || name === list.name) return
    const { error: dbError } = await supabase.from('lists').update({ name }).eq('id', list.id)
    if (dbError) setError(errorMessage(dbError))
    else reload()
  }

  const deleteList = async () => {
    if (!confirm(`Supprimer la liste « ${list.name} » et ses ${mine.length} article${mine.length > 1 ? 's' : ''} ?`)) return
    const { error: dbError } = await supabase.from('lists').delete().eq('id', list.id)
    if (dbError) return setError(errorMessage(dbError))
    navigate('/listes', { replace: true })
  }

  // Une seule notification pour tous mes ajouts récents (la notification automatique est alors annulée)
  const notifyPartner = async () => {
    if (!partner || !pending.length) return
    setNotifying(true)
    try {
      await sendPush({
        target: 'partner',
        title: list.name,
        body: `${me.display_name} a ajouté ${summarize(pending.map((i) => i.text))}`,
        url: `/listes/${list.id}`,
      })
      await patchItems(pending.map((i) => i.id), { notified: true })
      flash(`${partner.display_name} a été prévenu(e).`)
    } catch (err) {
      setError(errorMessage(err))
    }
    setNotifying(false)
  }

  return (
    <div className={`list-page${dragging ? ' is-dragging' : ''}`}>
      <header className="lp-head">
        <Link to="/listes" className="icon-btn" aria-label="Toutes les listes"><IconChevronLeft /></Link>
        {renaming !== null ? (
          <form
            className="lp-rename"
            onSubmit={(e) => {
              e.preventDefault()
              ;(document.activeElement as HTMLElement | null)?.blur()
            }}
            onBlur={rename}
          >
            <input value={renaming} onChange={(e) => setRenaming(e.target.value)} aria-label="Nom de la liste" maxLength={60} autoFocus />
          </form>
        ) : (
          <button className="lp-title" onClick={() => setRenaming(list.name)} title="Renommer">{list.name}</button>
        )}
        <button className="icon-btn lp-trash" onClick={deleteList} aria-label={`Supprimer la liste ${list.name}`}>
          <IconTrash size={22} />
        </button>
      </header>

      {error && <p className="msg msg-error">{error}</p>}

      <form className="lp-add" onSubmit={add}>
        <input ref={input} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ajouter un article" aria-label="Article" maxLength={200} enterKeyHint="done" />
        <input className="lp-qty" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Qté" aria-label="Quantité" maxLength={40} />
        <button className="lp-add-btn" aria-label="Ajouter" disabled={!text.trim()}><IconPlus size={22} /></button>
      </form>

      {partner && pending.length > 0 && (
        <div className="lp-notify">
          <button className="btn btn-ghost btn-sm" onClick={notifyPartner} disabled={notifying}>
            <IconBell size={18} /> Prévenir {partner.display_name} ({pending.length})
          </button>
          <span className="muted small">Sinon, automatiquement 3 min après ton dernier ajout.</span>
        </div>
      )}

      {notice && <p className="msg msg-info" role="status">{notice}</p>}

      {todo.length === 0 && done.length === 0 && <p className="muted lp-empty">La liste est vide. Ajoute un premier article ci-dessus.</p>}

      <ul className="lp-items">
        {todo.map((item, i) => {
          const row = rowProps(i)
          return (
            <ItemRow
              key={item.id}
              item={item}
              rowRef={row.ref}
              style={row.style}
              data-dragging={row['data-dragging']}
              highlight={highlight === item.id}
              onToggle={() => toggle(item)}
              onSave={(t, q) => patchItems([item.id], { text: t, quantity: q })}
              onDelete={() => remove([item.id])}
              handle={
                <button type="button" className="li-grip" aria-label={`Déplacer ${item.text} (flèches haut et bas)`} {...handleProps(i)}>
                  <IconGrip size={20} />
                </button>
              }
            />
          )
        })}
      </ul>

      {done.length > 0 && (
        <section className="lp-done">
          <div className="lp-done-head">
            <button className="lp-done-toggle" onClick={() => setShowChecked(!showChecked)} aria-expanded={showChecked}>
              {done.length} coché{done.length > 1 ? 's' : ''}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={clearChecked}>Retirer les cochés</button>
          </div>
          {showChecked && (
            <ul className="lp-items">
              {done.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onToggle={() => toggle(item)}
                  onSave={(t, q) => patchItems([item.id], { text: t, quantity: q })}
                  onDelete={() => remove([item.id])}
                />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
