import type { Profile } from '../lib/supabase'

const initial = (p: Profile | null) => (p?.display_name?.trim()?.[0] ?? '?').toUpperCase()

/** Les deux pastilles qui se chevauchent : l'identité visuelle du couple */
export default function Duo({ me, partner, size = 36 }: { me: Profile | null; partner: Profile | null; size?: number }) {
  return (
    <div className="duo" style={{ ['--s' as string]: `${size}px` }} aria-label={partner ? `${me?.display_name} et ${partner.display_name}` : me?.display_name}>
      <span className="duo-dot" style={{ background: me?.color }}>{initial(me)}</span>
      {partner ? (
        <span className="duo-dot" style={{ background: partner.color }}>{initial(partner)}</span>
      ) : (
        <span className="duo-dot duo-empty" title="En attente">+</span>
      )}
    </div>
  )
}
