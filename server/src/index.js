import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { MongoClient, ObjectId } from 'mongodb'

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
let workoutsCollection

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
      userId: result.insertedId.toString(),
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
      userId: user._id.toString(),
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

function requireUser(req, res, next) {
  const userIdHeader = req.header('x-user-id')?.trim()

  if (!userIdHeader || !ObjectId.isValid(userIdHeader)) {
    return res.status(401).json({ message: 'User authentication required' })
  }

  req.userId = new ObjectId(userIdHeader)
  next()
}

app.get('/workouts', requireUser, async (req, res) => {
  try {
    const docs = await workoutsCollection
      .find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .toArray()

    return res.json(docs.map(serializeWorkout))
  } catch (error) {
    console.error('Get workouts error', error)
    return res.status(500).json({ message: 'Failed to fetch workouts' })
  }
})

app.post('/workouts', requireUser, async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''

  if (!name) {
    return res.status(400).json({ message: 'Workout name is required' })
  }

  const now = new Date()
  const doc = {
    userId: req.userId,
    name,
    createdAt: now,
    updatedAt: now
  }

  try {
    const result = await workoutsCollection.insertOne(doc)
    return res.status(201).json(serializeWorkout({ ...doc, _id: result.insertedId }))
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Workout name already exists' })
    }
    console.error('Create workout error', error)
    return res.status(500).json({ message: 'Failed to create workout' })
  }
})

app.delete('/workouts/:id', requireUser, async (req, res) => {
  const { id } = req.params

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid workout id' })
  }

  try {
    const result = await workoutsCollection.deleteOne({
      _id: new ObjectId(id),
      userId: req.userId
    })

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Workout not found' })
    }

    return res.status(204).end()
  } catch (error) {
    console.error('Delete workout error', error)
    return res.status(500).json({ message: 'Failed to delete workout' })
  }
})

function serializeWorkout(doc) {
  return {
    _id: doc._id.toString(),
    name: doc.name,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt || doc.createdAt
  }
}

async function start() {
  try {
    const client = new MongoClient(MONGODB_URI)
    await client.connect()
    const db = client.db(DB_NAME)
    usersCollection = db.collection('users')
    workoutsCollection = db.collection('workouts')
    await usersCollection.createIndex({ email: 1 }, { unique: true })
    await workoutsCollection.createIndex({ userId: 1, createdAt: -1 })
    await workoutsCollection.createIndex({ userId: 1, name: 1 }, { unique: true })

    app.listen(PORT, () => {
      console.log(`API listening on http://localhost:${PORT}`)
    })
  } catch (error) {
    console.error('Failed to connect to MongoDB', error)
    process.exit(1)
  }
}

start()
