import { useEffect, useState } from 'react'
import { isIOS, isStandalone } from '../lib/platform'

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

export default function InstallHint() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone())

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BIPEvent)
    }
    const onInstalled = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) return <p className="muted">Jurassic est installée sur cet appareil.</p>

  if (isIOS()) {
    return (
      <ol className="steps">
        <li>Ouvre ce site dans Safari.</li>
        <li>Touche le bouton Partager (le carré avec une flèche).</li>
        <li>Choisis « Sur l’écran d’accueil », puis « Ajouter ».</li>
        <li>Ouvre Jurassic depuis l’icône pour activer les notifications.</li>
      </ol>
    )
  }

  if (deferred) {
    return (
      <button
        className="btn btn-primary"
        onClick={async () => {
          await deferred.prompt()
          setDeferred(null)
        }}
      >
        Installer Jurassic
      </button>
    )
  }

  return <p className="muted">Dans Chrome : menu ⋮ puis « Installer l’application » ou « Ajouter à l’écran d’accueil ».</p>
}
