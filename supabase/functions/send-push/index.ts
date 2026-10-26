// Edge Function : envoie une notification push aux membres de l'espace
// Body JSON : { target?: 'partner' | 'me' | 'all', title: string, body?: string, url?: string }
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import webpush from 'npm:web-push@3.6.7'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT')!,
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!

    // 1. Qui appelle ?
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return json({ error: 'Non authentifié' }, 401)

    const { target = 'partner', title, body = '', url = '/' } = await req.json()
    if (!title) return json({ error: 'Titre manquant' }, 400)

    // 2. Destinataires dans le même espace
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: me } = await admin.from('space_members').select('space_id').eq('user_id', user.id).maybeSingle()
    if (!me) return json({ error: 'Aucun espace' }, 400)

    const { data: members } = await admin.from('space_members').select('user_id').eq('space_id', me.space_id)
    let ids = (members ?? []).map((m) => m.user_id as string)
    if (target === 'partner') ids = ids.filter((id) => id !== user.id)
    if (target === 'me') ids = [user.id]
    if (ids.length === 0) return json({ sent: 0, total: 0 })

    const { data: subs } = await admin.from('push_subscriptions').select('*').in('user_id', ids)
    if (!subs?.length) return json({ sent: 0, total: 0 })

    // 3. Envoi
    const payload = JSON.stringify({ title, body, url })
    const results = await Promise.allSettled(
      subs.map((s) =>
        webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload),
      ),
    )

    // 4. Nettoyage des appareils désabonnés
    const dead = subs
      .filter((_, i) => {
        const r = results[i]
        return r.status === 'rejected' && [404, 410].includes((r.reason as { statusCode?: number })?.statusCode ?? 0)
      })
      .map((s) => s.id)
    if (dead.length) await admin.from('push_subscriptions').delete().in('id', dead)

    return json({ sent: results.filter((r) => r.status === 'fulfilled').length, total: subs.length })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
