// Anniversaire de rencontre : vers 9 h (heure de Paris), le jour J, les deux reçoivent une notification.
// Une seule par an et par espace (anniversary_log). Né un 29 février : fêté le 28 les autres années.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import { parisParts } from '../_shared/paris.ts'

const HOUR = 9

type Notify = (userIds: string[], payload: { title: string; body: string; url: string }) => Promise<void>

const pad = (n: number) => String(n).padStart(2, '0')
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0

export async function sendAnniversaries(admin: SupabaseClient, notify: Notify): Promise<number> {
  const p = parisParts(new Date())
  if (p.hour !== HOUR) return 0
  const today = `${p.year}-${pad(p.month)}-${pad(p.day)}`

  const { data: spaces, error } = await admin.from('spaces').select('id, met_on').not('met_on', 'is', null)
  if (error || !spaces?.length) return 0

  let sent = 0
  for (const s of spaces as { id: string; met_on: string }[]) {
    const [y, m, d] = s.met_on.split('-').map(Number)
    const sameDay = m === p.month && (d === p.day || (m === 2 && d === 29 && p.day === 28 && !isLeap(p.year)))
    const years = p.year - y
    if (!sameDay || years < 1) continue

    // L'insertion échoue si la notification de cette année est déjà partie
    const { error: dup } = await admin.from('anniversary_log').insert({ space_id: s.id, day: today })
    if (dup) continue
    const { data: members } = await admin.from('space_members').select('user_id').eq('space_id', s.id)
    const ids = (members ?? []).map((mb) => mb.user_id as string)
    if (!ids.length) continue
    await notify(ids, {
      title: 'Joyeux anniversaire !',
      body: years > 1 ? `${years} ans ensemble aujourd’hui.` : 'Un an ensemble aujourd’hui.',
      url: '/agenda',
    })
    sent++
  }
  return sent
}
