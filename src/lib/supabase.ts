import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  throw new Error('Variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquantes (fichier .env)')
}

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

export type Profile = { id: string; display_name: string; color: string }
export type Space = { id: string; name: string; invite_code: string; created_by: string | null; met_on?: string | null }

/** Transforme une erreur Supabase/Postgres en message lisible */
export function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) {
    const msg = String((e as { message: string }).message)
    if (msg.includes('Invalid login credentials')) return 'E-mail ou mot de passe incorrect.'
    if (msg.includes('User already registered')) return 'Un compte existe déjà avec cet e-mail.'
    if (msg.includes('Email not confirmed')) return 'Confirme ton e-mail avant de te connecter (lien reçu par mail).'
    if (msg.includes('Password should be')) return 'Le mot de passe doit faire au moins 6 caractères.'
    return msg
  }
  return 'Une erreur est survenue.'
}
