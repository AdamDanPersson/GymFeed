import { Route, Routes } from 'react-router-dom'
import CreateAccountPage from './pages/CreateAccount.jsx'
import FlowPage from './pages/Flow.jsx'
import HomePage from './pages/Home.jsx'
import LoginPage from './pages/Login.jsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/flow" element={<FlowPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/create-account" element={<CreateAccountPage />} />
    </Routes>
  )
}

export default App
