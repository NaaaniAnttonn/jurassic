import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSpace } from '../../context/SpaceContext'
import type { Task } from './types'

/** Tâches de l'espace, en temps réel */
export function useTasks() {
  const { space } = useSpace()
  const spaceId = space?.id
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout>>()

  const load = useCallback(async () => {
    if (!spaceId) return
    const { data, error } = await supabase.from('tasks').select('*').eq('space_id', spaceId).order('due_date').order('created_at')
    if (error) setError(error.message)
    else {
      setTasks(data as Task[])
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
      .channel(`tasks-${spaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `space_id=eq.${spaceId}` }, loadSoon)
      .subscribe()
    // Retour sur l'app (et changement de jour : « aujourd'hui » a bougé)
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
      clearTimeout(timer.current)
    }
  }, [spaceId, load, loadSoon])

  /** Modifie l'affichage tout de suite, puis la base ; en cas d'échec on recharge */
  const patchTasks = useCallback(
    async (ids: string[], patch: Partial<Task>) => {
      setTasks((prev) => prev.map((t) => (ids.includes(t.id) ? { ...t, ...patch } : t)))
      const { error } = await supabase.from('tasks').update(patch).in('id', ids)
      if (error) {
        setError(error.message)
        load()
      }
      return error
    },
    [load],
  )

  return { tasks, setTasks, loading, error, setError, reload: load, patchTasks }
}
