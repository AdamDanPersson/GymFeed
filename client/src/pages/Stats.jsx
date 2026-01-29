import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getStoredUser } from '../lib/apiClient'
import MonthlyVisitsChart from '../components/stats/MonthlyVisitsChart'
import WorkoutBoard from '../components/workout/WorkoutBoard'
import PostBoard from '../components/post/PostBoard'
import ProfileImageBoard from '../components/profile/ProfileImageBoard'
import './Stats.css'

function StatsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const initialUser = useMemo(() => getStoredUser(), [])

  const [user, setUser] = useState(initialUser)
  
  // Check if we should open post creator from navigation
  const openPostCreator = location.state?.openPostCreator || false
  const openProfileImageCreator = location.state?.openProfileImageCreator || false

  // Clear the state after reading it
  useEffect(() => {
    if (location.state?.openPostCreator || location.state?.openProfileImageCreator) {
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state, location.pathname, navigate])

  return (
    <main className="stats-page" aria-labelledby="stats-heading">
      {user && (
        <h1 className="stats-welcome" id="stats-heading">
          Välkommen,<br />
          {user.firstName} {user.lastName}
        </h1>
      )}
      <MonthlyVisitsChart user={user} />
      <WorkoutBoard user={user} />
      <PostBoard user={user} openPostCreator={openPostCreator} />
      <ProfileImageBoard
        user={user}
        openProfileImageCreator={openProfileImageCreator}
        onUserUpdate={setUser}
      />
    </main>
  )
}

export default StatsPage
