const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'

async function request(path, options = {}) {
  const config = {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
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