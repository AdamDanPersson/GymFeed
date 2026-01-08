import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import {
  addWorkoutExercise,
  createWorkout,
  deleteWorkoutExercise,
  fetchWorkoutExercises,
  fetchWorkouts,
  getStoredUser,
  reorderWorkoutExercises,
  reorderWorkouts,
  renameWorkoutExercise
} from '../lib/apiClient'
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

  const [selectedWorkoutId, setSelectedWorkoutId] = useState(null)
  const [exerciseLinks, setExerciseLinks] = useState([])
  const [isLoadingExercises, setIsLoadingExercises] = useState(false)
  const [exercisesError, setExercisesError] = useState('')
  const [isAddingExercise, setIsAddingExercise] = useState(false)
  const [newExerciseName, setNewExerciseName] = useState('')
  const [isSavingExercise, setIsSavingExercise] = useState(false)
  const [isReorderingExercises, setIsReorderingExercises] = useState(false)

  const [openMenuExerciseId, setOpenMenuExerciseId] = useState(null)
  const [confirmDeleteExerciseId, setConfirmDeleteExerciseId] = useState(null)
  const [renameModeExerciseId, setRenameModeExerciseId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameSavingId, setRenameSavingId] = useState(null)
  const [moveModeExerciseId, setMoveModeExerciseId] = useState(null)
  const [selectedMoveWorkoutId, setSelectedMoveWorkoutId] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    })
  )

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpenMenuExerciseId(null)
        setConfirmDeleteExerciseId(null)
        setRenameModeExerciseId(null)
        setRenameValue('')
        setMoveModeExerciseId(null)
        setSelectedMoveWorkoutId('')
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

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

      setSelectedWorkoutId(null)
      setExerciseLinks([])
      setIsLoadingExercises(false)
      setExercisesError('')
      setIsAddingExercise(false)
      setNewExerciseName('')
      setIsSavingExercise(false)
      setIsReorderingExercises(false)
      setOpenMenuExerciseId(null)
      setConfirmDeleteExerciseId(null)
      setRenameModeExerciseId(null)
      setRenameValue('')
      setMoveModeExerciseId(null)
      setSelectedMoveWorkoutId('')
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

  useEffect(() => {
    if (!selectedWorkoutId) {
      return
    }

    // If the selected workout was deleted, close the panel.
    if (!workouts.some((w) => w._id === selectedWorkoutId)) {
      setSelectedWorkoutId(null)
      setExerciseLinks([])
      setExercisesError('')
      setIsAddingExercise(false)
      setNewExerciseName('')
      setOpenMenuExerciseId(null)
      setConfirmDeleteExerciseId(null)
      setRenameModeExerciseId(null)
      setRenameValue('')
      setMoveModeExerciseId(null)
      setSelectedMoveWorkoutId('')
    }
  }, [selectedWorkoutId, workouts])

  useEffect(() => {
    const ids = exerciseLinks.map((item) => item.linkId)

    if (openMenuExerciseId && !ids.includes(openMenuExerciseId)) {
      setOpenMenuExerciseId(null)
    }
    if (confirmDeleteExerciseId && !ids.includes(confirmDeleteExerciseId)) {
      setConfirmDeleteExerciseId(null)
    }
    if (renameModeExerciseId && !ids.includes(renameModeExerciseId)) {
      setRenameModeExerciseId(null)
      setRenameValue('')
    }
    if (moveModeExerciseId && !ids.includes(moveModeExerciseId)) {
      setMoveModeExerciseId(null)
      setSelectedMoveWorkoutId('')
    }
  }, [confirmDeleteExerciseId, exerciseLinks, moveModeExerciseId, openMenuExerciseId, renameModeExerciseId])

  const selectedWorkout = useMemo(() => {
    if (!selectedWorkoutId) {
      return null
    }
    return workouts.find((w) => w._id === selectedWorkoutId) || null
  }, [selectedWorkoutId, workouts])

  const loadExercises = useCallback(async (workoutId) => {
    setIsLoadingExercises(true)
    setExercisesError('')
    try {
      const data = await fetchWorkoutExercises(workoutId)
      setExerciseLinks(data)
    } catch (error) {
      setExercisesError(error.message)
      setExerciseLinks([])
    } finally {
      setIsLoadingExercises(false)
    }
  }, [])

  const handleSelectWorkout = useCallback(
    async (workoutId) => {
      if (!user) {
        return
      }

      setExercisesError('')
      setIsAddingExercise(false)
      setNewExerciseName('')

      setSelectedWorkoutId((prev) => {
        const next = prev === workoutId ? null : workoutId
        return next
      })

      // We can't rely on setState above being applied synchronously; decide based on current selectedWorkoutId.
      const willOpen = selectedWorkoutId !== workoutId
      if (willOpen) {
        await loadExercises(workoutId)
      } else {
        setExerciseLinks([])
      }
    },
    [loadExercises, selectedWorkoutId, user]
  )

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

  const handleExercisesDragEnd = useCallback(
    async (event) => {
      const { active, over } = event

      if (!selectedWorkoutId) {
        return
      }

      if (!over || active.id === over.id) {
        return
      }

      const oldIndex = exerciseLinks.findIndex((item) => item.linkId === active.id)
      const newIndex = exerciseLinks.findIndex((item) => item.linkId === over.id)

      if (oldIndex === -1 || newIndex === -1) {
        return
      }

      const reordered = arrayMove(exerciseLinks, oldIndex, newIndex)
      setExerciseLinks(reordered)

      setIsReorderingExercises(true)
      setExercisesError('')
      try {
        const payload = reordered.map((item, index) => ({ linkId: item.linkId, order: index }))
        await reorderWorkoutExercises(selectedWorkoutId, payload)
      } catch (error) {
        setExercisesError(error.message)
        await loadExercises(selectedWorkoutId)
      } finally {
        setIsReorderingExercises(false)
      }
    },
    [exerciseLinks, loadExercises, selectedWorkoutId]
  )

  const handleShowExerciseForm = useCallback(() => {
    if (!user || !selectedWorkoutId) {
      return
    }
    setIsAddingExercise(true)
    setNewExerciseName('')
    setExercisesError('')
  }, [selectedWorkoutId, user])

  const handleCancelExerciseForm = useCallback(() => {
    setIsAddingExercise(false)
    setNewExerciseName('')
  }, [])

  const handleCreateExercise = useCallback(
    async (event) => {
      event.preventDefault()
      if (!selectedWorkoutId) {
        return
      }

      const trimmed = newExerciseName.trim()
      if (!trimmed) {
        setExercisesError('Ange ett namn på övningen')
        return
      }

      setIsSavingExercise(true)
      setExercisesError('')
      try {
        const created = await addWorkoutExercise(selectedWorkoutId, { name: trimmed })
        setExerciseLinks((prev) => [...prev, created])
        setIsAddingExercise(false)
        setNewExerciseName('')
      } catch (error) {
        setExercisesError(error.message)
      } finally {
        setIsSavingExercise(false)
      }
    },
    [newExerciseName, selectedWorkoutId]
  )

  const handleToggleExerciseMenu = useCallback((exerciseId) => {
    setExercisesError('')
    setOpenMenuExerciseId((prev) => (prev === exerciseId ? null : exerciseId))
    setConfirmDeleteExerciseId(null)
    setRenameModeExerciseId(null)
    setRenameValue('')
    setMoveModeExerciseId(null)
    setSelectedMoveWorkoutId('')
  }, [])

  const handleCloseExerciseMenu = useCallback(() => {
    setOpenMenuExerciseId(null)
  }, [])

  const handleRequestDelete = useCallback((exerciseId) => {
    setConfirmDeleteExerciseId(exerciseId)
    setOpenMenuExerciseId(null)
    setRenameModeExerciseId(null)
    setRenameValue('')
    setMoveModeExerciseId(null)
    setSelectedMoveWorkoutId('')
  }, [])

  const handleConfirmDelete = useCallback(async (exerciseId) => {
    if (!selectedWorkoutId) {
      return
    }

    setExercisesError('')
    try {
      await deleteWorkoutExercise(selectedWorkoutId, exerciseId)
      setExerciseLinks((prev) => prev.filter((item) => item.linkId !== exerciseId))
    } catch (error) {
      setExercisesError(error.message)
    } finally {
      setConfirmDeleteExerciseId(null)
      setOpenMenuExerciseId(null)
    }
  }, [selectedWorkoutId])

  const handleCancelDelete = useCallback(() => {
    setConfirmDeleteExerciseId(null)
  }, [])

  const handleStartRename = useCallback((exerciseId, currentName) => {
    setRenameModeExerciseId(exerciseId)
    setRenameValue(currentName || '')
    setOpenMenuExerciseId(null)
    setConfirmDeleteExerciseId(null)
    setMoveModeExerciseId(null)
    setSelectedMoveWorkoutId('')
  }, [])

  const handleRenameSave = useCallback(async (exerciseId) => {
    if (!selectedWorkoutId || renameModeExerciseId !== exerciseId) {
      return
    }

    const trimmed = renameValue.trim()
    if (!trimmed) {
      setExercisesError('Ange ett namn för att spara')
      return
    }

    setExercisesError('')
    setRenameSavingId(exerciseId)
    try {
      const updated = await renameWorkoutExercise(selectedWorkoutId, exerciseId, { name: trimmed })
      setExerciseLinks((prev) => prev.map((item) => (
        item.linkId === exerciseId ? { ...item, name: updated.name } : item
      )))
      setRenameModeExerciseId(null)
      setRenameValue('')
    } catch (error) {
      setExercisesError(error.message)
    } finally {
      setRenameSavingId(null)
    }
  }, [renameModeExerciseId, renameValue, selectedWorkoutId])

  const handleCancelRename = useCallback(() => {
    setRenameModeExerciseId(null)
    setRenameValue('')
  }, [])

  const handleCopyExercise = useCallback((exerciseId) => {
    setOpenMenuExerciseId(null)

    setExerciseLinks((prev) => {
      const index = prev.findIndex((item) => item.linkId === exerciseId)
      if (index === -1) {
        return prev
      }

      const base = prev[index]
      const copyId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
      const duplicated = { ...base, linkId: `${exerciseId}-copy-${copyId}`, name: `${base.name} (kopia)` }

      const next = [...prev]
      next.splice(index + 1, 0, duplicated)
      console.log('copy', duplicated.linkId, 'from', exerciseId)
      return next
    })
  }, [])

  const handleStartMove = useCallback((exerciseId) => {
    const fallbackWorkout = workouts.find((w) => w._id !== selectedWorkoutId)

    setMoveModeExerciseId(exerciseId)
    setSelectedMoveWorkoutId(fallbackWorkout?._id || '')
    setOpenMenuExerciseId(null)
    setConfirmDeleteExerciseId(null)
    setRenameModeExerciseId(null)
    setRenameValue('')
  }, [selectedWorkoutId, workouts])

  const handleMoveConfirm = useCallback(() => {
    if (!moveModeExerciseId || !selectedMoveWorkoutId) {
      return
    }

    console.log('move', moveModeExerciseId, 'to', selectedMoveWorkoutId)

    if (selectedMoveWorkoutId !== selectedWorkoutId) {
      setExerciseLinks((prev) => prev.filter((item) => item.linkId !== moveModeExerciseId))
    }

    setMoveModeExerciseId(null)
    setSelectedMoveWorkoutId('')
  }, [moveModeExerciseId, selectedMoveWorkoutId, selectedWorkoutId])

  const handleCancelMove = useCallback(() => {
    setMoveModeExerciseId(null)
    setSelectedMoveWorkoutId('')
  }, [])

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
                onSelect={handleSelectWorkout}
                isSelected={workout._id === selectedWorkoutId}
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

      {selectedWorkout && (
        <section className="exercises-panel" aria-label="Övningar">
          <div className="exercises-panel__header">
            <h3>Övningar</h3>
            <p className="exercises-panel__subtitle">{selectedWorkout.name}</p>
          </div>

          {isLoadingExercises && (
            <p className="pass-menu__message">Laddar övningar...</p>
          )}

          {!isLoadingExercises && (
            <div className="exercises-panel__list">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleExercisesDragEnd}
              >
                <SortableContext items={exerciseLinks.map((item) => item.linkId)} strategy={rectSortingStrategy}>
                  {exerciseLinks.map((item) => (
                    <SortableExerciseRow
                      key={item.linkId}
                      item={item}
                      workouts={workouts}
                      currentWorkoutId={selectedWorkoutId}
                      isMenuOpen={openMenuExerciseId === item.linkId}
                      onToggleMenu={() => handleToggleExerciseMenu(item.linkId)}
                      onCloseMenu={handleCloseExerciseMenu}
                      onRequestRename={() => handleStartRename(item.linkId, item.name)}
                      onCopy={() => handleCopyExercise(item.linkId)}
                      onRequestDelete={() => handleRequestDelete(item.linkId)}
                      showDeleteConfirm={confirmDeleteExerciseId === item.linkId}
                      onConfirmDelete={() => handleConfirmDelete(item.linkId)}
                      onCancelDelete={handleCancelDelete}
                      isRenaming={renameModeExerciseId === item.linkId}
                      renameValue={renameValue}
                      renameSaving={renameSavingId === item.linkId}
                      onRenameValueChange={setRenameValue}
                      onRenameSave={() => handleRenameSave(item.linkId)}
                      onRenameCancel={handleCancelRename}
                      isMoving={moveModeExerciseId === item.linkId}
                      moveTargetId={selectedMoveWorkoutId}
                      onMoveTargetChange={setSelectedMoveWorkoutId}
                      onMoveStart={() => handleStartMove(item.linkId)}
                      onMoveConfirm={handleMoveConfirm}
                      onMoveCancel={handleCancelMove}
                    />
                  ))}
                </SortableContext>
              </DndContext>

              {isAddingExercise ? (
                <form className="exercise-add" onSubmit={handleCreateExercise}>
                  <input
                    type="text"
                    value={newExerciseName}
                    onChange={(event) => setNewExerciseName(event.target.value)}
                    placeholder="Ny övning"
                    maxLength={60}
                    autoFocus
                  />
                  <div className="exercise-add__actions">
                    <button type="submit" className="exercise-add__primary" disabled={isSavingExercise}>
                      {isSavingExercise ? 'Sparar...' : 'Spara'}
                    </button>
                    <button type="button" className="exercise-add__secondary" onClick={handleCancelExerciseForm} disabled={isSavingExercise}>
                      Avbryt
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  className="exercise-row exercise-row--add"
                  onClick={handleShowExerciseForm}
                  disabled={!user || isReorderingExercises || isReordering}
                  aria-label="Lägg till ny övning"
                >
                  <span aria-hidden="true">+</span>
                </button>
              )}

              {isReorderingExercises && (
                <p className="pass-menu__message">Sparar ordning...</p>
              )}

              {exercisesError && (
                <p className="pass-menu__message pass-menu__message--error">{exercisesError}</p>
              )}
            </div>
          )}
        </section>
      )}

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

