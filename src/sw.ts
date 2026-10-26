/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> }

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

// Réception d'une notification
self.addEventListener('push', (event) => {
  let data = { title: 'Jurassic', body: '', url: '/' }
  try {
    data = { ...data, ...(event.data?.json() ?? {}) }
  } catch {
    if (event.data) data.body = event.data.text()
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url },
    }),
  )
})

// Clic sur la notification : ouvre (ou réveille) l'app sur la bonne page
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url: string = event.notification.data?.url ?? '/'
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = windows[0] as WindowClient | undefined
      if (existing) {
        await existing.navigate(url).catch(() => undefined)
        return existing.focus()
      }
      return self.clients.openWindow(url)
    })(),
  )
})
