import dotenv from 'dotenv'

dotenv.config()

// Serverns portnummer och databaskonfiguration
const PORT = process.env.PORT || 3000
const DB_NAME = process.env.DB_NAME || 'GymFeed'
const MONGODB_URI = process.env.MONGODB_URI
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

// Validera att nödvändiga miljövariabler finns
if (!MONGODB_URI) {
  throw new Error('Missing MONGODB_URI in environment variables')
}

export { PORT, DB_NAME, MONGODB_URI, FRONTEND_URL }
