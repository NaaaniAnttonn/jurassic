# Jurassic — étape 1 (socle)

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
