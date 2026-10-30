// Récapitulatif du matin des tâches : vers 9 h (heure de Paris), chaque personne reçoit
// une notification avec ses tâches du jour et en retard. Une seule par jour (task_digest_log).
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import { parisParts } from '../_shared/paris.ts'
import { summarize } from './lists.ts'

const HOUR = 9

type Task = { title: string; for_users: string[]; created_by: string | null; due_date: string }
type Notify = (userIds: string[], payload: { title: string; body: string; url: string }) => Promise<void>

const pad = (n: number) => String(n).padStart(2, '0')

export async function sendTaskDigests(admin: SupabaseClient, notify: Notify): Promise<number> {
  const p = parisParts(new Date())
  if (p.hour !== HOUR) return 0
  const today = `${p.year}-${pad(p.month)}-${pad(p.day)}`

  const { data, error } = await admin
    .from('tasks')
    .select('title, for_users, created_by, due_date')
    .eq('done', false)
    .lte('due_date', today)
    .order('due_date')
  if (error || !data?.length) return 0

  const perUser = new Map<string, { late: string[]; today: string[] }>()
  for (const t of data as Task[]) {
    const users = t.for_users?.length ? t.for_users : t.created_by ? [t.created_by] : []
    for (const u of users) {
      const entry = perUser.get(u) ?? { late: [], today: [] }
      ;(t.due_date < today ? entry.late : entry.today).push(t.title)
      perUser.set(u, entry)
    }
  }

  let sent = 0
  for (const [userId, { late, today: due }] of perUser) {
    // L'insertion échoue si le récapitulatif du jour est déjà parti
    const { error: dup } = await admin.from('task_digest_log').insert({ user_id: userId, day: today })
    if (dup) continue
    const n = late.length + due.length
    const lines = [due.length && `Aujourd’hui : ${summarize(due)}`, late.length && `En retard : ${summarize(late)}`].filter(Boolean)
    await notify([userId], { title: n > 1 ? `${n} tâches à faire` : '1 tâche à faire', body: lines.join('\n'), url: '/taches' })
    sent++
  }
  return sent
}
