// Edge Function : flux iCal d'une personne, auquel s'abonnent Google Agenda et Calendrier (iPhone).
// GET /calendar-feed?token=... — déployer avec --no-verify-jwt ; le jeton secret fait office d'accès.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { buildCalendar, type FeedEvent } from './ics.ts'

const YEAR_MS = 365 * 86_400_000

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get('token') ?? ''
  if (!/^[0-9a-f]{64}$/.test(token)) return new Response('Lien invalide', { status: 404 })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: feed } = await admin.from('calendar_feeds').select('user_id').eq('token', token).maybeSingle()
  if (!feed) return new Response('Lien invalide ou renouvelé', { status: 404 })
  const userId = feed.user_id as string

  const { data: membership } = await admin.from('space_members').select('space_id, spaces(name)').eq('user_id', userId).maybeSingle()
  if (!membership) return new Response('Aucun espace', { status: 404 })
  const spaceId = membership.space_id as string
  const spaceName = (membership.spaces as unknown as { name: string } | null)?.name ?? 'Jurassic'

  const { data: members } = await admin.from('space_members').select('user_id').eq('space_id', spaceId)
  const { data: profiles } = await admin.from('profiles').select('id, display_name').in('id', (members ?? []).map((m) => m.user_id))
  const names = new Map((profiles ?? []).map((p) => [p.id as string, (p.display_name as string) || 'L’autre']))

  // Ce qui ne concerne pas l'abonné est préfixé du prénom concerné : « Léa · Dentiste »
  const label = (title: string, concerned: string[]) =>
    concerned.includes(userId) || !concerned.length ? title : `${concerned.map((id) => names.get(id) ?? '?').join(' et ')} · ${title}`

  const since = new Date(Date.now() - YEAR_MS).toISOString()

  // Événements Jurassic (les privés de l'autre restent exclus)
  const { data: events, error } = await admin
    .from('events')
    .select('id, title, location, notes, start_at, end_at, all_day, recurrence, recurrence_until, for_users, is_private, created_by, updated_at')
    .eq('space_id', spaceId)
    .or(`is_private.eq.false,created_by.eq.${userId}`)
  if (error) return new Response(error.message, { status: 500 })

  // Agendas importés par l'autre (les siens sont déjà dans son propre agenda)
  const { data: imported } = await admin
    .from('external_events')
    .select('id, calendar_id, uid, title, location, notes, start_at, end_at, all_day, user_id')
    .eq('space_id', spaceId)
    .eq('shared', true)
    .neq('user_id', userId)
    .gte('end_at', since)

  const feedEvents: FeedEvent[] = [
    ...(events ?? []).filter((e) => e.recurrence || new Date(e.end_at) >= new Date(since)).map((e) => ({
      uid: `${e.id}@jurassic`,
      title: label(e.title, e.is_private ? [e.created_by] : e.for_users),
      location: e.location,
      notes: e.notes,
      start_at: e.start_at,
      end_at: e.end_at,
      all_day: e.all_day,
      recurrence: e.recurrence,
      recurrence_until: e.recurrence_until,
      updated_at: e.updated_at,
    })),
    ...(imported ?? []).map((e) => ({
      uid: `${e.calendar_id}-${e.start_at}-${e.uid}@jurassic-import`,
      title: label(e.title, [e.user_id]),
      location: e.location,
      notes: e.notes,
      start_at: e.start_at,
      end_at: e.end_at,
      all_day: e.all_day,
      recurrence: null,
      recurrence_until: null,
      updated_at: e.start_at,
    })),
  ]

  return new Response(buildCalendar(spaceName, feedEvents), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="jurassic.ics"',
      'Cache-Control': 'no-cache',
    },
  })
})
