import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createWorkout, fetchWorkouts, getStoredUser, reorderWorkouts } from '../lib/apiClient'
import './Stats.css'

function StatsPage() {
  const navigate = useNavigate()
  const initialUser = useMemo(() => getStoredUser(), [])

  const [user, setUser] = useState(initialUser)

  const handleLogout = useCallback(() => {
    localStorage.removeItem('user')
    setUser(null)
    navigate('/login')
  }, [navigate])

  return (
    <main className="stats-page" aria-labelledby="stats-heading">
      <StatsCard user={user} onLogout={handleLogout} />
      <WorkoutBoard user={user} />
    </main>
  )
}

const StatsCard = memo(function StatsCard({ user, onLogout }) {
  return (
    <div className="stats-card">
      <p className="stats-eyebrow">Stats</p>
      <h1 id="stats-heading">Du är på profilsidan</h1>
      <p>Den här ytan reserveras för framtida statistik och profilkomponenter.</p>
      <p className="stats-status">
        {user ? `Inloggad som ${user.email}` : 'Inte inloggad'}
      </p>
      {user && (
        <button type="button" className="stats-logout" onClick={onLogout}>
          Logga ut
        </button>
      )}
    </div>
  )
})

function WorkoutBoard({ user }) {
  const [workouts, setWorkouts] = useState([])
  const [isLoadingWorkouts, setIsLoadingWorkouts] = useState(false)
  const [workoutsError, setWorkoutsError] = useState('')
  const [isCreatingWorkout, setIsCreatingWorkout] = useState(false)
  const [newWorkoutName, setNewWorkoutName] = useState('')
  const [createError, setCreateError] = useState('')
  const [isSavingWorkout, setIsSavingWorkout] = useState(false)
  const [isReordering, setIsReordering] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    })
  )

  useEffect(() => {
    if (!user) {
      setWorkouts([])
      setIsCreatingWorkout(false)
      setNewWorkoutName('')
      setCreateError('')
      setWorkoutsError('')
      setIsLoadingWorkouts(false)
      setIsSavingWorkout(false)
      setIsReordering(false)
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

  const handleShowForm = useCallback(() => {
    if (!user) {
      return
    }
    setIsCreatingWorkout(true)
    setCreateError('')
  }, [user])

  const handleCancelForm = useCallback(() => {
    setIsCreatingWorkout(false)
    setNewWorkoutName('')
    setCreateError('')
  }, [])

  const handleCreateWorkout = useCallback(async (event) => {
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
  }, [handleCancelForm, newWorkoutName])

  const handleDragEnd = useCallback(async (event) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = workouts.findIndex((w) => w._id === active.id)
    const newIndex = workouts.findIndex((w) => w._id === over.id)

    if (oldIndex === -1 || newIndex === -1) {
      return
    }

    const reorderedWorkouts = arrayMove(workouts, oldIndex, newIndex)
    setWorkouts(reorderedWorkouts)

    setIsReordering(true)
    try {
      const workoutIds = reorderedWorkouts.map((w) => w._id)
      await reorderWorkouts(workoutIds)
    } catch (error) {
      setWorkoutsError(error.message)
      fetchWorkouts()
        .then((data) => setWorkouts(data))
        .catch(() => {})
    } finally {
      setIsReordering(false)
    }
  }, [workouts])

  const formatWorkoutDate = useCallback((value) => {
    if (!value) {
      return ''
    }
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
      return ''
    }
    return parsed.toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' })
  }, [])

  return (
    <section className="pass-menu" aria-label="Pass">
      <h2>Pass</h2>
      <div className="pass-menu__board">
        {isLoadingWorkouts && (
          <p className="pass-menu__message">Laddar pass...</p>
        )}

        {!isLoadingWorkouts && workouts.length === 0 && (
          <p className="pass-menu__empty">Inga pass ännu</p>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={workouts.map((w) => w._id)} strategy={rectSortingStrategy}>
            {workouts.map((workout) => (
              <SortableWorkoutTile
                key={workout._id}
                workout={workout}
                formatWorkoutDate={formatWorkoutDate}
              />
            ))}
          </SortableContext>
        </DndContext>

        <button
          type="button"
          className="pass-tile pass-tile--add"
          aria-label="Lägg till nytt pass"
          onClick={handleShowForm}
          disabled={!user || isSavingWorkout || isCreatingWorkout || isReordering}
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

      {isReordering && (
        <p className="pass-menu__message">Sparar ordning...</p>
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
  )
}

function SortableWorkoutTile({ workout, formatWorkoutDate }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: workout._id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`pass-tile pass-tile--saved ${isDragging ? 'pass-tile--dragging' : ''}`}
    >
      <div className="pass-tile__content">
        <h3>{workout.name}</h3>
        <time dateTime={workout.createdAt}>
          {formatWorkoutDate(workout.createdAt)}
        </time>
      </div>
      <button
        type="button"
        className="pass-tile__grip"
        aria-label="Dra för att sortera"
        {...attributes}
        {...listeners}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <circle cx="4" cy="3" r="1.5" />
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="12" cy="3" r="1.5" />
          <circle cx="4" cy="8" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="12" cy="8" r="1.5" />
          <circle cx="4" cy="13" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
          <circle cx="12" cy="13" r="1.5" />
        </svg>
      </button>
    </div>
  )
}

export default StatsPage
