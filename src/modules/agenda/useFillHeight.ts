import { useLayoutEffect, useRef, useState } from 'react'

/** Hauteur pour qu'un élément occupe l'écran jusqu'à la barre d'onglets (comme Google Agenda) */
export function useFillHeight<T extends HTMLElement>(bottomGap = 8) {
  const ref = useRef<T>(null)
  const [height, setHeight] = useState<number>()

  useLayoutEffect(() => {
    const update = () => {
      const el = ref.current
      if (!el) return
      const top = el.getBoundingClientRect().top + window.scrollY
      const tabbar = document.querySelector<HTMLElement>('.tabbar')?.offsetHeight ?? 0
      setHeight(Math.max(360, Math.floor(window.innerHeight - top - tabbar - bottomGap)))
    }
    update()
    // Rotation, clavier, bande des compteurs dépliée, carte d'invitation au-dessus...
    // (body a la hauteur de l'écran : c'est la zone de contenu qui grandit)
    const ro = new ResizeObserver(update)
    ro.observe(ref.current?.closest('main') ?? document.body)
    window.addEventListener('resize', update)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [bottomGap])

  return { ref, height }
}
