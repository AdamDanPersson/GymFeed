import { useState, useEffect, useRef, useCallback } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import flowMark from '../assets/airwave.svg'
import statsMark from '../assets/bar_chart.svg'
import './NavBar.css'

function NavBar() {
  const [isOpen, setIsOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const navRef = useRef(null)
  const toggleRef = useRef(null)
  const touchGuardRef = useRef(false)

  const handleNavigate = useCallback((path) => {
    setIsOpen(false)
    if (location.pathname !== path) {
      navigate(path)
    }
  }, [location.pathname, navigate])

  const handleTouchNavigate = useCallback((path, e) => {
    e.preventDefault()
    touchGuardRef.current = true
    handleNavigate(path)
    window.setTimeout(() => {
      touchGuardRef.current = false
    }, 350)
  }, [handleNavigate])

  const handleClickNavigate = useCallback((path, e) => {
    if (touchGuardRef.current) {
      e.preventDefault()
      return
    }
    e.preventDefault()
    handleNavigate(path)
  }, [handleNavigate])

  // Close menu on route change
  useEffect(() => {
    setIsOpen(false)
  }, [location.pathname])

  // Close menu when clicking outside (iOS-safe)
  useEffect(() => {
    if (!isOpen) return

    const handlePointerOutside = (e) => {
      const path = typeof e.composedPath === 'function' ? e.composedPath() : []
      if (path.includes(navRef.current) || navRef.current?.contains(e.target)) return
      if (path.includes(toggleRef.current) || toggleRef.current?.contains(e.target)) return
      setIsOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerOutside, { passive: true })
    document.addEventListener('touchstart', handlePointerOutside, { passive: true })
    return () => {
      document.removeEventListener('pointerdown', handlePointerOutside)
      document.removeEventListener('touchstart', handlePointerOutside)
    }
  }, [isOpen])

  return (
    <>
      {/* Mobile toggle button */}
      <button 
        ref={toggleRef}
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
        ref={navRef}
        className={`global-nav ${isOpen ? 'global-nav--open' : ''}`} 
        aria-label="Huvudnavigation"
      >
        <NavLink
          to="/flow"
          className={({ isActive }) =>
            isActive ? 'nav-link nav-link--flow is-active' : 'nav-link nav-link--flow'
          }
          onTouchEnd={(e) => handleTouchNavigate('/flow', e)}
          onClick={(e) => handleClickNavigate('/flow', e)}
        >
          <img src={flowMark} alt="Flow" />
          <span className="sr-only">Öppna Flow</span>
        </NavLink>

        <NavLink
          to="/stats"
          className={({ isActive }) =>
            isActive ? 'nav-link nav-link--stats is-active' : 'nav-link nav-link--stats'
          }
          onTouchEnd={(e) => handleTouchNavigate('/stats', e)}
          onClick={(e) => handleClickNavigate('/stats', e)}
        >
          <img src={statsMark} alt="Stats" />
          <span className="sr-only">Öppna Stats</span>
        </NavLink>
      </nav>
    </>
  )
}

export default NavBar
