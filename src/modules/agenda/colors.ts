import type { Profile } from '../../lib/supabase'
import type { CalEvent } from './types'

/** Couleurs des personnes concernées par l'événement */
export function eventColors(ev: CalEvent, me: Profile | null, partner: Profile | null): string[] {
  const colors: string[] = []
  if (me && ev.for_users.includes(me.id)) colors.push(me.color)
  if (partner && ev.for_users.includes(partner.id)) colors.push(partner.color)
  return colors.length ? colors : ['var(--muted)']
}

/** Libellé texte (pour ne pas dépendre uniquement de la couleur) */
export function whoLabel(ev: CalEvent, me: Profile | null, partner: Profile | null): string {
  const hasMe = !!me && ev.for_users.includes(me.id)
  const hasPartner = !!partner && ev.for_users.includes(partner.id)
  if (hasMe && hasPartner) return 'Vous deux'
  if (hasPartner) return partner!.display_name
  return 'Toi'
}

export function barStyle(colors: string[]) {
  return colors.length > 1
    ? { background: `linear-gradient(to bottom, ${colors[0]} 50%, ${colors[1]} 50%)` }
    : { background: colors[0] }
}
