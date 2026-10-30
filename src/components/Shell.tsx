import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useSpace } from '../context/SpaceContext'
import Duo from './Duo'
import InviteCard from './InviteCard'
import { IconAgenda, IconHeart, IconListes, IconReglages, IconTaches } from './Icons'

const tabs = [
  { to: '/agenda', label: 'Agenda', Icon: IconAgenda },
  { to: '/listes', label: 'Listes', Icon: IconListes },
  { to: '/taches', label: 'Tâches', Icon: IconTaches },
  { to: '/envies', label: 'Envies', Icon: IconHeart },
  { to: '/reglages', label: 'Réglages', Icon: IconReglages },
]

export default function Shell() {
  const { space, me, partner } = useSpace()
  const { pathname } = useLocation()
  const title = tabs.find((t) => pathname.startsWith(t.to))?.label ?? 'Jurassic'

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <p className="topbar-space">{space?.name}</p>
          <h1 className="topbar-title">{title}</h1>
        </div>
        <Duo me={me} partner={partner} />
      </header>

      <main className="content">
        {!partner && !pathname.startsWith('/reglages') && <InviteCard />}
        <Outlet />
      </main>

      <nav className="tabbar" aria-label="Navigation principale">
        {tabs.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `tab${isActive ? ' tab-active' : ''}`}>
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
