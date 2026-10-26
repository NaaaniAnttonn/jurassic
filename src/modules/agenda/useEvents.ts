import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSpace } from '../../context/SpaceContext'
import type { CalEvent } from './types'

export function useEvents() {
  const { space } = useSpace()
  const spaceId = space?.id
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!spaceId) return
    const { data, error } = await supabase.from('events').select('*').eq('space_id', spaceId).order('start_at')
    if (error) setError(error.message)
    else {
      setEvents(data as CalEvent[])
      setError('')
    }
    setLoading(false)
  }, [spaceId])

  useEffect(() => {
    load()
  }, [load])

  // Temps réel : tout changement chez l'un apparaît chez l'autre
  useEffect(() => {
    if (!spaceId) return
    const channel = supabase
      .channel(`events-${spaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => load())
      .subscribe()
    // Rechargement quand on revient sur l'app (téléphone mis en veille)
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [spaceId, load])

  return { events, loading, error, reload: load }
}
