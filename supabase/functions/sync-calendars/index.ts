// Edge Function : recopie les agendas externes (adresses iCal Google / iCloud) dans external_events.
// Appelée toutes les 15 min par pg_cron (en-tête x-cron-secret : tous les agendas),
// ou depuis l'appli (jeton de connexion : ses propres agendas, body { calendar_id? }).
// Déployer avec --no-verify-jwt.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import { parseIcs } from './ics.ts'

const DAY_MS = 86_400_000
const PAST_MS = 31 * DAY_MS
const FUTURE_MS = 366 * DAY_MS
const MAX_BYTES = 10_000_000

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

type Calendar = { id: string; name: string; url: string; content_hash: string | null }

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function download(url: string): Promise<string> {
  let res: Response
  try {
    res = await fetch(url.trim().replace(/^webcal:/i, 'https:'), {
      headers: { 'User-Agent': 'Jurassic/1.0 (+https://jurassic-six.vercel.app)', Accept: 'text/calendar, */*' },
      signal: AbortSignal.timeout(20_000),
    })
  } catch {
    throw new Error('Serveur injoignable : vérifie le lien.')
  }
  if (res.status === 404 || res.status === 410) {
    throw new Error('Lien introuvable : l’agenda a peut-être été retiré ou son adresse renouvelée.')
  }
  if (res.status === 401 || res.status === 403) throw new Error('Accès refusé : ce lien n’est pas public ou secret.')
  if (!res.ok) throw new Error(`Le serveur de l’agenda a répondu ${res.status}.`)
  const body = await res.text()
  if (body.length > MAX_BYTES) throw new Error('Agenda trop volumineux.')
  if (!body.includes('BEGIN:VCALENDAR')) throw new Error('Ce lien ne renvoie pas un agenda au format iCal.')
  return body
}

async function syncOne(admin: SupabaseClient, cal: Calendar) {
  try {
    const now = Date.now()
    const events = parseIcs(await download(cal.url), new Date(now - PAST_MS), new Date(now + FUTURE_MS))
    const hash = await sha256(JSON.stringify(events))

    if (hash === cal.content_hash) {
      await admin.from('external_calendars').update({ last_synced_at: new Date().toISOString(), last_error: null }).eq('id', cal.id)
    } else {
      const { error } = await admin.rpc('replace_external_events', { p_calendar: cal.id, p_hash: hash, p_events: events })
      if (error) throw new Error(error.message)
    }
    return { id: cal.id, ok: true, count: events.length }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await admin.from('external_calendars').update({ last_error: message }).eq('id', cal.id)
    return { id: cal.id, ok: false, error: message }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  let query = admin.from('external_calendars').select('id, name, url, content_hash')

  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
    // Appel depuis l'appli : uniquement ses propres agendas
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Non authentifié' }, 401)
    query = query.eq('user_id', user.id)
    const body = await req.json().catch(() => ({}))
    if (body?.calendar_id) query = query.eq('id', body.calendar_id)
  }

  const { data: calendars, error } = await query
  if (error) return json({ error: error.message }, 500)

  const results = []
  for (const cal of (calendars ?? []) as Calendar[]) results.push(await syncOne(admin, cal))
  return json({ results })
})
