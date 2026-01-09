import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import flowMark from '../assets/airwave.svg'
import statsMark from '../assets/bar_chart.svg'
import './NavBar.css'

function NavBar() {
  const [isOpen, setIsOpen] = useState(false)
  const location = useLocation()

  // Close menu on route change
  useEffect(() => {
    setIsOpen(false)
  }, [location.pathname])

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return
    
    const handleClickOutside = (e) => {
      if (!e.target.closest('.global-nav') && !e.target.closest('.nav-toggle')) {
        setIsOpen(false)
      }
    }
    
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [isOpen])

  return (
    <>
      {/* Mobile toggle button */}
      <button 
        className={`nav-toggle ${isOpen ? 'nav-toggle--open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Stäng meny' : 'Öppna meny'}
        aria-expanded={isOpen}
      >
        <span className="nav-toggle__bar"></span>
        <span className="nav-toggle__bar"></span>
        <span className="nav-toggle__bar"></span>
      </button>

      <nav 
        className={`global-nav ${isOpen ? 'global-nav--open' : ''}`} 
        aria-label="Huvudnavigation"
      >
        <NavLink
          to="/flow"
          className={({ isActive }) =>
            isActive ? 'nav-link nav-link--flow is-active' : 'nav-link nav-link--flow'
          }
        >
          <img src={flowMark} alt="Flow" />
          <span className="sr-only">Öppna Flow</span>
        </NavLink>

        <NavLink
          to="/stats"
          className={({ isActive }) =>
            isActive ? 'nav-link nav-link--stats is-active' : 'nav-link nav-link--stats'
          }
        >
          <img src={statsMark} alt="Stats" />
          <span className="sr-only">Öppna Stats</span>
        </NavLink>
      </nav>
    </>
  )
}

export default NavBar
