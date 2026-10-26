import { supabase } from './supabase'
import { isIOS, isStandalone } from './platform'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string

export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on'

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export async function getPushState(): Promise<PushState> {
  // Sur iPhone, les notifications ne marchent qu'une fois l'app ajoutée à l'écran d'accueil
  if (isIOS() && !isStandalone()) return 'needs-install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported'
  }
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

export async function enablePush(userId: string) {
  if (!VAPID_PUBLIC_KEY) throw new Error('Clé VAPID manquante (VITE_VAPID_PUBLIC_KEY)')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notifications refusées sur cet appareil.')

  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }))

  const { endpoint, keys } = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, user_agent: navigator.userAgent },
    { onConflict: 'endpoint' },
  )
  if (error) throw error
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

export async function sendPush(payload: {
  target?: 'partner' | 'me' | 'all'
  title: string
  body?: string
  url?: string
}) {
  const { data, error } = await supabase.functions.invoke('send-push', { body: payload })
  if (error) throw error
  return data as { sent: number; total: number }
}
