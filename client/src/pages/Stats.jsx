import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Stats.css'

function StatsPage() {
  const navigate = useNavigate()
  const initialUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user'))
    } catch (error) {
      console.warn('Could not parse user from storage', error)
      return null
    }
  }, [])

  const [user, setUser] = useState(initialUser)

  const handleLogout = () => {
    localStorage.removeItem('user')
    setUser(null)
    navigate('/login')
  }

  return (
    <main className="stats-page" aria-labelledby="stats-heading">
      <div className="stats-card">
        <p className="stats-eyebrow">Stats</p>
        <h1 id="stats-heading">Du är på profilsidan</h1>
        <p>Den här ytan reserveras för framtida statistik och profilkomponenter.</p>
        <p className="stats-status">
          {user ? `Inloggad som ${user.email}` : 'Inte inloggad'}
        </p>
        {user && (
          <button type="button" className="stats-logout" onClick={handleLogout}>
            Logga ut
          </button>
        )}
      </div>
    </main>
  )
}

export default StatsPage
