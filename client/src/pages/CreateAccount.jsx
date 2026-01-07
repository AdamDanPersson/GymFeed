import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registerUser } from '../lib/apiClient'
import './CreateAccount.css'

function CreateAccountPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: ''
  })
  const [feedback, setFeedback] = useState({ error: '', success: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFeedback({ error: '', success: '' })

    const trimmedFirstName = form.firstName.trim()
    const trimmedLastName = form.lastName.trim()
    const trimmedEmail = form.email.trim()

    if (!trimmedFirstName || !trimmedLastName) {
      setFeedback({ error: 'Fyll i både för- och efternamn', success: '' })
      return
    }

    if (!trimmedEmail) {
      setFeedback({ error: 'Fyll i e-post', success: '' })
      return
    }

    if (!form.password || form.password.length < 8) {
      setFeedback({ error: 'Lösenordet måste vara minst 8 tecken', success: '' })
      return
    }

    const payload = {
      email: trimmedEmail,
      password: form.password,
      firstName: trimmedFirstName,
      lastName: trimmedLastName
    }

    setIsSubmitting(true)
    try {
      await registerUser(payload)
      setFeedback({ error: '', success: 'Konto skapat! Logga in för att fortsätta.' })
      navigate('/login')
    } catch (error) {
      setFeedback({ error: error.message, success: '' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="auth-page auth-page--create">
      <div className="auth-card">
        <h1>Skapa konto</h1>
        <p className="auth-lede">
          Registrera dig och få överblick över din träning
        </p>

        <form
          id="create-account-form"
          className="auth-form"
          aria-label="Skapa konto"
          onSubmit={handleSubmit}
        >
          <div className="auth-form__grid">
            <label>
              <span>Förnamn</span>
              <input
                name="firstName"
                type="text"
                placeholder="Ex. Lina"
                value={form.firstName}
                onChange={handleChange}
                required
              />
            </label>
            <label>
              <span>Efternamn</span>
              <input
                name="lastName"
                type="text"
                placeholder="Ex. Andersson"
                value={form.lastName}
                onChange={handleChange}
                required
              />
            </label>
          </div>
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
              placeholder="Minst 8 tecken"
              value={form.password}
              onChange={handleChange}
              required
            />
          </label>
          <button type="submit" className="primary-action" disabled={isSubmitting}>
            {isSubmitting ? 'Skapar...' : 'Skapa konto'}
          </button>
          {feedback.error && (
            <p className="auth-feedback auth-feedback--error" role="alert">
              {feedback.error}
            </p>
          )}
          {feedback.success && (
            <p className="auth-feedback auth-feedback--success">{feedback.success}</p>
          )}
        </form>

        <p className="auth-meta">
          Har du redan ett konto? <Link to="/login">Logga in</Link>
        </p>
      </div>
    </section>
  )
}

export default CreateAccountPage
