import type { CSSProperties } from 'react'
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

/** Étiquette pleine à la couleur de la personne ; « Vous deux » : liseré de l'autre couleur ;
 *  événement importé : teinte claire, pour le distinguer d'un coup d'œil */
export function chipStyle(colors: string[], external: boolean): CSSProperties {
  const [c1, c2] = colors
  if (external) {
    return { background: `color-mix(in srgb, ${c1} var(--chip-tint), var(--surface))`, color: 'var(--text)', boxShadow: `inset 3px 0 0 ${c1}` }
  }
  return { background: c1, color: '#fff', boxShadow: c2 ? `inset 4px 0 0 ${c2}` : undefined }
}
