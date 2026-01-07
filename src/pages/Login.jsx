import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loginUser } from '../lib/apiClient'
import './Login.css'

function LoginPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [feedback, setFeedback] = useState({ error: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFeedback({ error: '' })

    if (!form.email || !form.password) {
      setFeedback({ error: 'Fyll i både e-post och lösenord' })
      return
    }

    setIsSubmitting(true)
    try {
      const data = await loginUser(form)
      localStorage.setItem('user', JSON.stringify(data))
      navigate('/')
    } catch (error) {
      setFeedback({ error: error.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="auth-page auth-page--login">
      <div className="auth-card">
        <h1>Logga in</h1>
        <p className="auth-lede">
          Logga in och fortsätt följa din träning
        </p>

        <form className="auth-form" aria-label="Logga in" onSubmit={handleSubmit}>
          <label>
            <span>E-post</span>
            <input
              name="email"
              type="email"
              placeholder="namn@mail.se"
              value={form.email}
              onChange={handleChange}
              required
            />
          </label>
          <label>
            <span>Lösenord</span>
            <input
              name="password"
              type="password"
              placeholder="• • • • • • • •"
              value={form.password}
              onChange={handleChange}
              required
            />
          </label>
          <div className="auth-actions">
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Loggar in...' : 'Fortsätt'}
            </button>
          </div>
          {feedback.error && (
            <p className="auth-feedback auth-feedback--error" role="alert">
              {feedback.error}
            </p>
          )}
        </form>

        <p className="auth-meta">
          Behöver du ett konto? <Link to="/create-account">Skapa ett</Link>
        </p>
      </div>
    </section>
  )
}

export default LoginPage