function SortableWorkoutTile({ workout, formatWorkoutDate, onSelect, isSelected }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: workout._id })

  const { titleFontSize, titleLetterSpacing } = useMemo(() => {
    const charCount = Array.from(workout.name ?? '').length

    if (charCount === 0) {
      return { titleFontSize: '1.55rem', titleLetterSpacing: '0.02em' }
    }

    let fontSize = '1.55rem'
    if (charCount >= 18) {
      fontSize = '1.05rem'
    } else if (charCount >= 14) {
      fontSize = '1.15rem'
    } else if (charCount >= 10) {
      fontSize = '1.25rem'
    } else if (charCount >= 7) {
      fontSize = '1.3rem'
    } else if (charCount >= 6) {
      fontSize = '1.4rem'
    } else if (charCount >= 5) {
      fontSize = '1.5rem'
    }

    let letterSpacing = '0.02em'
    if (charCount >= 12) {
      letterSpacing = '0.01em'
    } else if (charCount >= 6) {
      letterSpacing = '0.015em'
    }

    return { titleFontSize: fontSize, titleLetterSpacing: letterSpacing }
  }, [workout.name])

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    '--pass-title-size': titleFontSize,
    '--pass-title-spacing': titleLetterSpacing
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`pass-tile pass-tile--saved ${isSelected ? 'pass-tile--selected' : ''} ${isDragging ? 'pass-tile--dragging' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(workout._id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect?.(workout._id)
        }
      }}
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
        onClick={(event) => event.stopPropagation()}
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

function SortableExerciseRow({
  item,
  workouts,
  currentWorkoutId,
  isMenuOpen,
  onToggleMenu,
  onCloseMenu,
  onRequestRename,
  onCopy,
  onRequestDelete,
  showDeleteConfirm,
  onConfirmDelete,
  onCancelDelete,
  isRenaming,
  renameValue,
  renameSaving,
  onRenameValueChange,
  onRenameSave,
  onRenameCancel,
  isMoving,
  moveTargetId,
  onMoveTargetChange,
  onMoveStart,
  onMoveConfirm,
  onMoveCancel
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item.linkId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition
  }

  return (
    <ExerciseRow
      item={item}
      workouts={workouts}
      currentWorkoutId={currentWorkoutId}
      isMenuOpen={isMenuOpen}
      onToggleMenu={onToggleMenu}
      onCloseMenu={onCloseMenu}
      onRequestRename={onRequestRename}
      onCopy={onCopy}
      onRequestDelete={onRequestDelete}
      showDeleteConfirm={showDeleteConfirm}
      onConfirmDelete={onConfirmDelete}
      onCancelDelete={onCancelDelete}
      isRenaming={isRenaming}
      renameValue={renameValue}
      renameSaving={renameSaving}
      onRenameValueChange={onRenameValueChange}
      onRenameSave={onRenameSave}
      onRenameCancel={onRenameCancel}
      isMoving={isMoving}
      moveTargetId={moveTargetId}
      onMoveTargetChange={onMoveTargetChange}
      onMoveStart={onMoveStart}
      onMoveConfirm={onMoveConfirm}
      onMoveCancel={onMoveCancel}
      style={style}
      isDragging={isDragging}
      attributes={attributes}
      listeners={listeners}
      setNodeRef={setNodeRef}
    />
  )
}

function ExerciseRow({
  item,
  workouts,
  currentWorkoutId,
  isMenuOpen,
  onToggleMenu,
  onCloseMenu,
  onRequestRename,
  onCopy,
  onRequestDelete,
  showDeleteConfirm,
  onConfirmDelete,
  onCancelDelete,
  isRenaming,
  renameValue,
  renameSaving,
  onRenameValueChange,
  onRenameSave,
  onRenameCancel,
  isMoving,
  moveTargetId,
  onMoveTargetChange,
  onMoveStart,
  onMoveConfirm,
  onMoveCancel,
  style,
  isDragging,
  attributes,
  listeners,
  setNodeRef
}) {
  const menuButtonRef = useRef(null)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`exercise-row ${isDragging ? 'exercise-row--dragging' : ''} ${(isMenuOpen || showDeleteConfirm || isMoving) ? 'exercise-row--layer' : ''}`}
    >
      <button
        type="button"
        className="exercise-row__grip"
        aria-label="Dra för att sortera"
        {...attributes}
        {...listeners}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
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

      <div className="exercise-row__content">
        {isRenaming ? (
          <form
            className="exercise-rename"
            onSubmit={(event) => {
              event.preventDefault()
              onRenameSave?.()
            }}
          >
            <input
              type="text"
              value={renameValue}
              onChange={(event) => onRenameValueChange?.(event.target.value)}
              maxLength={60}
              autoFocus
              disabled={renameSaving}
            />
            <div className="exercise-rename__actions">
              <button type="submit" className="exercise-rename__primary" disabled={renameSaving}>{renameSaving ? 'Sparar...' : 'Spara'}</button>
              <button type="button" className="exercise-rename__secondary" onClick={onRenameCancel} disabled={renameSaving}>Avbryt</button>
            </div>
          </form>
        ) : (
          <div className="exercise-row__name">{item.name}</div>
        )}
      </div>

      <div className="exercise-row__actions">
        <button
          ref={menuButtonRef}
          type="button"
          className="exercise-row__menu-btn"
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          aria-label="Öppna meny för övningen"
          onClick={(event) => {
            event.stopPropagation()
            onToggleMenu?.()
          }}
        >
          <span aria-hidden="true">⋯</span>
        </button>

        <ExerciseMenu
          isOpen={isMenuOpen}
          onClose={onCloseMenu}
          onRename={onRequestRename}
          onCopy={onCopy}
          onMove={onMoveStart}
          onDelete={onRequestDelete}
          anchorRef={menuButtonRef}
        />

        {showDeleteConfirm && (
          <ConfirmDialog
            message="Är du säker?"
            onConfirm={onConfirmDelete}
            onCancel={onCancelDelete}
          />
        )}

        {isMoving && (
          <MoveDialog
            workouts={workouts}
            currentWorkoutId={currentWorkoutId}
            value={moveTargetId}
            onChange={onMoveTargetChange}
            onConfirm={onMoveConfirm}
            onCancel={onMoveCancel}
          />
        )}
      </div>
    </div>
  )
}

function ExerciseMenu({ isOpen, onClose, onRename, onCopy, onMove, onDelete, anchorRef }) {
  const menuRef = useRef(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointer = (event) => {
      if (menuRef.current?.contains(event.target)) {
        return
      }
      if (anchorRef?.current?.contains(event.target)) {
        return
      }
      onClose?.()
    }

    const handleKey = (event) => {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }

    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('touchstart', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('touchstart', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [anchorRef, isOpen, onClose])

  useEffect(() => {
    if (isOpen && menuRef.current) {
      const firstButton = menuRef.current.querySelector('button')
      firstButton?.focus()
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  return (
    <div className="exercise-menu" role="menu" ref={menuRef} tabIndex={-1}>
      <button type="button" className="exercise-menu__item" role="menuitem" onClick={() => { onRename?.(); onClose?.() }}>Byt namn</button>
      <button type="button" className="exercise-menu__item" role="menuitem" onClick={() => { onCopy?.(); onClose?.() }}>Kopiera</button>
      <button type="button" className="exercise-menu__item" role="menuitem" onClick={() => { onMove?.(); onClose?.() }}>Flytta till annat pass</button>
      <button type="button" className="exercise-menu__item exercise-menu__item--danger" role="menuitem" onClick={() => { onDelete?.(); onClose?.() }}>Ta bort</button>
    </div>
  )
}

function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="confirm-dialog" role="dialog" aria-modal="true">
      <p className="confirm-dialog__message">{message}</p>
      <div className="confirm-dialog__actions">
        <button type="button" className="confirm-dialog__secondary" onClick={onCancel}>Avbryt</button>
        <button type="button" className="confirm-dialog__primary" onClick={onConfirm}>Ta bort</button>
      </div>
    </div>
  )
}

function MoveDialog({ workouts, currentWorkoutId, value, onChange, onConfirm, onCancel }) {
  const options = workouts.filter((workout) => workout._id !== currentWorkoutId)
  const hasOptions = options.length > 0

  return (
    <div className="move-dialog" role="dialog" aria-modal="true">
      <label className="move-dialog__field">
        <span>Välj pass</span>
        <select value={value} onChange={(event) => onChange?.(event.target.value)} disabled={!hasOptions}>
          <option value="" disabled>Välj pass</option>
          {options.map((workout) => (
            <option key={workout._id} value={workout._id}>{workout.name}</option>
          ))}
        </select>
      </label>
      {!hasOptions && (
        <p className="move-dialog__hint">Skapa ett annat pass för att kunna flytta</p>
      )}
      <div className="move-dialog__actions">
        <button type="button" className="move-dialog__secondary" onClick={onCancel}>Avbryt</button>
        <button type="button" className="move-dialog__primary" onClick={onConfirm} disabled={!value || !hasOptions}>Flytta</button>
      </div>
    </div>
  )
}

export default StatsPage
