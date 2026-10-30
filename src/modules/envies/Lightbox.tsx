import { useEffect, useRef, useState, type TouchEvent } from 'react'
import { IconChevronLeft, IconChevronRight, IconClose, IconTrash } from '../../components/Icons'
import { useSignedUrls, type WishPhoto } from './photos'

type Props = {
  photos: WishPhoto[]
  start: number
  title: string
  onDelete: (photo: WishPhoto) => void
  onClose: () => void
}

/** Visionneuse plein écran : flèches, glissement gauche/droite, Échap pour fermer */
export default function Lightbox({ photos, start, title, onDelete, onClose }: Props) {
  const [index, setIndex] = useState(start)
  const touch = useRef<number | null>(null)
  const urls = useSignedUrls(photos.map((p) => p.path))
  const thumbs = useSignedUrls(photos.map((p) => p.thumb_path))
  const photo = photos[Math.min(index, photos.length - 1)]

  const go = (dir: 1 | -1) => setIndex((i) => (i + dir + photos.length) % photos.length)

  useEffect(() => {
    // Écoute en capture sur window et arrête l'événement : Échap ne ferme pas aussi la fiche derrière
    const onKey = (e: KeyboardEvent) => {
      if (['Escape', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.stopPropagation()
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose, photos.length])

  // Plus de photo (supprimée, y compris par l'autre) : on ferme
  useEffect(() => {
    if (!photos.length) onClose()
  }, [photos.length, onClose])
  if (!photo) return null

  const onTouchStart = (e: TouchEvent) => (touch.current = e.touches[0].clientX)
  const onTouchEnd = (e: TouchEvent) => {
    if (touch.current === null) return
    const dx = e.changedTouches[0].clientX - touch.current
    touch.current = null
    if (Math.abs(dx) > 50 && photos.length > 1) go(dx < 0 ? 1 : -1)
  }

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={`Photos : ${title}`} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <header className="lightbox-head">
        <button className="icon-btn" onClick={onClose} aria-label="Fermer"><IconClose /></button>
        <span>{photos.length > 1 ? `${index + 1} / ${photos.length}` : title}</span>
        <button className="icon-btn" onClick={() => confirm('Supprimer cette photo ?') && onDelete(photo)} aria-label="Supprimer la photo">
          <IconTrash />
        </button>
      </header>

      <div className="lightbox-stage">
        {/* La vignette s'affiche tout de suite, la grande photo la remplace une fois chargée */}
        <img key={photo.id} src={urls[photo.path] ?? thumbs[photo.thumb_path]} alt="" />
        {photos.length > 1 && (
          <>
            <button className="icon-btn lightbox-prev" onClick={() => go(-1)} aria-label="Photo précédente"><IconChevronLeft /></button>
            <button className="icon-btn lightbox-next" onClick={() => go(1)} aria-label="Photo suivante"><IconChevronRight /></button>
          </>
        )}
      </div>
    </div>
  )
}
