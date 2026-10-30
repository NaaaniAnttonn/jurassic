import { sendPush } from '../../lib/push'

/** Notification à l'autre (sans bloquer ni signaler d'erreur : c'est un bonus) */
export function notifyPartner(title: string, body: string) {
  sendPush({ target: 'partner', title, body, url: '/envies' }).catch(() => undefined)
}

export const photosLabel = (n: number) => (n > 1 ? `${n} photos` : 'une photo')
