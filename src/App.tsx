import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { SpaceProvider, useSpace } from './context/SpaceContext'
import AuthPage from './pages/AuthPage'
import Onboarding from './pages/Onboarding'
import SettingsPage from './pages/SettingsPage'
import Shell from './components/Shell'
import Splash from './components/Splash'
import AgendaPage from './modules/agenda/AgendaPage'
import ListesPage from './modules/listes/ListesPage'
import TodoPage from './modules/todo/TodoPage'

function SpaceGate() {
  const { space, loading } = useSpace()
  if (loading) return <Splash />
  if (!space) return <Onboarding />
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/agenda" element={<AgendaPage />} />
        <Route path="/listes" element={<ListesPage />} />
        <Route path="/taches" element={<TodoPage />} />
        <Route path="/reglages" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/agenda" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  const { session, loading } = useAuth()
  if (loading) return <Splash />
  if (!session) return <AuthPage />
  return (
    <SpaceProvider key={session.user.id}>
      <SpaceGate />
    </SpaceProvider>
  )
}
