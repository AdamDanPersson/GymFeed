import { Link } from 'react-router-dom'
import './CreateAccount.css'

function CreateAccountPage() {
  return (
    <section className="auth-page auth-page--create">
      <div className="auth-card">
        <h1>Skapa konto</h1>
        <p className="auth-lede">
          Registrera dig och få överblick över din träning
        </p>

        <form className="auth-form" aria-label="Skapa konto">
          <div className="auth-form__grid">
            <label>
              <span>Förnamn</span>
              <input type="text" placeholder="Ex. Lina" />
            </label>
            <label>
              <span>Efternamn</span>
              <input type="text" placeholder="Ex. Andersson" />
            </label>
          </div>
          <label>
            <span>E-post</span>
            <input type="email" placeholder="namn@mail.se" />
          </label>
          <label>
            <span>Lösenord</span>
            <input type="password" placeholder="Minst 8 tecken" />
          </label>
        </form>

        <button type="button" className="primary-action">Skapa konto</button>
        <p className="auth-meta">
          Har du redan ett konto? <Link to="/login">Logga in</Link>
        </p>
      </div>
    </section>
  )
}

export default CreateAccountPage
