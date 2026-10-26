# Jurassic

PWA de couple (agenda, listes, tâches à deux) — Vite + React 18 + TypeScript, Supabase, Vercel.
Interface et code commentés **en français**. Le README détaille la mise en place étape par étape.

## Environnement
- Dev sous WSL. `npm run dev` répond dans WSL mais n'est pas joignable depuis le Chrome de Windows :
  on teste sur Vercel (https://jurassic-six.vercel.app), qui redéploie à chaque `git push` sur `main`.
- Vérifier avant de commit : `npm run typecheck` puis `npm run build`. Pas de tests automatisés.
- Supabase CLI (`npx supabase`) déjà connectée et liée au projet.
- `.env` (non versionné) : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`
  (mêmes variables dans Vercel).
- Secrets Supabase : `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`.

## Structure
- `src/App.tsx` : session → espace couple → coque à onglets (`/agenda`, `/listes`, `/taches`, `/reglages`).
- `src/context/` : `AuthContext` (session) et `SpaceContext` (espace + profils, temps réel).
- `src/lib/` : client Supabase + `errorMessage()`, notifications push (`push.ts`), détection iOS/standalone.
- `src/modules/<fonctionnalité>/` : un dossier par fonctionnalité (CSS propre au module).
- `src/sw.ts` : service worker maison (vite-plugin-pwa en `injectManifest`) : cache + réception des push.
- `supabase/migrations/` : SQL numéroté, exécuté **à la main** dans le SQL Editor.
- `supabase/functions/` : Edge Functions Deno (`send-push`, `send-reminders`, `calendar-feed`, `sync-calendars`),
  déployées avec `npx supabase functions deploy <nom> --use-api` (`--no-verify-jwt` sauf `send-push`).

## Modèle et conventions
- Un compte = un seul espace (index unique sur `space_members.user_id`). Fonctions SQL
  `create/join/leave_space`, code d'invitation à 6 caractères.
- Toute table métier a `space_id` et une RLS basée sur `public.is_space_member(space_id)`,
  et est ajoutée à la publication `supabase_realtime`.
- Push : le client appelle `sendPush({ target: 'partner' | 'me' | 'all', ... })` → Edge Function `send-push`.

## Étapes
1. **Socle** (comptes, espace couple, push) — en ligne.
2. **Agenda** — en ligne (commit `3813b58`). Table `events` (répétition daily/weekly/monthly/yearly
   expansée côté client dans `recurrence.ts`, `for_users`, `is_private`, `reminder_minutes`).
   Rappels : pg_cron (migration 0003) appelle chaque minute `send-reminders` (déployée
   `--no-verify-jwt`, protégée par l'en-tête `x-cron-secret`), dédoublonnage via `reminder_log`,
   fuseau Europe/Paris. Modifier/supprimer un événement répété agit sur toute la série.
3. **Synchro Google / iCloud** (lecture seule, migrations 0004 à 0006) :
   - Export : `calendar-feed?token=…` sert un .ics par personne (jeton dans `calendar_feeds`, RPC
     `feed_token(p_regenerate)`). Répétitions en RRULE avec `TZID=Europe/Paris`.
   - Import : `external_calendars` (URL secrète, RLS propriétaire seul) → `sync-calendars` (cron 15 min
     ou appel depuis l'appli) parse avec ical.js, déplie les occurrences (−31 j / +366 j) et les écrit
     dans `external_events` via la RPC `replace_external_events` (sautée si le hash n'a pas changé).
   - Visibilité par agenda (migration 0006) : `visibility` = details | busy | hidden. Titre/lieu/notes sont
     dans `external_event_details`, dont la RLS ne les renvoie à l'autre qu'en `details` ; sinon le client
     affiche « Occupé ». Ne jamais remettre ces champs dans `external_events` (lisible par l'autre).
   - Côté client, les `external_events` deviennent des `CalEvent` avec `external` (fiche en lecture seule).
   - Code iCal pur dans `*/ics.ts` (testable avec Node + esbuild), fuseau Paris dans `_shared/paris.ts`.
4. **Listes** et **Tâches** : encore des pages vides (`modules/listes`, `modules/todo`).

## Points d'attention
- Ne jamais commit le vrai `CRON_SECRET` : `0003_rappels_cron.sql` et `0005_synchro_cron.sql` gardent
  le placeholder `REMPLACE_PAR_TON_SECRET` dans le dépôt.
- Nouvelle migration = nouveau fichier `000N_*.sql`, à faire exécuter par l'utilisateur dans Supabase.
- Notifications sur iPhone uniquement depuis l'app ajoutée à l'écran d'accueil.
- `.github/workflows/keep-alive.yml` lit l'API REST Supabase le lundi et le jeudi pour éviter la mise en
  pause du projet gratuit (secrets GitHub `SUPABASE_URL` et `SUPABASE_ANON_KEY`).
- Pousser une modification de `.github/workflows/` exige un jeton GitHub avec le droit `workflow`.
