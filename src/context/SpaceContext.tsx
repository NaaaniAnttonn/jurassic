import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase, type Profile, type Space } from '../lib/supabase'
import { useAuth } from './AuthContext'

type SpaceValue = {
  space: Space | null
  me: Profile | null
  partner: Profile | null
  loading: boolean
  refresh: () => Promise<void>
}

const SpaceContext = createContext<SpaceValue | null>(null)

export function SpaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [space, setSpace] = useState<Space | null>(null)
  const [me, setMe] = useState<Profile | null>(null)
  const [partner, setPartner] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) return
    const { data: membership } = await supabase
      .from('space_members')
      .select('space_id, spaces(*)')
      .eq('user_id', user.id)
      .maybeSingle()

    const currentSpace = (membership?.spaces as unknown as Space) ?? null
    setSpace(currentSpace)

    if (currentSpace) {
      const { data: members } = await supabase
        .from('space_members')
        .select('user_id')
        .eq('space_id', currentSpace.id)
      const ids = (members ?? []).map((m) => m.user_id as string)
      const { data: profiles } = await supabase.from('profiles').select('id, display_name, color').in('id', ids)
      setMe(profiles?.find((p) => p.id === user.id) ?? null)
      setPartner(profiles?.find((p) => p.id !== user.id) ?? null)
    } else {
      const { data: profile } = await supabase.from('profiles').select('id, display_name, color').eq('id', user.id).maybeSingle()
      setMe(profile ?? null)
      setPartner(null)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    setLoading(true)
    refresh()
  }, [refresh])

  // Temps réel : arrivée du/de la partenaire, changement de nom ou de couleur
  useEffect(() => {
    if (!space) return
    const channel = supabase
      .channel(`space-${space.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'space_members', filter: `space_id=eq.${space.id}` }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, refresh)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [space, refresh])

  return <SpaceContext.Provider value={{ space, me, partner, loading, refresh }}>{children}</SpaceContext.Provider>
}

export function useSpace() {
  const ctx = useContext(SpaceContext)
  if (!ctx) throw new Error('useSpace doit être utilisé dans <SpaceProvider>')
  return ctx
}
