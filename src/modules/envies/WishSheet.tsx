import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useSpace } from '../../context/SpaceContext'
import { errorMessage, supabase } from '../../lib/supabase'
import { IconPlus } from '../../components/Icons'
import { fmtShort, toDateInput } from '../agenda/dates'
import { deletePhotos, uploadPhotos, useSignedUrls, type WishPhoto } from './photos'
import { notifyPartner, photosLabel } from './notify'
import Lightbox from './Lightbox'
import type { Wish } from './types'

type Props = {
  wish: Wish | null
  photos: WishPhoto[] // photos de cette envie (à jour en temps réel)
  categories: string[]
  defaultCategory: string
  onClose: () => void
  onSaved: () => void
}

export default function WishSheet({ wish, photos, categories, defaultCategory, onClose, onSaved }: Props) {
  const { space, me, partner } = useSpace()
  const isNew = !wish
  // Identifiant choisi dès l'ouverture : les photos d'une nouvelle envie sont envoyées juste après sa création
  const [wishId] = useState(() => wish?.id ?? crypto.randomUUID())
  const [pending, setPending] = useState<File[]>([])
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null)
  const [viewing, setViewing] = useState<number | null>(null)
  const thumbs = useSignedUrls(photos.map((p) => p.thumb_path))
  const previews = useMemo(() => pending.map((f) => URL.createObjectURL(f)), [pending])
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews])
  const [title, setTitle] = useState(wish?.title ?? '')
  const [category, setCategory] = useState(wish?.category ?? defaultCategory)
  const [newCategory, setNewCategory] = useState<string | null>(null) // saisie d'une catégorie inédite
  const [notes, setNotes] = useState(wish?.notes ?? '')
  const [doneOn, setDoneOn] = useState(wish?.done_on ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Fermeture avec Échap + blocage du défilement derrière
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const upload = async (files: File[]) => {
    if (!space || !me || !files.length) return { added: 0, errors: [] as string[] }
    setUploading({ done: 0, total: files.length })
    const { added, errors } = await uploadPhotos({ id: wishId, space_id: space.id }, files, me.id, (done, total) =>
      setUploading({ done, total }),
    )
    setUploading(null)
    if (errors.length) setError(errors.join(' '))
    return { added, errors }
  }

  // Envie existante : envoi immédiat ; nouvelle envie : en attente jusqu'à l'enregistrement
  const pickPhotos = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])]
    e.target.value = ''
    if (!files.length) return
    if (isNew) return setPending((prev) => [...prev, ...files])
    const { added } = await upload(files)
    if (added && me) notifyPartner(`${me.display_name} a ajouté ${photosLabel(added)}`, `À l’envie « ${wish.title} »`)
  }

  const removePhoto = async (photo: WishPhoto) => {
    const err = await deletePhotos([photo])
    if (err) setError(errorMessage(err))
    else onSaved()
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!space || !me) return
    if (uploading) return
    const t = title.trim()
    const c = (newCategory ?? category).trim()
    if (!t) return setError('Donne un titre à cette envie.')
    if (!c) return setError('Choisis une catégorie.')

    const row = {
      title: t,
      category: c,
      notes: notes.trim() || null,
      done_on: doneOn || null,
      done_by: doneOn ? (wish?.done_by ?? me.id) : null,
    }
    setBusy(true)
    const { error: dbError } = isNew
      ? await supabase.from('wishes').insert({ ...row, id: wishId, space_id: space.id, created_by: me.id })
      : await supabase.from('wishes').update(row).eq('id', wish.id)
    if (dbError) {
      setBusy(false)
      return setError(errorMessage(dbError))
    }

    const { added, errors } = isNew ? await upload(pending) : { added: 0, errors: [] }
    setBusy(false)

    if (partner) {
      if (isNew) {
        const extra = added ? `, avec ${photosLabel(added)}` : ''
        notifyPartner(`${me.display_name} a ajouté une envie`, `${t} · ${c}${extra}`)
      } else if (row.done_on && !wish.done_on) {
        notifyPartner(`${me.display_name} a coché une envie`, `« ${t} », réalisée le ${fmtShort(new Date(`${row.done_on}T00:00:00`))}`)
      }
    }
    onSaved()
    // L'envie existe déjà en base : on ferme quoi qu'il arrive, en signalant les photos ratées
    if (errors.length) alert(`L’envie est enregistrée, mais des photos n’ont pas pu être envoyées : ${errors.join(' ')}`)
    onClose()
  }

  const remove = async () => {
    const question = photos.length ? `Supprimer cette envie et ses ${photosLabel(photos.length)} ?` : 'Supprimer cette envie ?'
    if (!wish || !confirm(question)) return
    setBusy(true)
    // Les fichiers d'abord : la suppression de l'envie efface les lignes mais pas le stockage
    const photoError = await deletePhotos(photos)
    if (photoError) {
      setBusy(false)
      return setError(errorMessage(photoError))
    }
    const { error: dbError } = await supabase.from('wishes').delete().eq('id', wish.id)
    setBusy(false)
    if (dbError) return setError(errorMessage(dbError))
    onSaved()
    onClose()
  }

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose}>
        <form className="sheet" role="dialog" aria-modal="true" aria-labelledby="wish-sheet-title" onClick={(e) => e.stopPropagation()} onSubmit={save}>
          <header className="sheet-head">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <h2 id="wish-sheet-title">{isNew ? 'Nouvelle envie' : 'Modifier'}</h2>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>Enregistrer</button>
          </header>

          <div className="sheet-body">
            <input
              className="sheet-title-input"
              placeholder="Ex. Saut en parachute, Lisbonne, le resto de Paul"
              aria-label="Titre"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus={isNew}
              maxLength={200}
            />

            <div className="field">
              <span>Catégorie</span>
              <div className="chips" role="radiogroup" aria-label="Catégorie">
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={newCategory === null && category === c}
                    className="chip"
                    onClick={() => {
                      setCategory(c)
                      setNewCategory(null)
                    }}
                  >
                    {c}
                  </button>
                ))}
                <button type="button" role="radio" aria-checked={newCategory !== null} className="chip" onClick={() => setNewCategory('')}>
                  + Autre
                </button>
              </div>
              {newCategory !== null && (
                <input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Nouvelle catégorie (ex. Films, Concerts)"
                  aria-label="Nouvelle catégorie"
                  maxLength={40}
                  autoFocus
                />
              )}
            </div>

            <label className="field">
              <span>Notes</span>
              <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Adresse, lien, idée de date…" maxLength={2000} />
            </label>

            <div className="field">
              <span>Photos</span>
              <div className="photo-grid">
                {photos.map((p, i) => (
                  <button key={p.id} type="button" className="photo-thumb" onClick={() => setViewing(i)} aria-label={`Voir la photo ${i + 1}`}>
                    {thumbs[p.thumb_path] && <img src={thumbs[p.thumb_path]} alt="" />}
                  </button>
                ))}
                {previews.map((url, i) => (
                  <button
                    key={url}
                    type="button"
                    className="photo-thumb is-pending"
                    onClick={() => setPending((prev) => prev.filter((_, j) => j !== i))}
                    aria-label="Retirer cette photo"
                  >
                    <img src={url} alt="" />
                  </button>
                ))}
                <label className={`photo-add${uploading ? ' is-busy' : ''}`}>
                  <input type="file" accept="image/*" multiple onChange={pickPhotos} disabled={!!uploading} />
                  {uploading ? `${uploading.done}/${uploading.total}` : <IconPlus size={26} />}
                  <span className="sr-only">Ajouter des photos</span>
                </label>
              </div>
              {isNew && pending.length > 0 && <small className="muted">Envoyées à l’enregistrement. Touchez une photo pour la retirer.</small>}
            </div>

            <div className="field">
              <span>Réalisée le</span>
              <div className="wish-done-row">
                <input type="date" aria-label="Date de réalisation" value={doneOn} max={toDateInput(new Date())} onChange={(e) => setDoneOn(e.target.value)} />
                {doneOn ? (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDoneOn('')}>Remettre à faire</button>
                ) : (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDoneOn(toDateInput(new Date()))}>Aujourd’hui</button>
                )}
              </div>
            </div>

            {error && <p className="msg msg-error">{error}</p>}

            {!isNew && (
              <button type="button" className="btn btn-danger btn-block" onClick={remove} disabled={busy}>
                Supprimer l’envie
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Hors du fond de la fiche : un clic dans la visionneuse ne doit pas fermer la fiche */}
      {viewing !== null && wish && (
        <Lightbox photos={photos} start={viewing} title={wish.title} onDelete={removePhoto} onClose={() => setViewing(null)} />
      )}
    </>
  )
}
