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
let exercisesCollection
let workoutExercisesCollection

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
      .sort({ order: 1, createdAt: -1 })
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

  try {
    // Get the highest order value for this user
    const lastWorkout = await workoutsCollection
      .find({ userId: req.userId })
      .sort({ order: -1 })
      .limit(1)
      .toArray()
    
    const nextOrder = lastWorkout.length > 0 ? (lastWorkout[0].order ?? 0) + 1 : 0

    const now = new Date()
    const doc = {
      userId: req.userId,
      name,
      order: nextOrder,
      createdAt: now,
      updatedAt: now
    }

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
    const workoutObjectId = new ObjectId(id)
    const result = await workoutsCollection.deleteOne({
      _id: workoutObjectId,
      userId: req.userId
    })

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Workout not found' })
    }

    await workoutExercisesCollection.deleteMany({ userId: req.userId, workoutId: workoutObjectId })

    return res.status(204).end()
  } catch (error) {
    console.error('Delete workout error', error)
    return res.status(500).json({ message: 'Failed to delete workout' })
  }
})

async function assertWorkoutOwner(workoutId, userId) {
  if (!ObjectId.isValid(workoutId)) {
    const error = new Error('Invalid workout id')
    error.status = 400
    throw error
  }

  const workoutObjectId = new ObjectId(workoutId)
  const workout = await workoutsCollection.findOne({ _id: workoutObjectId, userId })
  if (!workout) {
    const error = new Error('Workout not found')
    error.status = 404
    throw error
  }

  return workoutObjectId
}

function toLinkResponse(linkDoc, exerciseDoc) {
  return {
    linkId: linkDoc._id.toString(),
    exerciseId: linkDoc.exerciseId.toString(),
    name: exerciseDoc?.name ?? null,
    order: linkDoc.order ?? 0
  }
}

app.get('/workouts/:workoutId/exercises', requireUser, async (req, res) => {
  try {
    const workoutObjectId = await assertWorkoutOwner(req.params.workoutId, req.userId)

    const links = await workoutExercisesCollection
      .find({ userId: req.userId, workoutId: workoutObjectId })
      .sort({ order: 1, createdAt: 1 })
      .toArray()

    const exerciseIds = links.map((link) => link.exerciseId)
    const exercises = await exercisesCollection
      .find({ userId: req.userId, _id: { $in: exerciseIds } })
      .toArray()
    const exercisesById = new Map(exercises.map((ex) => [ex._id.toString(), ex]))

    return res.json(links.map((link) => toLinkResponse(link, exercisesById.get(link.exerciseId.toString()))))
  } catch (error) {
    const status = error.status || 500
    if (status === 500) {
      console.error('Get workout exercises error', error)
    }
    return res.status(status).json({ message: error.message || 'Failed to fetch exercises' })
  }
})

app.post('/workouts/:workoutId/exercises', requireUser, async (req, res) => {
  try {
    const workoutObjectId = await assertWorkoutOwner(req.params.workoutId, req.userId)

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
    const exerciseId = typeof req.body?.exerciseId === 'string' ? req.body.exerciseId.trim() : ''

    if (!name && !exerciseId) {
      return res.status(400).json({ message: 'Either name or exerciseId is required' })
    }

    let exerciseDoc

    if (exerciseId) {
      if (!ObjectId.isValid(exerciseId)) {
        return res.status(400).json({ message: 'Invalid exercise id' })
      }
      exerciseDoc = await exercisesCollection.findOne({ _id: new ObjectId(exerciseId), userId: req.userId })
      if (!exerciseDoc) {
        return res.status(404).json({ message: 'Exercise not found' })
      }
    } else {
      exerciseDoc = await exercisesCollection.findOne({ userId: req.userId, name })
      if (!exerciseDoc) {
        const now = new Date()
        const newExercise = {
          userId: req.userId,
          name,
          createdAt: now
        }
        const result = await exercisesCollection.insertOne(newExercise)
        exerciseDoc = { ...newExercise, _id: result.insertedId }
      }
    }

    const lastLink = await workoutExercisesCollection
      .find({ userId: req.userId, workoutId: workoutObjectId })
      .sort({ order: -1 })
      .limit(1)
      .toArray()

    const nextOrder = lastLink.length > 0 ? (lastLink[0].order ?? 0) + 1 : 0
    const linkDoc = {
      userId: req.userId,
      workoutId: workoutObjectId,
      exerciseId: exerciseDoc._id,
      order: nextOrder,
      createdAt: new Date()
    }

    try {
      const linkResult = await workoutExercisesCollection.insertOne(linkDoc)
      return res.status(201).json(toLinkResponse({ ...linkDoc, _id: linkResult.insertedId }, exerciseDoc))
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ message: 'Exercise already exists in this workout' })
      }
      throw error
    }
  } catch (error) {
    const status = error.status || 500
    if (status === 500) {
      console.error('Create workout exercise error', error)
    }
    return res.status(status).json({ message: error.message || 'Failed to add exercise' })
  }
})

