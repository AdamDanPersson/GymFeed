import { Link } from 'react-router-dom'
import './Login.css'

function LoginPage() {
  return (
    <section className="auth-page auth-page--login">
      <div className="auth-card">
        <h1>Logga in</h1>
        <p className="auth-lede">
          Logga in och fortsätt följa din träning
        </p>

        <form className="auth-form" aria-label="Logga in">
          <label>
            <span>E-post</span>
            <input type="email" placeholder="namn@mail.se" />
          </label>
          <label>
            <span>Lösenord</span>
            <input type="password" placeholder="• • • • • • • •" />
          </label>
          <div className="auth-actions">

            <button type="button">Fortsätt</button>
          </div>
        </form>

        <p className="auth-meta">
          Behöver du ett konto? <Link to="/create-account">Skapa ett</Link>
        </p>
      </div>
    </section>
  )
}

export default LoginPage
