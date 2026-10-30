// Notification groupée des listes : quelques minutes après le dernier ajout d'une personne dans une liste,
// l'autre reçoit une seule notification qui récapitule les articles (au lieu d'une par article).
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'

const DELAY_MS = 3 * 60 * 1000 // calme après le dernier ajout
const MAX_LISTED = 6

type Pending = { id: string; list_id: string; space_id: string; text: string; checked: boolean; added_by: string | null; created_at: string }
type Notify = (userIds: string[], payload: { title: string; body: string; url: string }) => Promise<void>

/** « lait, œufs, pain et 3 autres » */
export function summarize(texts: string[]): string {
  if (texts.length <= MAX_LISTED) {
    return texts.length > 1 ? `${texts.slice(0, -1).join(', ')} et ${texts.at(-1)}` : texts[0]
  }
  const rest = texts.length - MAX_LISTED + 1
  return `${texts.slice(0, MAX_LISTED - 1).join(', ')} et ${rest} autres`
}

export async function sendListDigests(admin: SupabaseClient, notify: Notify): Promise<number> {
  const { data, error } = await admin
    .from('list_items')
    .select('id, list_id, space_id, text, checked, added_by, created_at')
    .eq('notified', false)
    .order('created_at')
  if (error || !data?.length) return 0

  // Un groupe = une personne dans une liste ; on attend qu'elle ait fini d'ajouter
  const groups = new Map<string, Pending[]>()
  for (const item of data as Pending[]) {
    const key = `${item.list_id}|${item.added_by}`
    groups.set(key, [...(groups.get(key) ?? []), item])
  }
  const now = Date.now()
  const ready = [...groups.values()].filter((g) => now - new Date(g.at(-1)!.created_at).getTime() >= DELAY_MS)
  if (!ready.length) return 0

  const listIds = [...new Set(ready.map((g) => g[0].list_id))]
  const spaceIds = [...new Set(ready.map((g) => g[0].space_id))]
  const [{ data: lists }, { data: members }] = await Promise.all([
    admin.from('lists').select('id, name').in('id', listIds),
    admin.from('space_members').select('space_id, user_id').in('space_id', spaceIds),
  ])
  const authorIds = [...new Set(ready.map((g) => g[0].added_by).filter(Boolean))] as string[]
  const { data: profiles } = await admin.from('profiles').select('id, display_name').in('id', authorIds)

  let sent = 0
  for (const group of ready) {
    const { list_id, space_id, added_by } = group[0]
    // Déjà cochés entre-temps (courses faites ensemble) : rien à annoncer
    const texts = group.filter((i) => !i.checked).map((i) => i.text)
    const recipients = (members ?? []).filter((m) => m.space_id === space_id && m.user_id !== added_by).map((m) => m.user_id as string)
    const list = lists?.find((l) => l.id === list_id)

    if (added_by && texts.length && recipients.length && list) {
      const who = profiles?.find((p) => p.id === added_by)?.display_name || 'L’autre'
      await notify(recipients, { title: list.name, body: `${who} a ajouté ${summarize(texts)}`, url: `/listes/${list_id}` })
      sent++
    }
    await admin.from('list_items').update({ notified: true }).in('id', group.map((i) => i.id))
  }
  return sent
}
