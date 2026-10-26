-- =====================================================================
-- Jurassic — Étape 2 : déclenchement des rappels chaque minute
-- AVANT d'exécuter : remplace REMPLACE_PAR_TON_SECRET par le même secret
-- que celui donné à `supabase secrets set CRON_SECRET=...`
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'jurassic-rappels',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://srbxipfnikqvjztcdqmw.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'REMPLACE_PAR_TON_SECRET'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Pour arrêter les rappels un jour : select cron.unschedule('jurassic-rappels');
