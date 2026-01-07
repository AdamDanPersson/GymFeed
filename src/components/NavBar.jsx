import { NavLink } from 'react-router-dom'
import flowMark from '../assets/airwave.svg'
import statsMark from '../assets/bar_chart.svg'
import './NavBar.css'

function NavBar() {
  return (
    <nav className="global-nav" aria-label="Huvudnavigation">
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
  )
}

export default NavBar
