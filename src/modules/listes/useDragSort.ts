import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'

type Drag = {
  from: number
  to: number
  dy: number
  startY: number
  startScroll: number
  mids: number[] // milieu de chaque ligne, en coordonnées de page
  shift: number // place libérée par la ligne déplacée
}

/** Nouvelle position entre les deux voisins d'arrivée (on ne renumérote jamais toute la liste) */
function positionAt<T extends { position: number }>(items: T[], from: number, to: number) {
  const rest = items.filter((_, i) => i !== from)
  const prev = rest[to - 1]
  const next = rest[to]
  if (prev && next) return (prev.position + next.position) / 2
  if (prev) return prev.position + 1
  if (next) return next.position - 1
  return 0
}

/**
 * Réordonner une liste en faisant glisser une poignée (doigt ou souris),
 * ou au clavier avec les flèches haut / bas sur la poignée.
 */
export function useDragSort<T extends { id: string; position: number }>(items: T[], onMove: (id: string, position: number) => void) {
  const rows = useRef<(HTMLElement | null)[]>([])
  const [drag, setDrag] = useState<Drag | null>(null)

  const move = (from: number, to: number) => {
    if (from !== to && to >= 0 && to < items.length) onMove(items[from].id, positionAt(items, from, to))
  }

  const target = (d: Drag, dy: number) => {
    const center = d.mids[d.from] + dy
    return d.mids.filter((m, i) => i !== d.from && m < center).length
  }

  const handleProps = (index: number) => ({
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      const rects = items.map((_, i) => rows.current[i]!.getBoundingClientRect())
      const gap = rects.length > 1 ? rects[1].top - rects[0].bottom : 0
      setDrag({
        from: index,
        to: index,
        dy: 0,
        startY: e.clientY,
        startScroll: window.scrollY,
        mids: rects.map((r) => r.top + window.scrollY + r.height / 2),
        shift: rects[index].height + gap,
      })
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (!drag) return
      // Près du bord de l'écran : on fait défiler la page
      if (e.clientY < 90) window.scrollBy(0, -12)
      else if (e.clientY > window.innerHeight - 140) window.scrollBy(0, 12)
      const dy = e.clientY - drag.startY + window.scrollY - drag.startScroll
      setDrag({ ...drag, dy, to: target(drag, dy) })
    },
    onPointerUp: () => {
      if (drag) move(drag.from, drag.to)
      setDrag(null)
    },
    onPointerCancel: () => setDrag(null),
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        move(index, index + (e.key === 'ArrowUp' ? -1 : 1))
      }
    },
  })

  const rowProps = (index: number) => {
    let style: CSSProperties | undefined
    if (drag) {
      if (index === drag.from) {
        style = { transform: `translateY(${drag.dy}px)`, zIndex: 2, transition: 'none' }
      } else {
        const { from, to, shift } = drag
        const offset = from < to && index > from && index <= to ? -shift : from > to && index >= to && index < from ? shift : 0
        style = { transform: `translateY(${offset}px)` }
      }
    }
    return {
      ref: (el: HTMLElement | null) => {
        rows.current[index] = el
      },
      style,
      'data-dragging': drag?.from === index || undefined,
    }
  }

  return { handleProps, rowProps, dragging: drag !== null }
}
