import type { ReactNode } from 'react'

export default function ComingSoon({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <p>{text}</p>
    </div>
  )
}
