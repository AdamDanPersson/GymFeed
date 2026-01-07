import { Link } from 'react-router-dom'
import flowMark from '../assets/airwave.svg'
import statsMark from '../assets/bar_chart.svg'
import './Home.css'

function HomePage() {
  return (
    <section className="landing-screen" aria-label="Välj arbetsläge">
      <Link to="/flow" className="landing-panel landing-panel--flow">
        <img src={flowMark} alt="Flow logotyp" />
        <span>Flow</span>
      </Link>
      <Link to="/stats" className="landing-panel landing-panel--stats">
        <img src={statsMark} alt="Stats logotyp" />
        <span>Stats</span>
      </Link>
    </section>
  )
}

export default HomePage
