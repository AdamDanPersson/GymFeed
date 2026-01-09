import { useMemo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { WorkoutMenu, ConfirmDialog } from './WorkoutDialogs'

export function SortableWorkoutTile({ workout, formatWorkoutDate, onSelect, isSelected, isMenuOpen, onToggleMenu, onCloseMenu, onRequestRename, onCopy, onRequestDelete, showDeleteConfirm, onConfirmDelete, onCancelDelete, isRenaming, renameValue, onRenameValueChange, onRenameSave, onRenameCancel, renameSaving }) {
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
        {isRenaming ? (
          <form
            className="workout-rename"
            onSubmit={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onRenameSave?.()
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <input
              type="text"
              value={renameValue}
              onChange={(event) => onRenameValueChange?.(event.target.value)}
              maxLength={60}
              autoFocus
              disabled={renameSaving}
            />
            <div className="workout-rename__actions">
              <button type="submit" className="workout-rename__primary" disabled={renameSaving}>{renameSaving ? 'Sparar...' : 'Spara'}</button>
              <button type="button" className="workout-rename__secondary" onClick={onRenameCancel} disabled={renameSaving}>Avbryt</button>
            </div>
          </form>
        ) : (
          <>
            <h3>{workout.name}</h3>
            <time dateTime={workout.createdAt}>
              {formatWorkoutDate(workout.createdAt)}
            </time>
          </>
        )}
      </div>
      <div className="pass-tile__actions">
        <button
          type="button"
          className="pass-tile__menu-btn"
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          aria-label="Öppna meny för passet"
          onClick={(event) => {
            event.stopPropagation()
            onToggleMenu?.()
          }}
        >
          <span aria-hidden="true">⋯</span>
        </button>
        {isMenuOpen && (
          <WorkoutMenu
            isOpen={isMenuOpen}
            onClose={onCloseMenu}
            onRename={onRequestRename}
            onCopy={onCopy}
            onDelete={onRequestDelete}
          />
        )}
        {showDeleteConfirm && (
          <ConfirmDialog
            message="Är du säker?"
            onConfirm={onConfirmDelete}
            onCancel={onCancelDelete}
          />
        )}
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
