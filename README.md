# Jurassic

Comptes, espace couple avec code d'invitation, app installable (PWA) et notifications push.
Stack : Vite + React + TypeScript · Supabase · Vercel.

## 1. Lancer en local (WSL)

```bash
cd jurassic
npm install
cp .env.example .env      # puis remplir (étapes 2 et 3)
npm run dev
```
L'app tourne sur http://localhost:5173. Avec `--host`, elle est aussi accessible depuis ton téléphone
sur le même Wi-Fi (adresse affichée dans le terminal), mais les notifications nécessitent HTTPS :
teste-les sur la version Vercel.

## 2. Supabase

1. Crée un projet sur supabase.com (région Europe).
2. **SQL Editor** → colle tout `supabase/migrations/0001_socle.sql` → Run.
3. **Project Settings → API** : copie l'URL et la clé `anon` dans `.env`.
4. **Authentication → URL Configuration** : mets l'adresse Vercel (étape 5) dans *Site URL*,
   et ajoute `http://localhost:5173` dans *Redirect URLs*.
5. Optionnel : **Authentication → Providers → Email** → décoche *Confirm email* pour éviter
   le mail de confirmation (pratique pour une app à deux).

## 3. Notifications push

Génère une paire de clés VAPID :
```bash
npx web-push generate-vapid-keys
```
- Clé **publique** → `.env` : `VITE_VAPID_PUBLIC_KEY=...` (et dans Vercel).
- Les deux clés → secrets Supabase (avec la CLI Supabase, `npx supabase` suffit) :
```bash
npx supabase login
npx supabase link --project-ref TON_REF_PROJET
npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:ton@email.fr
npx supabase functions deploy send-push
```

## 4. GitHub
```bash
git init && git add . && git commit -m "Jurassic : étape 1"
```
Crée un dépôt privé `jurassic` sur GitHub et pousse.

## 5. Vercel
Import du dépôt → framework détecté : Vite. Ajoute les 3 variables `VITE_...` dans
*Environment Variables*, puis Deploy.

## 6. Installer sur les téléphones
- **Android (Chrome)** : ouvrir l'URL → Réglages → « Installer Jurassic », ou menu ⋮ → Installer l'application.
- **iPhone (Safari)** : Partager → « Sur l'écran d'accueil ». Ouvrir depuis l'icône, puis
  Réglages → Notifications → Activer.

## Tester l'étape 1
1. Toi : créer un compte → « Créer l'espace » → un code à 6 caractères s'affiche.
2. Elle : créer un compte → « Rejoindre avec un code ».
3. Ta pastille et la sienne apparaissent en haut à droite chez vous deux, en direct.
4. Réglages → Notifications → Activer, puis « Faire coucou ».

## Structure
```
src/
  context/      Auth + espace couple (temps réel)
  lib/          client Supabase, notifications, détection plateforme
  components/   coque (en-tête, onglets), invitation, icônes
  pages/        connexion, création d'espace, réglages
  modules/      agenda, listes, tâches (un dossier par fonctionnalité)
  sw.ts         service worker (cache hors ligne + réception des notifications)
supabase/
  migrations/   tables, sécurité RLS, fonctions create/join/leave_space
  functions/    send-push (envoi des notifications)
```

---

# Étape 2 : agenda partagé

Vues semaine et mois, événements pour toi / elle / vous deux, répétitions, événements privés,
rappels par notification, notification à l'autre quand un événement le concerne, temps réel.

## Mise en place

1. **Base de données** : Supabase → SQL Editor → colle `supabase/migrations/0002_agenda.sql` → Run.

2. **Fonction des rappels** : choisis un secret (une longue suite de lettres et chiffres), puis :
```bash
npx supabase secrets set CRON_SECRET=TON_SECRET
npx supabase functions deploy send-reminders --no-verify-jwt --use-api
```

3. **Déclenchement chaque minute** : ouvre `supabase/migrations/0003_rappels_cron.sql`,
   remplace `REMPLACE_PAR_TON_SECRET` par ton secret, puis colle-le dans le SQL Editor → Run.
   Si une erreur parle de `pg_cron` ou `pg_net`, active-les dans Database → Extensions puis relance.

4. **Mise en ligne** :
```bash
git add .
git commit -m "Étape 2 : agenda"
git push
```
Vercel redéploie tout seul.

## Bon à savoir
- Modifier ou supprimer un événement répété s'applique à toute la série.
- Les rappels partent pour les personnes concernées par l'événement (fuseau Europe/Paris).
- Pour une journée entière, le rappel est calé sur 9 h (le jour même ou la veille).

---

# Étape 3 : synchro Google Agenda / iCloud

En lecture seule, dans les deux sens :
- **Export** : chacun a un lien d'abonnement iCal personnel (Réglages → « Voir Jurassic dans ton agenda »)
  à ajouter dans Google Agenda ou le Calendrier de l'iPhone. Il contient les événements Jurassic
  (+ tes privés) et les agendas importés par l'autre ; ce qui ne te concerne pas est préfixé du prénom.
- **Import** : chacun colle l'adresse iCal de son agenda (Google : « Adresse secrète au format iCal » ;
  iCloud : lien de « Calendrier public ») dans Réglages → « Importer ton agenda ».
  Les événements apparaissent dans Jurassic en lecture seule. Pour chaque agenda, on choisit ce que
  l'autre en voit : **Détails** (titre, lieu, notes), **Occupé** (créneaux seulement) ou **Masqué**.
  Le même choix s'applique à ce que reçoit son lien d'abonnement.

## Mise en place

1. **Base de données** : SQL Editor → colle `supabase/migrations/0004_synchro_agendas.sql` → Run.

2. **Fonctions** :
```bash
npx supabase functions deploy calendar-feed --no-verify-jwt --use-api
npx supabase functions deploy sync-calendars --no-verify-jwt --use-api
```

3. **Import toutes les 15 minutes** : ouvre `supabase/migrations/0005_synchro_cron.sql`, remplace
   `REMPLACE_PAR_TON_SECRET` par le même secret que pour les rappels, colle-le dans le SQL Editor → Run.

4. **Visibilité Détails / Occupé / Masqué** : SQL Editor → colle `supabase/migrations/0006_visibilite_agendas.sql` → Run,
   puis redéploie `calendar-feed` (commande ci-dessus).

5. **Mise en ligne** : `git add . && git commit -m "Étape 3 : synchro agendas" && git push`.

## Bon à savoir
- Google rafraîchit les agendas auxquels il est abonné quand il veut (souvent plusieurs heures) ;
  l'iPhone est bien plus rapide. On ne peut pas forcer Google.
- Import : on garde les occurrences d'un mois en arrière à un an en avant.
- « Créer un nouveau lien » invalide l'ancien (à faire si le lien a fuité).
