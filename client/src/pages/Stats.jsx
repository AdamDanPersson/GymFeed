import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createWorkout, fetchWorkouts, getStoredUser } from '../lib/apiClient'
import './Stats.css'

function StatsPage() {
  const navigate = useNavigate()
  const initialUser = useMemo(() => getStoredUser(), [])

  const [user, setUser] = useState(initialUser)
  const [workouts, setWorkouts] = useState([])
  const [isLoadingWorkouts, setIsLoadingWorkouts] = useState(false)
  const [workoutsError, setWorkoutsError] = useState('')
  const [isCreatingWorkout, setIsCreatingWorkout] = useState(false)
  const [newWorkoutName, setNewWorkoutName] = useState('')
  const [createError, setCreateError] = useState('')
  const [isSavingWorkout, setIsSavingWorkout] = useState(false)

  useEffect(() => {
    if (!user) {
      setWorkouts([])
      return
    }

    let ignore = false
    setIsLoadingWorkouts(true)
    setWorkoutsError('')

    fetchWorkouts()
      .then((data) => {
        if (!ignore) {
          setWorkouts(data)
        }
      })
      .catch((error) => {
        if (!ignore) {
          setWorkoutsError(error.message)
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoadingWorkouts(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [user])

  const handleLogout = () => {
    localStorage.removeItem('user')
    setUser(null)
    setWorkouts([])
    setIsCreatingWorkout(false)
    setNewWorkoutName('')
    setCreateError('')
    setWorkoutsError('')
    navigate('/login')
  }

  const handleShowForm = () => {
    if (!user) {
      return
    }
    setIsCreatingWorkout(true)
    setCreateError('')
  }

  const handleCancelForm = () => {
    setIsCreatingWorkout(false)
    setNewWorkoutName('')
    setCreateError('')
  }

  const handleCreateWorkout = async (event) => {
    event.preventDefault()
    setCreateError('')

    const trimmedName = newWorkoutName.trim()
    if (!trimmedName) {
      setCreateError('Ange ett namn på passet')
      return
    }

    setIsSavingWorkout(true)
    try {
      const workout = await createWorkout({ name: trimmedName })
      setWorkouts((prev) => [workout, ...prev])
      handleCancelForm()
    } catch (error) {
      setCreateError(error.message)
    } finally {
      setIsSavingWorkout(false)
    }
  }

  const formatWorkoutDate = (value) => {
    if (!value) {
      return ''
    }
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
      return ''
    }
    return parsed.toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' })
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

      <section className="pass-menu" aria-label="Pass">
        <h2>Pass</h2>
        <div className="pass-menu__board">
          {isLoadingWorkouts && (
            <p className="pass-menu__message">Laddar pass...</p>
          )}

          {!isLoadingWorkouts && workouts.length === 0 && (
            <p className="pass-menu__empty">Inga pass ännu</p>
          )}

          {workouts.map((workout) => (
            <article className="pass-tile pass-tile--saved" key={workout._id}>
              <span className="pass-tile__label">{workout.name}</span>
              {workout.createdAt && (
                <time className="pass-tile__date" dateTime={workout.createdAt}>
                  {formatWorkoutDate(workout.createdAt)}
                </time>
              )}
            </article>
          ))}

          <button
            type="button"
            className="pass-tile pass-tile--add"
            aria-label="Lägg till nytt pass"
            onClick={handleShowForm}
            disabled={!user || isSavingWorkout || isCreatingWorkout}
          >
            <span aria-hidden="true">+</span>
          </button>
        </div>

        {!user && (
          <p className="pass-menu__message">Du måste logga in för att skapa pass.</p>
        )}

        {workoutsError && (
          <p className="pass-menu__message pass-menu__message--error">{workoutsError}</p>
        )}

        {isCreatingWorkout && (
          <form className="pass-form" onSubmit={handleCreateWorkout}>
            <label className="pass-field">
              <span>Namn på pass</span>
              <input
                type="text"
                value={newWorkoutName}
                onChange={(event) => setNewWorkoutName(event.target.value)}
                placeholder="Ex. Push"
                maxLength={60}
                autoFocus
              />
            </label>
            <div className="pass-form__actions">
              <button type="submit" className="stats-primary" disabled={isSavingWorkout}>
                {isSavingWorkout ? 'Sparar...' : 'Spara'}
              </button>
              <button type="button" className="stats-secondary" onClick={handleCancelForm}>
                Avbryt
              </button>
            </div>
            {createError && (
              <p className="pass-menu__message pass-menu__message--error">{createError}</p>
            )}
          </form>
        )}
      </section>
    </main>
  )
}

export default StatsPage
