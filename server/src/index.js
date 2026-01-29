/**
 * GymFeed API Server
 * 
 * Huvudsaklig backend för GymFeed-appen. Hanterar:
 * - Användarautentisering (registrering/inloggning)
 * - Träningspass och övningar
 * - Set-loggning och statistik
 * - Sociala funktioner (poster, gilla-markeringar, kommentarer)
 * 
 * @author GymFeed Team
 */

// ==================== IMPORTS ====================
import app from './app.js'
import { DB_NAME, FRONTEND_URL, MONGODB_URI, PORT } from './config.js'
import { collections } from './db/collections.js'
import { connectDb } from './db/connect.js'

// ==================== SERVERSTART ====================

/**
 * Initierar databasanslutning, skapar index och startar servern
 */
async function start() {
  try {
    await connectDb(MONGODB_URI, DB_NAME, collections)

    app.listen(PORT, () => {
      console.log(`✅ API listening on port ${PORT}`)
      console.log(`📊 Database: ${DB_NAME}`)
      console.log(`🌐 CORS enabled for: ${FRONTEND_URL}`)
      console.log(`🚀 Environment: ${process.env.NODE_ENV || 'development'}`)
    })
  } catch (error) {
    console.error('Failed to connect to MongoDB', error)
    process.exit(1)
  }
}

start()
