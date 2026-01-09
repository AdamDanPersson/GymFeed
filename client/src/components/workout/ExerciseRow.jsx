import { useMemo, useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { ExerciseMenu, ConfirmDialog, MoveDialog } from './WorkoutDialogs'

export function SortableExerciseRow(props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: props.item.linkId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition
  }

  return (
    <ExerciseRow
      {...props}
      style={style}
      isDragging={isDragging}
      attributes={attributes}
      listeners={listeners}
      setNodeRef={setNodeRef}
    />
  )
}

export function ExerciseRow({
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
  isExpanded,
  onToggleExpand,
  sets,
  exerciseHistory,
  loadingHistory,
  setWeight,
  setReps,
  isDropset,
  onSetWeightChange,
  onSetRepsChange,
  onDropsetChange,
  onAddSet,
  editingSetId,
  editWeight,
  editReps,
  editIsDropset,
  onStartEditSet,
  onSaveEditSet,
  onCancelEditSet,
  onDeleteSet,
  onEditWeightChange,
  onEditRepsChange,
  onEditDropsetChange,
  onSaveSets,
  isSavingSets,
  saveSuccess,
  saveError,
  chartType,
  onChartTypeChange,
  chartMetric,
  onChartMetricChange,
  style,
  isDragging,
  attributes,
  listeners,
  setNodeRef
}) {
  const menuButtonRef = useRef(null)

  // Process history data for chart - supports multiple metrics
  const chartData = useMemo(() => {
    if (!exerciseHistory || !exerciseHistory.groups || exerciseHistory.groups.length === 0) {
      return []
    }

    // Sort groups chronologically (oldest first)
    const sortedGroups = [...exerciseHistory.groups].sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    )

    // Helper function to create unique date labels when multiple sessions exist on same day
    const createDateLabels = (groups) => {
      const dateCounts = {}
      const dateIndices = {}
      
      // First pass: count occurrences of each date
      groups.forEach(group => {
        const dateKey = new Date(group.date).toLocaleDateString('sv-SE', { 
          month: 'short', 
          day: 'numeric' 
        })
        dateCounts[dateKey] = (dateCounts[dateKey] || 0) + 1
      })
      
      // Second pass: assign labels with session numbers if duplicates exist
      return groups.map(group => {
        const dateKey = new Date(group.date).toLocaleDateString('sv-SE', { 
          month: 'short', 
          day: 'numeric' 
        })
        
        if (dateCounts[dateKey] > 1) {
          dateIndices[dateKey] = (dateIndices[dateKey] || 0) + 1
          return `${dateKey} #${dateIndices[dateKey]}`
        }
        return dateKey
      })
    }
    
    const dateLabels = createDateLabels(sortedGroups)

    // "allSets" - Show every individual set grouped by date, with dropsets in red
    if (chartMetric === 'allSets') {
      // Find max number of sets in any group
      const maxSets = Math.max(...sortedGroups.map(g => g.sets.length))
      
      // Create grouped data: each date has set1, set2, set3, etc.
      const groupedData = sortedGroups.map((group, groupIndex) => {
        const date = dateLabels[groupIndex]
        
        // Sort sets within group by createdAt (oldest first)
        const sortedSets = [...group.sets].sort((a, b) => 
          new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
        )
        
        // Create object with date and set1, set2, etc.
        const row = { date, _maxSets: maxSets }
        sortedSets.forEach((set, index) => {
          const setNum = index + 1
          row[`set${setNum}`] = parseFloat(set.weight) || 0
          row[`set${setNum}_reps`] = parseInt(set.reps) || 0
          row[`set${setNum}_isDropSet`] = set.isDropSet || false
        })
        return row
      })
      
      // Attach maxSets to the array for rendering
      groupedData._maxSets = maxSets
      return groupedData
    }

    // "totalVolume" - Sum of (weight × reps) per session
    if (chartMetric === 'totalVolume') {
      return sortedGroups.map((group, groupIndex) => {
        const volume = group.sets.reduce((sum, set) => {
          const w = parseFloat(set.weight) || 0
          const r = parseInt(set.reps) || 0
          return sum + (w * r)
        }, 0)
        const date = dateLabels[groupIndex]
        return { date, value: Math.round(volume), label: 'Total volym (kg)' }
      })
    }

    // "e1rm" - Estimated 1 Rep Max using Epley formula: weight × (1 + reps/30)
    if (chartMetric === 'e1rm') {
      return sortedGroups.map((group, groupIndex) => {
        const maxE1rm = Math.max(...group.sets.map(set => {
          const w = parseFloat(set.weight) || 0
          const r = parseInt(set.reps) || 0
          if (r === 0) return 0
          return w * (1 + r / 30)
        }))
        const date = dateLabels[groupIndex]
        return { date, value: Math.round(maxE1rm * 10) / 10, label: 'E1RM (kg)' }
      })
    }

    // "setCount" - Number of sets per session
    if (chartMetric === 'setCount') {
      return sortedGroups.map((group, groupIndex) => {
        const date = dateLabels[groupIndex]
        return { date, value: group.sets.length, label: 'Antal set' }
      })
    }

    // Default: "maxWeight" - Top set (highest weight) per session
    return sortedGroups.map((group, groupIndex) => {
      const maxWeight = Math.max(...group.sets.map(s => parseFloat(s.weight) || 0))
      const date = dateLabels[groupIndex]
      return { date, value: maxWeight, label: 'Max vikt (kg)' }
    })
  }, [exerciseHistory, chartMetric])

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`exercise-row ${isDragging ? 'exercise-row--dragging' : ''} ${(isMenuOpen || showDeleteConfirm || isMoving) ? 'exercise-row--layer' : ''}`}
        onClick={onToggleExpand}
      >
      <button
        type="button"
        className="exercise-row__grip"
        aria-label="Dra för att sortera"
        onClick={(event) => event.stopPropagation()}
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
            onClick={(event) => event.stopPropagation()}
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
          <div className="exercise-row__name">
            {item.name}
          </div>
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

      {isExpanded && (
        <>
          <div className="exercise-history">
            <div className="exercise-history__sidebar">
              {loadingHistory ? (
                <p className="exercise-history__loading">Laddar...</p>
              ) : exerciseHistory && exerciseHistory.groups && exerciseHistory.groups.length > 0 ? (
                <>
                  <h4 className="exercise-history__title">
                    Senaste setten
                    <span style={{ fontWeight: 'normal', fontSize: '12px', marginLeft: '6px', color: '#666' }}>
                      ({new Date(exerciseHistory.groups[0].date).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })})
                    </span>
                  </h4>
                  <div className="exercise-history__sets">
                    {exerciseHistory.groups[0].sets.map((set) => (
                      <div key={set._id} className="exercise-history__set">
                        <span className="exercise-history__set-info">
                          {set.weight} kg x {set.reps}
                        </span>
                        {set.isDropSet && (
                          <span className="exercise-history__set-drop">DROP</span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="exercise-history__empty">Inga tidigare sets</p>
              )}
            </div>
            <div className="exercise-history__content">
              <div className="exercise-history__chart-controls">
                <div className="exercise-history__chart-type-toggle">
                  <button
                    type="button"
                    className={`exercise-history__chart-btn ${chartType === 'bar' ? 'exercise-history__chart-btn--active' : ''}`}
                    onClick={() => onChartTypeChange('bar')}
                  >
                    Staplar
                  </button>
                  <button
                    type="button"
                    className={`exercise-history__chart-btn ${chartType === 'line' ? 'exercise-history__chart-btn--active' : ''}`}
                    onClick={() => onChartTypeChange('line')}
                  >
                    Linje
                  </button>
                </div>
                <div className="exercise-history__chart-metric">
                  <select
                    value={chartMetric}
                    onChange={(e) => onChartMetricChange(e.target.value)}
                    className="exercise-history__chart-select"
                  >
                    <option value="maxWeight">Max vikt (top set)</option>
                    <option value="totalVolume">Total volym</option>
                    <option value="e1rm">Estimerat 1RM</option>
                    <option value="setCount">Antal set</option>
                    {chartType === 'bar' && <option value="allSets">Alla set (detaljvy)</option>}
                  </select>
                </div>
              </div>

              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  {chartType === 'bar' ? (
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis />
                      <Tooltip 
                        cursor={{ fill: 'rgba(0,0,0,0.1)' }}
                        content={({ active, payload, label }) => {
                          if (!active || !payload || payload.length === 0) return null
                          
                          if (chartMetric === 'allSets') {
                            const validPayloads = payload.filter(p => p.value !== undefined && p.value !== null)
                            if (validPayloads.length === 0) return null
                            
                            const data = validPayloads[0]?.payload
                            
                            return (
                              <div style={{ background: 'white', padding: '8px 12px', border: '1px solid #ccc', borderRadius: '4px', minWidth: '120px' }}>
                                <p style={{ margin: 0, fontWeight: 'bold', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>{label || data?.date || ''}</p>
                                {validPayloads.map((entry, idx) => {
                                  const setKey = entry.dataKey
                                  const setNum = setKey?.replace('set', '') || ''
                                  const weight = entry.value || 0
                                  const reps = entry.payload?.[`${setKey}_reps`] || 0
                                  const isDropSet = entry.payload?.[`${setKey}_isDropSet`] || false
                                  
                                  return (
                                    <div key={idx} style={{ marginTop: '4px', padding: '2px 0', borderBottom: idx < validPayloads.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                                      <p style={{ margin: 0, color: isDropSet ? '#e53935' : '#333' }}>
                                        {`Set ${setNum}: ${weight} kg × ${reps}`}
                                        {isDropSet && <span style={{ marginLeft: '6px', fontWeight: 'bold' }}>DROP</span>}
                                      </p>
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          }
                          
                          const data = payload[0]?.payload
                          if (!data) return null
                          
                          return (
                            <div style={{ background: 'white', padding: '8px 12px', border: '1px solid #ccc', borderRadius: '4px' }}>
                              <p style={{ margin: 0, fontWeight: 'bold' }}>{data.date || ''}</p>
                              <p style={{ margin: '4px 0 0 0' }}>{`${data.label || 'Värde'}: ${data.value ?? 0}`}</p>
                            </div>
                          )
                        }}
                      />
                      {chartMetric === 'allSets' ? (
                        Array.from({ length: chartData._maxSets || 0 }, (_, i) => {
                          const setNum = i + 1
                          const dataKey = `set${setNum}`
                          return (
                            <Bar key={dataKey} dataKey={dataKey} name={`Set ${setNum}`}>
                              {chartData.map((entry, index) => {
                                const isDropSet = entry[`${dataKey}_isDropSet`] || false
                                return (
                                  <Cell 
                                    key={`cell-${index}`} 
                                    fill={isDropSet ? '#e53935' : '#8884d8'} 
                                  />
                                )
                              })}
                            </Bar>
                          )
                        })
                      ) : (
                        <Bar dataKey="value" fill="#8884d8" />
                      )}
                    </BarChart>
                  ) : (
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (!active || !payload || payload.length === 0) return null
                          const data = payload[0]?.payload
                          if (!data) return null
                          
                          return (
                            <div style={{ background: 'white', padding: '8px 12px', border: '1px solid #ccc', borderRadius: '4px' }}>
                              <p style={{ margin: 0, fontWeight: 'bold' }}>{data.date || ''}</p>
                              <p style={{ margin: '4px 0 0 0' }}>{`${data.label || 'Värde'}: ${data.value ?? 0}`}</p>
                            </div>
                          )
                        }}
                      />
                      <Line type="monotone" dataKey="value" stroke="#8884d8" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              ) : (
                <p className="exercise-history__empty">Ingen data att visa</p>
              )}
            </div>
          </div>
          
          <div className="exercise-details">
            <div className="exercise-details__form">
            <input
              type="number"
              placeholder="Vikt (kg)"
              className="exercise-details__input"
              value={setWeight}
              onChange={(e) => onSetWeightChange(e.target.value)}
            />
            <input
              type="number"
              placeholder="Repetitioner"
              className="exercise-details__input"
              value={setReps}
              onChange={(e) => onSetRepsChange(e.target.value)}
            />
            <label className="exercise-details__toggle">
              <input
                type="checkbox"
                checked={isDropset}
                onChange={(e) => onDropsetChange(e.target.checked)}
              />
              <span className="exercise-details__toggle-slider"></span>
              <span className="exercise-details__toggle-label">Dropset</span>
            </label>
            <button
              type="button"
              className="exercise-details__add-btn"
              onClick={onAddSet}
            >
              Lägg till
            </button>
          </div>

          {sets.length > 0 && (
            <div className="exercise-details__list">
              {sets.map((set) => (
                <div key={set.id} className="exercise-details__set">
                  {editingSetId === set.id ? (
                    <>
                      <input
                        type="number"
                        value={editWeight}
                        onChange={(e) => onEditWeightChange(e.target.value)}
                        className="exercise-details__edit-input"
                        placeholder="Vikt"
                      />
                      <input
                        type="number"
                        value={editReps}
                        onChange={(e) => onEditRepsChange(e.target.value)}
                        className="exercise-details__edit-input"
                        placeholder="Reps"
                      />
                      <label className="exercise-details__edit-toggle">
                        <input
                          type="checkbox"
                          checked={editIsDropset}
                          onChange={(e) => onEditDropsetChange(e.target.checked)}
                        />
                        <span className="exercise-details__toggle-slider"></span>
                      </label>
                      <div className="exercise-details__set-actions">
                        <button
                          type="button"
                          className="exercise-details__set-save"
                          onClick={onSaveEditSet}
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          className="exercise-details__set-cancel"
                          onClick={onCancelEditSet}
                        >
                          ✕
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="exercise-details__set-info">
                        {set.weight} kg x {set.reps} reps
                      </span>
                      {set.isDropset && (
                        <span className="exercise-details__set-drop">DROP</span>
                      )}
                      <div className="exercise-details__set-actions">
                        <button
                          type="button"
                          className="exercise-details__set-edit"
                          onClick={() => onStartEditSet(set)}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          className="exercise-details__set-delete"
                          onClick={() => onDeleteSet(set.id)}
                        >
                          🗑
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="exercise-details__save-btn"
                onClick={onSaveSets}
                disabled={isSavingSets}
              >
                {isSavingSets ? 'Sparar...' : 'Spara'}
              </button>
              {saveSuccess && (
                <p className="exercise-details__save-success">✓ Sets sparade!</p>
              )}
              {saveError && (
                <p className="exercise-details__save-error">Kunde inte spara sets. Försök igen.</p>
              )}
            </div>
          )}
        </div>
        </>
      )}
    </>
  )
}