app.put('/workouts/:workoutId/exercises/reorder', requireUser, async (req, res) => {
  const items = req.body

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Body must be an array of { linkId, order }' })
  }

  try {
    const workoutObjectId = await assertWorkoutOwner(req.params.workoutId, req.userId)

    const linkObjectIds = items.map((item) => {
      if (!item || typeof item.linkId !== 'string' || !ObjectId.isValid(item.linkId)) {
        const error = new Error('Invalid linkId')
        error.status = 400
        throw error
      }
      if (typeof item.order !== 'number' || !Number.isFinite(item.order)) {
        const error = new Error('Invalid order')
        error.status = 400
        throw error
      }
      return new ObjectId(item.linkId)
    })

    const count = await workoutExercisesCollection.countDocuments({
      _id: { $in: linkObjectIds },
      userId: req.userId,
      workoutId: workoutObjectId
    })

    if (count !== items.length) {
      return res.status(403).json({ message: 'Some items do not belong to you' })
    }

    const bulkOps = items.map((item) => ({
      updateOne: {
        filter: { _id: new ObjectId(item.linkId), userId: req.userId, workoutId: workoutObjectId },
        update: { $set: { order: item.order } }
      }
    }))

    await workoutExercisesCollection.bulkWrite(bulkOps)
    return res.status(204).end()
  } catch (error) {
    const status = error.status || 500
    if (status === 500) {
      console.error('Reorder workout exercises error', error)
    }
    return res.status(status).json({ message: error.message || 'Failed to reorder exercises' })
  }
})

app.delete('/workouts/:workoutId/exercises/:linkId', requireUser, async (req, res) => {
  try {
    const workoutObjectId = await assertWorkoutOwner(req.params.workoutId, req.userId)

    const { linkId } = req.params
    if (!ObjectId.isValid(linkId)) {
      return res.status(400).json({ message: 'Invalid link id' })
    }

    const result = await workoutExercisesCollection.deleteOne({
      _id: new ObjectId(linkId),
      userId: req.userId,
      workoutId: workoutObjectId
    })

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Exercise link not found' })
    }

    return res.status(204).end()
  } catch (error) {
    const status = error.status || 500
    if (status === 500) {
      console.error('Delete workout exercise error', error)
    }
    return res.status(status).json({ message: error.message || 'Failed to remove exercise' })
  }
})

app.put('/workouts/:workoutId/exercises/:linkId/rename', requireUser, async (req, res) => {
  try {
    const workoutObjectId = await assertWorkoutOwner(req.params.workoutId, req.userId)

    const { linkId } = req.params
    if (!ObjectId.isValid(linkId)) {
      return res.status(400).json({ message: 'Invalid link id' })
    }

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
    if (!name) {
      return res.status(400).json({ message: 'Exercise name is required' })
    }

    const link = await workoutExercisesCollection.findOne({
      _id: new ObjectId(linkId),
      userId: req.userId,
      workoutId: workoutObjectId
    })

    if (!link) {
      return res.status(404).json({ message: 'Exercise link not found' })
    }

    const exerciseObjectId = link.exerciseId

    await exercisesCollection.updateOne(
      { _id: exerciseObjectId, userId: req.userId },
      { $set: { name, updatedAt: new Date() } }
    )

    const exerciseDoc = await exercisesCollection.findOne({ _id: exerciseObjectId, userId: req.userId })
    return res.json(toLinkResponse(link, exerciseDoc))
  } catch (error) {
    const status = error.status || 500
    if (status === 500) {
      console.error('Rename exercise error', error)
    }
    return res.status(status).json({ message: error.message || 'Failed to rename exercise' })
  }
})

app.put('/workouts/reorder', requireUser, async (req, res) => {
  const { workoutIds } = req.body

  if (!Array.isArray(workoutIds) || workoutIds.length === 0) {
    return res.status(400).json({ message: 'workoutIds array is required' })
  }

  // Validate all IDs
  const objectIds = workoutIds.map(id => {
    if (!ObjectId.isValid(id)) {
      throw new Error(`Invalid workout ID: ${id}`)
    }
    return new ObjectId(id)
  })

  try {
    // Verify all workouts belong to the user
    const count = await workoutsCollection.countDocuments({
      _id: { $in: objectIds },
      userId: req.userId
    })

    if (count !== workoutIds.length) {
      return res.status(403).json({ message: 'Some workouts do not belong to you' })
    }

    // Update order for each workout
    const bulkOps = workoutIds.map((id, index) => ({
      updateOne: {
        filter: { _id: new ObjectId(id) },
        update: { $set: { order: index } }
      }
    }))

    await workoutsCollection.bulkWrite(bulkOps)

    // Return updated workouts
    const updatedWorkouts = await workoutsCollection
      .find({ userId: req.userId })
      .sort({ order: 1, createdAt: -1 })
      .toArray()

    return res.json(updatedWorkouts.map(serializeWorkout))
  } catch (error) {
    console.error('Reorder workouts error', error)
    return res.status(500).json({ message: 'Failed to reorder workouts' })
  }
})

function serializeWorkout(doc) {
  return {
    _id: doc._id.toString(),
    name: doc.name,
    order: doc.order ?? 0,
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
    exercisesCollection = db.collection('exercises')
    workoutExercisesCollection = db.collection('workoutExercises')
    await usersCollection.createIndex({ email: 1 }, { unique: true })
    await workoutsCollection.createIndex({ userId: 1, createdAt: -1 })
    await workoutsCollection.createIndex({ userId: 1, name: 1 }, { unique: true })
    await exercisesCollection.createIndex({ userId: 1, name: 1 })
    await workoutExercisesCollection.createIndex({ userId: 1, workoutId: 1, order: 1 })
    await workoutExercisesCollection.createIndex(
      { userId: 1, workoutId: 1, exerciseId: 1 },
      { unique: true }
    )

    app.listen(PORT, () => {
      console.log(`API listening on http://localhost:${PORT}`)
    })
  } catch (error) {
    console.error('Failed to connect to MongoDB', error)
    process.exit(1)
  }
}

start()
