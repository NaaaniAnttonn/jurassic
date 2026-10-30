import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSpace } from '../../context/SpaceContext'
import type { Wish } from './types'
import type { WishPhoto } from './photos'

/** Envies de l'espace et leurs photos, en temps réel */
export function useWishes() {
  const { space } = useSpace()
  const spaceId = space?.id
  const [wishes, setWishes] = useState<Wish[]>([])
  const [photos, setPhotos] = useState<WishPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout>>()

  const load = useCallback(async () => {
    if (!spaceId) return
    const [w, p] = await Promise.all([
      supabase.from('wishes').select('*').eq('space_id', spaceId).order('created_at'),
      supabase.from('wish_photos').select('*').eq('space_id', spaceId).order('created_at'),
    ])
    if (w.error) setError(w.error.message)
    else {
      setWishes(w.data as Wish[])
      // Photos indisponibles : on affiche quand même les envies
      setPhotos(p.error ? [] : (p.data as WishPhoto[]))
      setError('')
    }
    setLoading(false)
  }, [spaceId])

  const loadSoon = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(load, 300)
  }, [load])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!spaceId) return
    const channel = supabase
      .channel(`wishes-${spaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wishes', filter: `space_id=eq.${spaceId}` }, loadSoon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wish_photos', filter: `space_id=eq.${spaceId}` }, loadSoon)
      .subscribe()
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
      clearTimeout(timer.current)
    }
  }, [spaceId, load, loadSoon])

  /** Modifie l'affichage tout de suite, puis la base ; en cas d'échec on recharge */
  const patchWish = useCallback(
    async (id: string, patch: Partial<Wish>) => {
      setWishes((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)))
      const { error } = await supabase.from('wishes').update(patch).eq('id', id)
      if (error) {
        setError(error.message)
        load()
      }
    },
    [load],
  )

  return { wishes, photos, loading, error, reload: load, patchWish }
}
