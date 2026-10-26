import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSpace } from '../../context/SpaceContext'
import { fromExternal, type CalEvent, type ExternalEvent } from './types'

export function useEvents() {
  const { space } = useSpace()
  const spaceId = space?.id
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout>>()

  const load = useCallback(async () => {
    if (!spaceId) return
    const [own, imported] = await Promise.all([
      supabase.from('events').select('*').eq('space_id', spaceId).order('start_at'),
      supabase
        .from('external_events')
        .select('id, space_id, user_id, calendar_name, title, location, notes, start_at, end_at, all_day')
        .eq('space_id', spaceId),
    ])
    if (own.error) setError(own.error.message)
    else {
      // Un agenda importé illisible ne doit pas empêcher d'afficher le reste
      const external = imported.error ? [] : (imported.data as ExternalEvent[]).map(fromExternal)
      setEvents([...(own.data as CalEvent[]), ...external])
      setError('')
    }
    setLoading(false)
  }, [spaceId])

  // Une synchro remplace d'un coup toutes les occurrences d'un agenda : on regroupe les rechargements
  const loadSoon = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(load, 400)
  }, [load])

  useEffect(() => {
    load()
  }, [load])

  // Temps réel : tout changement chez l'un apparaît chez l'autre
  useEffect(() => {
    if (!spaceId) return
    const channel = supabase
      .channel(`events-${spaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, loadSoon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'external_events' }, loadSoon)
      .subscribe()
    // Rechargement quand on revient sur l'app (téléphone mis en veille)
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
      clearTimeout(timer.current)
    }
  }, [spaceId, load, loadSoon])

  return { events, loading, error, reload: load }
}
