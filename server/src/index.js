import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { MongoClient } from 'mongodb'

dotenv.config()

const PORT = process.env.PORT || 3000
const DB_NAME = process.env.DB_NAME || 'GymFeed'
const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  throw new Error('Missing MONGODB_URI in environment variables')
}

const app = express()
app.use(cors())
app.use(express.json())

let usersCollection

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.post('/auth/register', async (req, res) => {
  const { email, password, firstName, lastName } = req.body

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ message: 'Email is required' })
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' })
  }

  const trimmedFirstName = typeof firstName === 'string' ? firstName.trim() : ''
  const trimmedLastName = typeof lastName === 'string' ? lastName.trim() : ''

  if (!trimmedFirstName || !trimmedLastName) {
    return res.status(400).json({ message: 'First and last name are required' })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const fullName = `${trimmedFirstName} ${trimmedLastName}`.trim()

  const userDoc = {
    email: normalizedEmail,
    password,
    firstName: trimmedFirstName,
    lastName: trimmedLastName,
    fullName,
    createdAt: new Date()
  }

  try {
    const result = await usersCollection.insertOne(userDoc)
    return res.status(201).json({
      userId: result.insertedId,
      email: normalizedEmail,
      firstName: trimmedFirstName,
      lastName: trimmedLastName,
      name: fullName
    })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Email already exists' })
    }
    console.error('Register error', error)
    return res.status(500).json({ message: 'Failed to register user' })
  }
})

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' })
  }

  const normalizedEmail = email.trim().toLowerCase()

  try {
    const user = await usersCollection.findOne({ email: normalizedEmail })
    if (!user || user.password !== password) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const responseFullName = user.fullName || user.name || null

    return res.json({
      userId: user._id,
      email: user.email,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      name: responseFullName
    })
  } catch (error) {
    console.error('Login error', error)
    return res.status(500).json({ message: 'Failed to login' })
  }
})

async function start() {
  try {
    const client = new MongoClient(MONGODB_URI)
    await client.connect()
    const db = client.db(DB_NAME)
    usersCollection = db.collection('users')
    await usersCollection.createIndex({ email: 1 }, { unique: true })

    app.listen(PORT, () => {
      console.log(`API listening on http://localhost:${PORT}`)
    })
  } catch (error) {
    console.error('Failed to connect to MongoDB', error)
    process.exit(1)
  }
}

start()
