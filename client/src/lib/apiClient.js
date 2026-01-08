const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'

function getStoredUser() {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem('user')
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw)
  } catch (error) {
    console.warn('Could not parse stored user', error)
    return null
  }
}

function getStoredUserId() {
  const user = getStoredUser()
  if (!user) {
    return null
  }

  const candidates = [user.userId, user.userId?.$oid, user._id, user._id?.$oid]
  const match = candidates.find((value) => typeof value === 'string' && value.trim())
  return match || null
}

async function request(path, options = {}) {
  const { requireUser = false, ...rest } = options
  const headers = { 'Content-Type': 'application/json', ...(rest.headers || {}) }

  if (requireUser) {
    const userId = getStoredUserId()
    if (!userId) {
      throw new Error('Du måste logga in')
    }
    headers['x-user-id'] = userId
  }

  const config = {
    ...rest,
    headers
  }

  const response = await fetch(`${API_BASE_URL}${path}`, config)
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message = data?.message || 'Något gick fel'
    throw new Error(message)
  }

  return data
}

export function registerUser(payload) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function loginUser(payload) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function fetchWorkouts() {
  return request('/workouts', { requireUser: true })
}

export function createWorkout(payload) {
  return request('/workouts', {
    method: 'POST',
    body: JSON.stringify(payload),
    requireUser: true
  })
}

export function deleteWorkout(workoutId) {
  return request(`/workouts/${workoutId}`, {
    method: 'DELETE',
    requireUser: true
  })
}

export function reorderWorkouts(workoutIds) {
  return request('/workouts/reorder', {
    method: 'PUT',
    body: JSON.stringify({ workoutIds }),
    requireUser: true
  })
}

export function renameWorkout(workoutId, payload) {
  return request(`/workouts/${workoutId}/rename`, {
    method: 'PUT',
    body: JSON.stringify(payload),
    requireUser: true
  })
}

export function copyWorkout(workoutId) {
  return request(`/workouts/${workoutId}/copy`, {
    method: 'POST',
    requireUser: true
  })
}

export function fetchWorkoutExercises(workoutId) {
  return request(`/workouts/${workoutId}/exercises`, { requireUser: true })
}

export function addWorkoutExercise(workoutId, payload) {
  return request(`/workouts/${workoutId}/exercises`, {
    method: 'POST',
    body: JSON.stringify(payload),
    requireUser: true
  })
}

export function reorderWorkoutExercises(workoutId, items) {
  return request(`/workouts/${workoutId}/exercises/reorder`, {
    method: 'PUT',
    body: JSON.stringify(items),
    requireUser: true
  })
}

export function deleteWorkoutExercise(workoutId, linkId) {
  return request(`/workouts/${workoutId}/exercises/${linkId}`, {
    method: 'DELETE',
    requireUser: true
  })
}

export function renameWorkoutExercise(workoutId, linkId, payload) {
  return request(`/workouts/${workoutId}/exercises/${linkId}/rename`, {
    method: 'PUT',
    body: JSON.stringify(payload),
    requireUser: true
  })
}

export function copyWorkoutExercise(workoutId, linkId) {
  return request(`/workouts/${workoutId}/exercises/${linkId}/copy`, {
    method: 'POST',
    requireUser: true
  })
}

export function moveWorkoutExercise(workoutId, linkId, payload) {
  return request(`/workouts/${workoutId}/exercises/${linkId}/move`, {
    method: 'PUT',
    body: JSON.stringify(payload),
    requireUser: true
  })
}

export function saveSetsBulk(exerciseId, sets) {
  return request(`/exercises/${exerciseId}/sets/bulk`, {
    method: 'POST',
    body: JSON.stringify({ sets }),
    requireUser: true
  })
}

export function getExerciseSets(exerciseId) {
  return request(`/exercises/${exerciseId}/sets`, {
    requireUser: true
  })
}

export function updateSet(setId, payload) {
  return request(`/sets/${setId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
    requireUser: true
  })
}

export function deleteSet(setId) {
  return request(`/sets/${setId}`, {
    method: 'DELETE',
    requireUser: true
  })
}

export function getMonthlyVisits() {
  return request('/stats/monthly-visits', {
    requireUser: true
  })
}

// ==================== EXERCISES ====================

export function fetchExercises() {
  return request('/exercises', {
    requireUser: true
  })
}

// ==================== POSTS ====================

export function createPost(payload) {
  return request('/posts', {
    method: 'POST',
    body: JSON.stringify(payload),
    requireUser: true
  })
}

export function fetchPosts({ limit = 5, cursor = null } = {}) {
  const params = new URLSearchParams({ limit: String(limit) })
  if (cursor) {
    params.set('cursor', cursor)
  }
  return request(`/posts?${params.toString()}`)
}

export function fetchPost(postId) {
  return request(`/posts/${postId}`)
}

export function deletePost(postId) {
  return request(`/posts/${postId}`, {
    method: 'DELETE',
    requireUser: true
  })
}

export { getStoredUser, getStoredUserId }