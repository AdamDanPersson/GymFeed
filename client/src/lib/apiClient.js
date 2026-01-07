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

export { getStoredUser, getStoredUserId }