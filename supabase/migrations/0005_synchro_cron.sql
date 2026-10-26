-- =====================================================================
-- Jurassic — Étape 3 : import des agendas externes toutes les 15 minutes
-- AVANT d'exécuter : remplace REMPLACE_PAR_TON_SECRET par le même secret
-- que celui donné à `supabase secrets set CRON_SECRET=...` (celui des rappels)
-- =====================================================================

select cron.schedule(
  'jurassic-synchro-agendas',
  '*/15 * * * *',
  $$
  select net.http_post(
    url     := 'https://srbxipfnikqvjztcdqmw.supabase.co/functions/v1/sync-calendars',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'REMPLACE_PAR_TON_SECRET'
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- Pour arrêter un jour : select cron.unschedule('jurassic-synchro-agendas');
