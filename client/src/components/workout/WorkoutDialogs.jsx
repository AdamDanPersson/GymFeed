import { useEffect, useRef } from 'react'

export function ExerciseMenu({ isOpen, onClose, onRename, onCopy, onMove, onDelete, anchorRef }) {
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

export function WorkoutMenu({ isOpen, onClose, onRename, onCopy, onDelete }) {
  const menuRef = useRef(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointer = (event) => {
      if (menuRef.current?.contains(event.target)) {
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
  }, [isOpen, onClose])

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
    <div className="workout-menu" role="menu" ref={menuRef} tabIndex={-1}>
      <button type="button" className="workout-menu__item" role="menuitem" onClick={() => { onRename?.(); onClose?.() }}>Byt namn</button>
      <button type="button" className="workout-menu__item" role="menuitem" onClick={() => { onCopy?.(); onClose?.() }}>Kopiera</button>
      <button type="button" className="workout-menu__item workout-menu__item--danger" role="menuitem" onClick={() => { onDelete?.(); onClose?.() }}>Ta bort</button>
    </div>
  )
}

export function ConfirmDialog({ message, onConfirm, onCancel }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const handlePointer = (event) => {
      if (dialogRef.current?.contains(event.target)) {
        return
      }
      onCancel?.()
    }

    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('touchstart', handlePointer)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('touchstart', handlePointer)
    }
  }, [onCancel])

  return (
    <div className="confirm-dialog" role="dialog" aria-modal="true" ref={dialogRef}>
      <p className="confirm-dialog__message">{message}</p>
      <div className="confirm-dialog__actions">
        <button type="button" className="confirm-dialog__secondary" onClick={onCancel}>Avbryt</button>
        <button type="button" className="confirm-dialog__primary" onClick={onConfirm}>Ta bort</button>
      </div>
    </div>
  )
}

export function MoveDialog({ workouts, currentWorkoutId, value, onChange, onConfirm, onCancel }) {
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
