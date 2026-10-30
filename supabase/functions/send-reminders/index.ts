// Edge Function appelée chaque minute par pg_cron : envoie les rappels d'événements
// les notifications groupées des listes (lists.ts) et le récapitulatif du matin des tâches (tasks.ts).
// Déployer avec --no-verify-jwt ; protégée par l'en-tête x-cron-secret.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import webpush from 'npm:web-push@3.6.7'
import { sendListDigests } from './lists.ts'
import { sendTaskDigests } from './tasks.ts'

const TZ = 'Europe/Paris'
const WINDOW_MS = 5 * 60 * 1000 // rattrape un éventuel retard du cron
const DAY_MS = 86_400_000

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT')!,
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

type Ev = {
  id: string
  title: string
  location: string | null
  start_at: string
  all_day: boolean
  recurrence: 'daily' | 'weekly' | 'monthly' | 'yearly' | null
  recurrence_until: string | null
  for_users: string[]
  is_private: boolean
  created_by: string
  reminder_minutes: number
}

/** Décalage (en minutes) entre l'heure de Paris et UTC à un instant donné */
function tzOffsetMin(d: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(d)
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return Math.round((asUtc - d.getTime()) / 60000)
}

/** Débuts d'occurrences compris dans [from, to], en gardant l'heure locale (changements d'heure inclus) */
function* occurrences(ev: Ev, from: Date, to: Date): Generator<Date> {
  const start = new Date(ev.start_at)
  if (!ev.recurrence) {
    if (start >= from && start <= to) yield start
    return
  }
  const baseOff = tzOffsetMin(start)
  const local = new Date(start.getTime() + baseOff * 60000) // champs UTC = heure locale de Paris
  const until = ev.recurrence_until ? new Date(`${ev.recurrence_until}T23:59:59Z`) : null

  let i0 = 0
  if (ev.recurrence === 'daily' || ev.recurrence === 'weekly') {
    const step = ev.recurrence === 'daily' ? DAY_MS : 7 * DAY_MS
    i0 = Math.max(0, Math.floor((from.getTime() - start.getTime()) / step) - 1)
  }

  for (let i = i0; i < i0 + 2000; i++) {
    const n = new Date(Date.UTC(
      local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), local.getUTCHours(), local.getUTCMinutes(),
    ))
    if (ev.recurrence === 'daily') n.setUTCDate(n.getUTCDate() + i)
    if (ev.recurrence === 'weekly') n.setUTCDate(n.getUTCDate() + 7 * i)
    if (ev.recurrence === 'monthly') {
      n.setUTCMonth(n.getUTCMonth() + i)
      if (n.getUTCDate() !== local.getUTCDate()) continue // pas de 31 dans ce mois
    }
    if (ev.recurrence === 'yearly') {
      n.setUTCFullYear(n.getUTCFullYear() + i)
      if (n.getUTCMonth() !== local.getUTCMonth()) continue // 29 février
    }
    const guess = new Date(n.getTime() - baseOff * 60000)
    const occ = new Date(n.getTime() - tzOffsetMin(guess) * 60000)
    if (occ > to || (until && occ > until)) break
    if (occ >= from) yield occ
  }
}

function describe(ev: Ev, occ: Date): string {
  const date = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(occ)
  const time = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(occ)
  const when = ev.all_day ? `${date}, toute la journée` : `${date} à ${time}`
  return ev.location ? `${when}, ${ev.location}` : when
}

async function notify(admin: SupabaseClient, userIds: string[], payload: { title: string; body: string; url: string }) {
  const { data: subs } = await admin.from('push_subscriptions').select('*').in('user_id', userIds)
  if (!subs?.length) return
  const body = JSON.stringify(payload)
  const results = await Promise.allSettled(
    subs.map((s) => webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body)),
  )
  const dead = subs
    .filter((_, i) => {
      const r = results[i]
      return r.status === 'rejected' && [404, 410].includes((r.reason as { statusCode?: number })?.statusCode ?? 0)
    })
    .map((s) => s.id)
  if (dead.length) await admin.from('push_subscriptions').delete().in('id', dead)
}

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
    return new Response('Interdit', { status: 401 })
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: events, error } = await admin
    .from('events')
    .select('id, title, location, start_at, all_day, recurrence, recurrence_until, for_users, is_private, created_by, reminder_minutes')
    .not('reminder_minutes', 'is', null)
  if (error) return new Response(error.message, { status: 500 })

  const now = Date.now()
  let sent = 0

  for (const ev of (events ?? []) as Ev[]) {
    const lead = ev.reminder_minutes * 60000
    const anchor = ev.all_day ? 9 * 3600000 : 0 // journée entière : rappel calé sur 9 h
    const from = new Date(now - WINDOW_MS + lead - anchor)
    const to = new Date(now + lead - anchor)

    for (const occ of occurrences(ev, from, to)) {
      // L'insertion échoue si ce rappel a déjà été envoyé
      const { error: dup } = await admin.from('reminder_log').insert({ event_id: ev.id, occurrence_start: occ.toISOString() })
      if (dup) continue
      const users = ev.is_private || !ev.for_users?.length ? [ev.created_by] : ev.for_users
      await notify(admin, users, { title: ev.title, body: describe(ev, occ), url: '/agenda' })
      sent++
    }
  }

  const push = (userIds: string[], payload: { title: string; body: string; url: string }) => notify(admin, userIds, payload)
  const lists = await sendListDigests(admin, push)
  const tasks = await sendTaskDigests(admin, push)

  return new Response(JSON.stringify({ sent, lists, tasks }), { headers: { 'Content-Type': 'application/json' } })
})
