import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { IconCheck, IconClose } from '../../components/Icons'
import type { ListItem } from './types'

type Props = {
  item: ListItem
  onToggle: () => void
  onSave: (text: string, quantity: string | null) => void
  onDelete: () => void
  handle?: ReactNode // poignée de glisser-déposer (articles non cochés)
  rowRef?: (el: HTMLElement | null) => void
  style?: CSSProperties
  highlight?: boolean
  'data-dragging'?: boolean
}

export default function ItemRow({ item, onToggle, onSave, onDelete, handle, rowRef, style, highlight, ...rest }: Props) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(item.text)
  const [quantity, setQuantity] = useState(item.quantity ?? '')

  const startEdit = () => {
    setText(item.text)
    setQuantity(item.quantity ?? '')
    setEditing(true)
  }

  const save = (e?: FormEvent) => {
    e?.preventDefault()
    setEditing(false)
    const t = text.trim()
    const q = quantity.trim() || null
    if (t && (t !== item.text || q !== item.quantity)) onSave(t, q)
  }

  const cls = ['li-row', item.checked && 'is-checked', highlight && 'is-highlight'].filter(Boolean).join(' ')

  return (
    <li ref={rowRef} className={cls} style={style} data-dragging={rest['data-dragging']}>
      {handle}
      <button
        type="button"
        role="checkbox"
        aria-checked={item.checked}
        aria-label={item.checked ? `Décocher ${item.text}` : `Cocher ${item.text}`}
        className="li-check"
        onClick={onToggle}
      >
        {item.checked && <IconCheck size={16} />}
      </button>

      {editing ? (
        // Valide avec Entrée ou en touchant ailleurs
        <form
          className="li-edit"
          onSubmit={save}
          onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && save()}
        >
          <input value={text} onChange={(e) => setText(e.target.value)} aria-label="Article" maxLength={200} autoFocus />
          <input value={quantity} onChange={(e) => setQuantity(e.target.value)} aria-label="Quantité" placeholder="Qté" maxLength={40} />
          <button type="submit" hidden />
        </form>
      ) : (
        <button type="button" className="li-text" onClick={startEdit} aria-label={`Modifier ${item.text}`}>
          <span className="li-label">{item.text}</span>
          {item.quantity && <span className="li-qty">{item.quantity}</span>}
        </button>
      )}

      <button type="button" className="li-delete" onClick={onDelete} aria-label={`Supprimer ${item.text}`}>
        <IconClose size={18} />
      </button>
    </li>
  )
}
