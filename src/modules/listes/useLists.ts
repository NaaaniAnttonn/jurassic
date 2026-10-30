import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSpace } from '../../context/SpaceContext'
import type { List, ListItem } from './types'

/** Toutes les listes de l'espace et leurs articles, en temps réel */
export function useLists() {
  const { space } = useSpace()
  const spaceId = space?.id
  const [lists, setLists] = useState<List[]>([])
  const [items, setItems] = useState<ListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout>>()

  const load = useCallback(async () => {
    if (!spaceId) return
    const [l, i] = await Promise.all([
      supabase.from('lists').select('*').eq('space_id', spaceId).order('created_at'),
      supabase.from('list_items').select('*').eq('space_id', spaceId).order('position'),
    ])
    const err = l.error ?? i.error
    if (err) setError(err.message)
    else {
      setLists(l.data as List[])
      setItems(i.data as ListItem[])
      setError('')
    }
    setLoading(false)
  }, [spaceId])

  // Plusieurs changements d'affilée (cocher vite, glisser) : un seul rechargement
  const loadSoon = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(load, 300)
  }, [load])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!spaceId) return
    const filter = `space_id=eq.${spaceId}`
    const channel = supabase
      .channel(`lists-${spaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lists', filter }, loadSoon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'list_items', filter }, loadSoon)
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
  const patchItems = useCallback(
    async (ids: string[], patch: Partial<ListItem>) => {
      setItems((prev) => prev.map((it) => (ids.includes(it.id) ? { ...it, ...patch } : it)))
      const { error } = await supabase.from('list_items').update(patch).in('id', ids)
      if (error) {
        setError(error.message)
        load()
      }
      return error
    },
    [load],
  )

  return { lists, items, setItems, loading, error, setError, reload: load, patchItems }
}
