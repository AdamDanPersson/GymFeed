import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import {
  addWorkoutExercise,
  copyWorkout,
  copyWorkoutExercise,
  createWorkout,
  deleteWorkout,
  deleteWorkoutExercise,
  fetchWorkoutExercises,
  fetchWorkouts,
  moveWorkoutExercise,
  renameWorkout,
  reorderWorkoutExercises,
  reorderWorkouts,
  renameWorkoutExercise,
  saveSetsBulk,
  getExerciseSets,
  deleteSet
} from '../../lib/apiClient'
import { SortableWorkoutTile } from '../workout/WorkoutTile'
import { SortableExerciseRow } from '../workout/ExerciseRow'

export default function WorkoutBoard({ user }) {
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

  const [openMenuWorkoutId, setOpenMenuWorkoutId] = useState(null)
  const [confirmDeleteWorkoutId, setConfirmDeleteWorkoutId] = useState(null)
  const [renameModeWorkoutId, setRenameModeWorkoutId] = useState(null)
  const [renameWorkoutValue, setRenameWorkoutValue] = useState('')
  const [renameWorkoutSavingId, setRenameWorkoutSavingId] = useState(null)

  const [expandedExerciseId, setExpandedExerciseId] = useState(null)
  const [exerciseSets, setExerciseSets] = useState({})
  const [setWeight, setSetWeight] = useState('')
  const [setReps, setSetReps] = useState('')
  const [isDropset, setIsDropset] = useState(false)
  const [editingSetId, setEditingSetId] = useState(null)
  const [editWeight, setEditWeight] = useState('')
  const [editReps, setEditReps] = useState('')
  const [editIsDropset, setEditIsDropset] = useState(false)
  const [savingSetsFor, setSavingSetsFor] = useState(null)
  const [saveSuccessFor, setSaveSuccessFor] = useState(null)
  const [saveErrorFor, setSaveErrorFor] = useState(null)
  const [exerciseHistory, setExerciseHistory] = useState({})
  const [loadingHistoryFor, setLoadingHistoryFor] = useState(null)
  const [chartType, setChartType] = useState('bar')
  const [chartMetric, setChartMetric] = useState('maxWeight')
  const exercisesPanelRef = useRef(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5
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
        setOpenMenuWorkoutId(null)
        setConfirmDeleteWorkoutId(null)
        setRenameModeWorkoutId(null)
        setRenameWorkoutValue('')
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
      setOpenMenuWorkoutId(null)
      setConfirmDeleteWorkoutId(null)
      setRenameModeWorkoutId(null)
      setRenameWorkoutValue('')
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
      setOpenMenuWorkoutId(null)
      setConfirmDeleteWorkoutId(null)
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

  useEffect(() => {
    if (!selectedWorkoutId) return
    // Scroll to exercises panel when a workout is opened
    const el = exercisesPanelRef.current
    if (!el) return
    window.requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
    })
  }, [selectedWorkoutId])

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

  const handleCopyExercise = useCallback(async (exerciseId) => {
    if (!selectedWorkoutId) {
      return
    }

    setOpenMenuExerciseId(null)
    setExercisesError('')

    try {
      const copied = await copyWorkoutExercise(selectedWorkoutId, exerciseId)
      setExerciseLinks((prev) => {
        const index = prev.findIndex((item) => item.linkId === exerciseId)
        if (index === -1) {
          return [...prev, copied]
        }
        const next = [...prev]
        next.splice(index + 1, 0, copied)
        return next
      })
    } catch (error) {
      setExercisesError(error.message)
    }
  }, [selectedWorkoutId])

  const handleStartMove = useCallback((exerciseId) => {
    const fallbackWorkout = workouts.find((w) => w._id !== selectedWorkoutId)

    setMoveModeExerciseId(exerciseId)
    setSelectedMoveWorkoutId(fallbackWorkout?._id || '')
    setOpenMenuExerciseId(null)
    setConfirmDeleteExerciseId(null)
    setRenameModeExerciseId(null)
    setRenameValue('')
  }, [selectedWorkoutId, workouts])

  const handleMoveConfirm = useCallback(async () => {
    if (!moveModeExerciseId || !selectedMoveWorkoutId || !selectedWorkoutId) {
      return
    }

    setExercisesError('')

    try {
      await moveWorkoutExercise(selectedWorkoutId, moveModeExerciseId, {
        targetWorkoutId: selectedMoveWorkoutId
      })

      setExerciseLinks((prev) => prev.filter((item) => item.linkId !== moveModeExerciseId))
      setMoveModeExerciseId(null)
      setSelectedMoveWorkoutId('')
    } catch (error) {
      setExercisesError(error.message)
    }
  }, [moveModeExerciseId, selectedMoveWorkoutId, selectedWorkoutId])

  const handleCancelMove = useCallback(() => {
    setMoveModeExerciseId(null)
    setSelectedMoveWorkoutId('')
  }, [])

  const handleToggleWorkoutMenu = useCallback((workoutId) => {
    setOpenMenuWorkoutId((prev) => (prev === workoutId ? null : workoutId))
  }, [])

  const handleCloseWorkoutMenu = useCallback(() => {
    setOpenMenuWorkoutId(null)
  }, [])

  const handleWorkoutRename = useCallback((workoutId, currentName) => {
    setRenameModeWorkoutId(workoutId)
    setRenameWorkoutValue(currentName || '')
    setOpenMenuWorkoutId(null)
    setConfirmDeleteWorkoutId(null)
  }, [])

  const handleWorkoutRenameSave = useCallback(async (workoutId) => {
    if (renameModeWorkoutId !== workoutId) {
      return
    }

    const trimmed = renameWorkoutValue.trim()
    if (!trimmed) {
      setWorkoutsError('Ange ett namn för att spara')
      return
    }

    setWorkoutsError('')
    setRenameWorkoutSavingId(workoutId)
    try {
      const updated = await renameWorkout(workoutId, { name: trimmed })
      setWorkouts((prev) => prev.map((w) => (
        w._id === workoutId ? { ...w, name: updated.name } : w
      )))
      setRenameModeWorkoutId(null)
      setRenameWorkoutValue('')
    } catch (error) {
      setWorkoutsError(error.message)
    } finally {
      setRenameWorkoutSavingId(null)
    }
  }, [renameModeWorkoutId, renameWorkoutValue])

  const handleWorkoutRenameCancel = useCallback(() => {
    setRenameModeWorkoutId(null)
    setRenameWorkoutValue('')
  }, [])

  const handleWorkoutCopy = useCallback(async (workoutId) => {
    setOpenMenuWorkoutId(null)
    setWorkoutsError('')

    try {
      const copied = await copyWorkout(workoutId)
      setWorkouts((prev) => {
        const index = prev.findIndex((w) => w._id === workoutId)
        if (index === -1) {
          return [...prev, copied]
        }
        const next = [...prev]
        next.splice(index + 1, 0, copied)
        return next
      })
    } catch (error) {
      setWorkoutsError(error.message)
    }
  }, [])

  const handleWorkoutDelete = useCallback((workoutId) => {
    setConfirmDeleteWorkoutId(workoutId)
    setOpenMenuWorkoutId(null)
  }, [])

  const handleConfirmDeleteWorkout = useCallback(async (workoutId) => {
    setWorkoutsError('')
    try {
      await deleteWorkout(workoutId)
      setWorkouts((prev) => prev.filter((w) => w._id !== workoutId))
    } catch (error) {
      setWorkoutsError(error.message)
    } finally {
      setConfirmDeleteWorkoutId(null)
      setOpenMenuWorkoutId(null)
    }
  }, [])

  const handleCancelDeleteWorkout = useCallback(() => {
    setConfirmDeleteWorkoutId(null)
  }, [])

  const handleToggleExerciseExpand = useCallback(async (linkId, exerciseId) => {
    const isExpanding = expandedExerciseId !== linkId
    setExpandedExerciseId((prev) => (prev === linkId ? null : linkId))
    
    if (isExpanding) {
      window.requestAnimationFrame(() => {
        const el = document.querySelector(`[data-exercise-row="${linkId}"]`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' })
          // Offset a bit from the very top to show full content comfortably
          window.setTimeout(() => {
            window.scrollBy({ top: -40, left: 0, behavior: 'smooth' })
          }, 160)
        }
      })
    }

    if (isExpanding && exerciseId && !exerciseHistory[exerciseId]) {
      setLoadingHistoryFor(exerciseId)
      try {
        const data = await getExerciseSets(exerciseId)
        setExerciseHistory((prev) => ({
          ...prev,
          [exerciseId]: data
        }))
      } catch (error) {
        console.error('Failed to fetch exercise history', error)
      } finally {
        setLoadingHistoryFor(null)
      }
    }
  }, [expandedExerciseId, exerciseHistory])

  const handleAddSet = useCallback((linkId) => {
    if (!setWeight || !setReps) return

    const newSet = {
      id: Date.now(),
      weight: parseFloat(setWeight),
      reps: parseInt(setReps, 10),
      isDropset: isDropset
    }

    setExerciseSets((prev) => ({
      ...prev,
      [linkId]: [...(prev[linkId] || []), newSet]
    }))
  }, [setWeight, setReps, isDropset])

  const handleStartEditSet = useCallback((set) => {
    setEditingSetId(set.id)
    setEditWeight(set.weight.toString())
    setEditReps(set.reps.toString())
    setEditIsDropset(set.isDropset)
  }, [])

  const handleSaveEditSet = useCallback((linkId) => {
    if (!editWeight || !editReps) return

    setExerciseSets((prev) => ({
      ...prev,
      [linkId]: (prev[linkId] || []).map(set =>
        set.id === editingSetId
          ? { ...set, weight: parseFloat(editWeight), reps: parseInt(editReps, 10), isDropset: editIsDropset }
          : set
      )
    }))

    setEditingSetId(null)
    setEditWeight('')
    setEditReps('')
    setEditIsDropset(false)
  }, [editingSetId, editWeight, editReps, editIsDropset])

  const handleCancelEditSet = useCallback(() => {
    setEditingSetId(null)
    setEditWeight('')
    setEditReps('')
    setEditIsDropset(false)
  }, [])

  const handleDeleteSet = useCallback((linkId, setId) => {
    setExerciseSets((prev) => ({
      ...prev,
      [linkId]: (prev[linkId] || []).filter(set => set.id !== setId)
    }))
  }, [])

  const handleLoadLatestSets = useCallback(async (linkId, exerciseId) => {
    const history = exerciseHistory[exerciseId]
    if (!history || !history.groups || history.groups.length === 0) return

    const latestGroup = history.groups[0]
    if (!latestGroup.sets || latestGroup.sets.length === 0) return

    // Delete sets from database
    try {
      await Promise.all(latestGroup.sets.map(set => deleteSet(set._id)))
    } catch (error) {
      console.error('Failed to delete sets from database', error)
      return
    }

    // Load sets into editing list
    const loadedSets = latestGroup.sets.map((set, index) => ({
      id: Date.now() + index,
      weight: set.weight,
      reps: set.reps,
      isDropset: set.isDropSet || false
    }))

    setExerciseSets((prev) => ({
      ...prev,
      [linkId]: [...(prev[linkId] || []), ...loadedSets]
    }))

    // Update history to remove deleted sets
    setExerciseHistory((prev) => {
      const currentHistory = prev[exerciseId]
      if (!currentHistory || !currentHistory.groups) return prev

      const updatedGroups = currentHistory.groups.slice(1)
      return {
        ...prev,
        [exerciseId]: {
          ...currentHistory,
          groups: updatedGroups
        }
      }
    })
  }, [exerciseHistory])

  const handleSaveSets = useCallback(async (linkId, exerciseId) => {
    const sets = exerciseSets[linkId] || []
    if (sets.length === 0) {
      return
    }

    setSavingSetsFor(linkId)
    setSaveErrorFor(null)
    setSaveSuccessFor(null)

    try {
      const setsToSave = sets.map(set => ({
        weight: set.weight,
        reps: set.reps,
        isDropSet: set.isDropset
      }))

      await saveSetsBulk(exerciseId, setsToSave)

      setExerciseSets((prev) => ({
        ...prev,
        [linkId]: []
      }))

      setExerciseHistory((prev) => ({
        ...prev,
        [exerciseId]: null
      }))

      try {
        const data = await getExerciseSets(exerciseId)
        setExerciseHistory((prev) => ({
          ...prev,
          [exerciseId]: data
        }))
      } catch (error) {
        console.error('Failed to refetch history', error)
      }

      setSaveSuccessFor(linkId)
      setTimeout(() => {
        setSaveSuccessFor(null)
      }, 3000)
    } catch (error) {
      console.error('Failed to save sets', error)
      setSaveErrorFor(linkId)
    } finally {
      setSavingSetsFor(null)
    }
  }, [exerciseSets])

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
                isMenuOpen={openMenuWorkoutId === workout._id}
                onToggleMenu={() => handleToggleWorkoutMenu(workout._id)}
                onCloseMenu={handleCloseWorkoutMenu}
                onRequestRename={() => handleWorkoutRename(workout._id, workout.name)}
                onCopy={() => handleWorkoutCopy(workout._id)}
                onRequestDelete={() => handleWorkoutDelete(workout._id)}
                showDeleteConfirm={confirmDeleteWorkoutId === workout._id}
                onConfirmDelete={() => handleConfirmDeleteWorkout(workout._id)}
                onCancelDelete={handleCancelDeleteWorkout}
                isRenaming={renameModeWorkoutId === workout._id}
                renameValue={renameModeWorkoutId === workout._id ? renameWorkoutValue : ''}
                onRenameValueChange={setRenameWorkoutValue}
                onRenameSave={() => handleWorkoutRenameSave(workout._id)}
                onRenameCancel={handleWorkoutRenameCancel}
                renameSaving={renameWorkoutSavingId === workout._id}
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
        <section className="exercises-panel" aria-label="Övningar" ref={exercisesPanelRef}>
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
                      isExpanded={expandedExerciseId === item.linkId}
                      onToggleExpand={() => handleToggleExerciseExpand(item.linkId, item.exerciseId)}
                      sets={exerciseSets[item.linkId] || []}
                      exerciseHistory={exerciseHistory[item.exerciseId]}
                      loadingHistory={loadingHistoryFor === item.exerciseId}
                      setWeight={setWeight}
                      setReps={setReps}
                      isDropset={isDropset}
                      onSetWeightChange={setSetWeight}
                      onSetRepsChange={setSetReps}
                      onDropsetChange={setIsDropset}
                      onAddSet={() => handleAddSet(item.linkId)}
                      editingSetId={editingSetId}
                      editWeight={editWeight}
                      editReps={editReps}
                      editIsDropset={editIsDropset}
                      onStartEditSet={handleStartEditSet}
                      onSaveEditSet={() => handleSaveEditSet(item.linkId)}
                      onCancelEditSet={handleCancelEditSet}
                      onDeleteSet={(setId) => handleDeleteSet(item.linkId, setId)}
                      onEditWeightChange={setEditWeight}
                      onEditRepsChange={setEditReps}
                      onEditDropsetChange={setEditIsDropset}
                      onSaveSets={() => handleSaveSets(item.linkId, item.exerciseId)}
                      onLoadLatestSets={() => handleLoadLatestSets(item.linkId, item.exerciseId)}
                      isSavingSets={savingSetsFor === item.linkId}
                      saveSuccess={saveSuccessFor === item.linkId}
                      saveError={saveErrorFor === item.linkId}
                      chartType={chartType}
                      onChartTypeChange={setChartType}
                      chartMetric={chartMetric}
                      onChartMetricChange={setChartMetric}
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
