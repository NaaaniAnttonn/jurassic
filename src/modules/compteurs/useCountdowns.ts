import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSpace } from '../../context/SpaceContext'
import { toDateInput } from '../agenda/dates'

export type Countdown = { id: string; space_id: string; title: string; date: string; created_by: string | null; created_at: string }

/** Comptes à rebours de l'espace, en temps réel */
export function useCountdowns() {
  const { space } = useSpace()
  const spaceId = space?.id
  const [countdowns, setCountdowns] = useState<Countdown[]>([])

  const load = useCallback(async () => {
    if (!spaceId) return
    const { data, error } = await supabase.from('countdowns').select('*').eq('space_id', spaceId).order('date')
    // Table absente ou erreur passagère : la bande reste simplement vide
    if (error) return
    const today = toDateInput(new Date())
    const list = data as Countdown[]
    setCountdowns(list.filter((c) => c.date >= today))
    // Les dates passées disparaissent le lendemain
    const past = list.filter((c) => c.date < today).map((c) => c.id)
    if (past.length) supabase.from('countdowns').delete().in('id', past).then(() => undefined)
  }, [spaceId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!spaceId) return
    const channel = supabase
      .channel(`countdowns-${spaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'countdowns', filter: `space_id=eq.${spaceId}` }, load)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [spaceId, load])

  return { countdowns, reload: load }
}
