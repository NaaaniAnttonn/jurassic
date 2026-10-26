import { useState } from 'react'
import { useSpace } from '../context/SpaceContext'
import { IconShare } from './Icons'

export default function InviteCard() {
  const { space } = useSpace()
  const [copied, setCopied] = useState(false)
  if (!space) return null

  const share = async () => {
    const text = `Rejoins-moi sur Jurassic avec le code ${space.invite_code} : ${window.location.origin}`
    if (navigator.share) {
      await navigator.share({ title: 'Jurassic', text }).catch(() => undefined)
    } else {
      await navigator.clipboard.writeText(space.invite_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <section className="invite">
      <p>Ta moitié n’a pas encore rejoint l’espace. Envoie-lui ce code :</p>
      <div className="invite-row">
        <code className="invite-code">{space.invite_code}</code>
        <button className="btn btn-primary" onClick={share}>
          <IconShare size={18} /> {copied ? 'Code copié' : 'Partager'}
        </button>
      </div>
    </section>
  )
}
