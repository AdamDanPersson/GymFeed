import cors from 'cors'
import express from 'express'
import { FRONTEND_URL } from './config.js'
import { registerHealthRoutes } from './routes/health.js'
import { registerAuthRoutes } from './routes/auth.js'
import { registerUsersRoutes } from './routes/users.js'
import { registerWorkoutRoutes } from './routes/workouts.js'
import { registerSetRoutes } from './routes/sets.js'
import { registerStatsRoutes } from './routes/stats.js'
import { registerPostRoutes } from './routes/posts.js'

const app = express()

// CORS configuration for production
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true)
    
    const allowedOrigins = [
      FRONTEND_URL,
      'http://localhost:5173',
      'http://localhost:4173'
    ]
    
    if (allowedOrigins.some(allowed => origin.startsWith(allowed.replace(/\/$/, '')))) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id']
}

app.use(cors(corsOptions))
app.use(express.json())

registerHealthRoutes(app)
registerAuthRoutes(app)
registerUsersRoutes(app)
registerWorkoutRoutes(app)
registerSetRoutes(app)
registerStatsRoutes(app)
registerPostRoutes(app)

export default app
