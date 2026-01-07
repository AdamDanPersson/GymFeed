import { Outlet } from 'react-router-dom'
import NavBar from '../components/NavBar.jsx'
import './AppLayout.css'

function AppLayout() {
  return (
    <div className="nav-layout">
      <div className="nav-layout__content">
        <Outlet />
      </div>
      <NavBar />
    </div>
  )
}

export default AppLayout
