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
let setsCollection
let postsCollection
let postLikesCollection
let postCommentsCollection

// Valid metrics and chart types for posts
const VALID_METRICS = ['maxWeight', 'totalVolume', 'e1rm', 'setCount', 'allSets']
const VALID_CHART_TYPES = ['bar', 'line']

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

    // Find all exercise links for this workout to get exerciseIds
    const links = await workoutExercisesCollection.find({
      userId: req.userId,
      workoutId: workoutObjectId
    }).toArray()

    const exerciseIds = links.map(link => link.exerciseId).filter(Boolean)

    // Delete all exercise links for this workout
    await workoutExercisesCollection.deleteMany({ userId: req.userId, workoutId: workoutObjectId })

    // Only delete exercises that are not used in any other workout
    if (exerciseIds.length > 0) {
      for (const exerciseId of exerciseIds) {
        const otherLinks = await workoutExercisesCollection.countDocuments({
          userId: req.userId,
          exerciseId: exerciseId
        })

        if (otherLinks === 0) {
          await exercisesCollection.deleteOne({
            _id: exerciseId,
            userId: req.userId
          })
        }
      }
    }

    return res.status(204).end()
  } catch (error) {
    console.error('Delete workout error', error)
    return res.status(500).json({ message: 'Failed to delete workout' })
  }
})

app.put('/workouts/:id/rename', requireUser, async (req, res) => {
  const { id } = req.params

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid workout id' })
  }

  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
  if (!name) {
    return res.status(400).json({ message: 'Workout name is required' })
  }

  try {
    const workoutObjectId = new ObjectId(id)
    const result = await workoutsCollection.findOneAndUpdate(
      { _id: workoutObjectId, userId: req.userId },
      { $set: { name, updatedAt: new Date() } },
      { returnDocument: 'after' }
    )

    if (!result) {
      return res.status(404).json({ message: 'Workout not found' })
    }

    return res.status(200).json({
      _id: result._id.toString(),
      name: result.name,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt
    })
  } catch (error) {
    console.error('Rename workout error', error)
    return res.status(500).json({ message: 'Failed to rename workout' })
  }
})

app.post('/workouts/:id/copy', requireUser, async (req, res) => {
  const { id } = req.params

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid workout id' })
  }

  try {
    const workoutObjectId = new ObjectId(id)
    const originalWorkout = await workoutsCollection.findOne({
      _id: workoutObjectId,
      userId: req.userId
    })

    if (!originalWorkout) {
      return res.status(404).json({ message: 'Workout not found' })
    }

    // Create new workout with "(kopia)" suffix
    const now = new Date()
    const newWorkout = {
      userId: req.userId,
      name: `${originalWorkout.name} (kopia)`,
      createdAt: now,
      updatedAt: now
    }

    const insertResult = await workoutsCollection.insertOne(newWorkout)
    const newWorkoutId = insertResult.insertedId

    // Get all exercise links from the original workout
    const originalLinks = await workoutExercisesCollection
      .find({ userId: req.userId, workoutId: workoutObjectId })
      .sort({ order: 1 })
      .toArray()

    // Create new links for the copied workout, pointing to the same exercises
    if (originalLinks.length > 0) {
      const newLinks = originalLinks.map((link, index) => ({
        userId: req.userId,
        workoutId: newWorkoutId,
        exerciseId: link.exerciseId, // Same exercise, not a copy
        order: index,
        createdAt: now
      }))

      await workoutExercisesCollection.insertMany(newLinks)
    }

    return res.status(201).json({
      _id: newWorkoutId.toString(),
      name: newWorkout.name,
      createdAt: newWorkout.createdAt,
      updatedAt: newWorkout.updatedAt
    })
  } catch (error) {
    console.error('Copy workout error', error)
    return res.status(500).json({ message: 'Failed to copy workout' })
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

    const link = await workoutExercisesCollection.findOne({
      _id: new ObjectId(linkId),
      userId: req.userId,
      workoutId: workoutObjectId
    })

    if (!link) {
      return res.status(404).json({ message: 'Exercise link not found' })
    }

    const exerciseId = link.exerciseId

    const result = await workoutExercisesCollection.deleteOne({
      _id: new ObjectId(linkId),
      userId: req.userId,
      workoutId: workoutObjectId
    })

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Exercise link not found' })
    }

    // Only delete the exercise if it's not used in any other workout
    const otherLinks = await workoutExercisesCollection.countDocuments({
      userId: req.userId,
      exerciseId: exerciseId
    })

    if (otherLinks === 0) {
      await exercisesCollection.deleteOne({
        _id: exerciseId,
        userId: req.userId
      })
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

app.post('/workouts/:workoutId/exercises/:linkId/copy', requireUser, async (req, res) => {
  try {
    const workoutObjectId = await assertWorkoutOwner(req.params.workoutId, req.userId)

    const { linkId } = req.params
    if (!ObjectId.isValid(linkId)) {
      return res.status(400).json({ message: 'Invalid link id' })
    }

    const originalLink = await workoutExercisesCollection.findOne({
      _id: new ObjectId(linkId),
      userId: req.userId,
      workoutId: workoutObjectId
    })

    if (!originalLink) {
      return res.status(404).json({ message: 'Exercise link not found' })
    }

    const originalExercise = await exercisesCollection.findOne({
      _id: originalLink.exerciseId,
      userId: req.userId
    })

    if (!originalExercise) {
      return res.status(404).json({ message: 'Exercise not found' })
    }

    const copyName = `${originalExercise.name} (kopia)`

    let exerciseDoc = await exercisesCollection.findOne({ userId: req.userId, name: copyName })
    if (!exerciseDoc) {
      const now = new Date()
      const newExercise = {
        userId: req.userId,
        name: copyName,
        createdAt: now
      }
      const result = await exercisesCollection.insertOne(newExercise)
      exerciseDoc = { ...newExercise, _id: result.insertedId }
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
      console.error('Copy exercise error', error)
    }
    return res.status(status).json({ message: error.message || 'Failed to copy exercise' })
  }
})

app.put('/workouts/:workoutId/exercises/:linkId/move', requireUser, async (req, res) => {
  try {
    const sourceWorkoutId = await assertWorkoutOwner(req.params.workoutId, req.userId)

    const { linkId } = req.params
    if (!ObjectId.isValid(linkId)) {
      return res.status(400).json({ message: 'Invalid link id' })
    }

    const targetWorkoutId = typeof req.body?.targetWorkoutId === 'string' ? req.body.targetWorkoutId.trim() : ''
    if (!targetWorkoutId || !ObjectId.isValid(targetWorkoutId)) {
      return res.status(400).json({ message: 'Valid target workout ID is required' })
    }

    const targetWorkoutObjectId = await assertWorkoutOwner(targetWorkoutId, req.userId)

    const link = await workoutExercisesCollection.findOne({
      _id: new ObjectId(linkId),
      userId: req.userId,
      workoutId: sourceWorkoutId
    })

    if (!link) {
      return res.status(404).json({ message: 'Exercise link not found' })
    }

    const exerciseId = link.exerciseId

    const existingLink = await workoutExercisesCollection.findOne({
      userId: req.userId,
      workoutId: targetWorkoutObjectId,
      exerciseId: exerciseId
    })

    if (existingLink) {
      return res.status(409).json({ message: 'Exercise already exists in target workout' })
    }

    await workoutExercisesCollection.deleteOne({
      _id: new ObjectId(linkId),
      userId: req.userId,
      workoutId: sourceWorkoutId
    })

    const lastLink = await workoutExercisesCollection
      .find({ userId: req.userId, workoutId: targetWorkoutObjectId })
      .sort({ order: -1 })
      .limit(1)
      .toArray()

    const nextOrder = lastLink.length > 0 ? (lastLink[0].order ?? 0) + 1 : 0
    const newLinkDoc = {
      userId: req.userId,
      workoutId: targetWorkoutObjectId,
      exerciseId: exerciseId,
      order: nextOrder,
      createdAt: new Date()
    }

    const linkResult = await workoutExercisesCollection.insertOne(newLinkDoc)
    const exerciseDoc = await exercisesCollection.findOne({ _id: exerciseId, userId: req.userId })

    return res.json(toLinkResponse({ ...newLinkDoc, _id: linkResult.insertedId }, exerciseDoc))
  } catch (error) {
    const status = error.status || 500
    if (status === 500) {
      console.error('Move exercise error', error)
    }
    return res.status(status).json({ message: error.message || 'Failed to move exercise' })
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

// ==================== SETS ENDPOINTS ====================

app.post('/exercises/:exerciseId/sets/bulk', requireUser, async (req, res) => {
  const { exerciseId } = req.params
  const { sets } = req.body

  if (!ObjectId.isValid(exerciseId)) {
    return res.status(400).json({ message: 'Invalid exercise ID' })
  }

  if (!Array.isArray(sets) || sets.length === 0) {
    return res.status(400).json({ message: 'Sets array is required and must not be empty' })
  }

  // Validate each set
  for (const set of sets) {
    if (typeof set.weight !== 'number' || typeof set.reps !== 'number' || typeof set.isDropSet !== 'boolean') {
      return res.status(400).json({ message: 'Each set must have weight (number), reps (number), and isDropSet (boolean)' })
    }
  }

  try {
    const exerciseObjectId = new ObjectId(exerciseId)

    // Verify exercise belongs to user
    const exercise = await exercisesCollection.findOne({ _id: exerciseObjectId, userId: req.userId })
    if (!exercise) {
      return res.status(404).json({ message: 'Exercise not found' })
    }

    // Generate groupId for this bulk save
    const groupId = new ObjectId().toString()
    const now = new Date()

    // Create set documents
    const setDocs = sets.map(set => ({
      userId: req.userId,
      exerciseId: exerciseObjectId,
      weight: set.weight,
      reps: set.reps,
      isDropSet: set.isDropSet,
      date: now,
      groupId: groupId,
      createdAt: now
    }))

    const result = await setsCollection.insertMany(setDocs)

    return res.status(201).json({
      groupId,
      insertedCount: result.insertedCount,
      items: setDocs.map((doc, index) => ({
        _id: Object.values(result.insertedIds)[index].toString(),
        weight: doc.weight,
        reps: doc.reps,
        isDropSet: doc.isDropSet,
        date: doc.date,
        groupId: doc.groupId
      }))
    })
  } catch (error) {
    console.error('Bulk save sets error', error)
    return res.status(500).json({ message: 'Failed to save sets' })
  }
})

app.get('/exercises/:exerciseId/sets', requireUser, async (req, res) => {
  const { exerciseId } = req.params

  if (!ObjectId.isValid(exerciseId)) {
    return res.status(400).json({ message: 'Invalid exercise ID' })
  }

  try {
    const exerciseObjectId = new ObjectId(exerciseId)

    // Verify exercise belongs to user
    const exercise = await exercisesCollection.findOne({ _id: exerciseObjectId, userId: req.userId })
    if (!exercise) {
      return res.status(404).json({ message: 'Exercise not found' })
    }

    // Get all sets for this exercise
    const sets = await setsCollection
      .find({ userId: req.userId, exerciseId: exerciseObjectId })
      .sort({ date: -1, createdAt: -1 })
      .toArray()

    // Group sets by groupId
    const groups = {}
    for (const set of sets) {
      if (!groups[set.groupId]) {
        groups[set.groupId] = []
      }
      groups[set.groupId].push(set)
    }

    // Build response
    const groupsData = Object.entries(groups).map(([gid, groupSets]) => ({
      groupId: gid,
      date: groupSets[0]?.date || null,
      sets: groupSets.map(s => ({
        _id: s._id.toString(),
        weight: s.weight,
        reps: s.reps,
        isDropSet: s.isDropSet
      }))
    }))

    return res.json({
      exercise: {
        _id: exercise._id.toString(),
        name: exercise.name
      },
      groups: groupsData
    })
  } catch (error) {
    console.error('Get exercise sets error', error)
    return res.status(500).json({ message: 'Failed to fetch sets' })
  }
})

app.put('/sets/:setId', requireUser, async (req, res) => {
  const { setId } = req.params
  const { weight, reps, isDropSet } = req.body

  if (!ObjectId.isValid(setId)) {
    return res.status(400).json({ message: 'Invalid set ID' })
  }

  if (typeof weight !== 'number' || typeof reps !== 'number' || typeof isDropSet !== 'boolean') {
    return res.status(400).json({ message: 'Weight, reps, and isDropSet are required' })
  }

  try {
    const result = await setsCollection.findOneAndUpdate(
      { _id: new ObjectId(setId), userId: req.userId },
      { $set: { weight, reps, isDropSet, updatedAt: new Date() } },
      { returnDocument: 'after' }
    )

    if (!result) {
      return res.status(404).json({ message: 'Set not found' })
    }

    return res.json({
      _id: result._id.toString(),
      weight: result.weight,
      reps: result.reps,
      isDropSet: result.isDropSet
    })
  } catch (error) {
    console.error('Update set error', error)
    return res.status(500).json({ message: 'Failed to update set' })
  }
})

app.delete('/sets/:setId', requireUser, async (req, res) => {
  const { setId } = req.params

  if (!ObjectId.isValid(setId)) {
    return res.status(400).json({ message: 'Invalid set ID' })
  }

  try {
    const result = await setsCollection.deleteOne({
      _id: new ObjectId(setId),
      userId: req.userId
    })

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Set not found' })
    }

    return res.status(204).end()
  } catch (error) {
    console.error('Delete set error', error)
    return res.status(500).json({ message: 'Failed to delete set' })
  }
})

// Get monthly gym visit statistics (last 12 months)
app.get('/stats/monthly-visits', requireUser, async (req, res) => {
  try {
    // Calculate date range: 12 months ago to now
    const now = new Date()
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1) // Start of month 12 months ago
    
    // Get all unique groupIds (each groupId = one gym session) within date range
    const sets = await setsCollection
      .find({ 
        userId: req.userId,
        date: { $gte: twelveMonthsAgo }
      })
      .toArray()
    
    // Group by month and count unique groupIds (sessions)
    const monthlyVisits = {}
    const seenGroups = new Set()
    
    for (const set of sets) {
      // Only count each groupId once (one gym visit)
      if (seenGroups.has(set.groupId)) continue
      seenGroups.add(set.groupId)
      
      const date = new Date(set.date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      monthlyVisits[monthKey] = (monthlyVisits[monthKey] || 0) + 1
    }
    
    // Build response for last 12 months (including months with 0 visits)
    const result = []
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const monthName = date.toLocaleDateString('sv-SE', { month: 'short' })
      
      result.push({
        month: monthKey,
        label: monthName.charAt(0).toUpperCase() + monthName.slice(1),
        visits: monthlyVisits[monthKey] || 0
      })
    }
    
    return res.json(result)
  } catch (error) {
    console.error('Get monthly visits error', error)
    return res.status(500).json({ message: 'Failed to fetch monthly statistics' })
  }
})

// ==================== POSTS ENDPOINTS ====================

// GET /exercises - Get all exercises for current user (for dropdown)
app.get('/exercises', requireUser, async (req, res) => {
  try {
    const exercises = await exercisesCollection
      .find({ userId: req.userId })
      .sort({ name: 1 })
      .toArray()

    return res.json(
      exercises.map((ex) => ({
        _id: ex._id.toString(),
        name: ex.name
      }))
    )
  } catch (error) {
    console.error('Get exercises error', error)
    return res.status(500).json({ message: 'Failed to fetch exercises' })
  }
})

// POST /posts - Create a new graph post
app.post('/posts', requireUser, async (req, res) => {
  const { type, title, description, exerciseId, chartType, metric, dateRange, dateMode, specificDates } = req.body

  // Validate type
  if (type !== 'graph') {
    return res.status(400).json({ message: 'Only graph posts are supported' })
  }

  // Validate title
  const trimmedTitle = typeof title === 'string' ? title.trim() : ''
  if (!trimmedTitle) {
    return res.status(400).json({ message: 'Title is required' })
  }
  if (trimmedTitle.length > 80) {
    return res.status(400).json({ message: 'Title must be 80 characters or less' })
  }

  // Validate exerciseId
  if (!exerciseId || !ObjectId.isValid(exerciseId)) {
    return res.status(400).json({ message: 'Valid exerciseId is required' })
  }

  // Validate chartType
  if (!VALID_CHART_TYPES.includes(chartType)) {
    return res.status(400).json({ message: `chartType must be one of: ${VALID_CHART_TYPES.join(', ')}` })
  }

  // Validate metric
  if (!VALID_METRICS.includes(metric)) {
    return res.status(400).json({ message: `metric must be one of: ${VALID_METRICS.join(', ')}` })
  }

  // Validate dateRange
  if (!dateRange || !dateRange.from || !dateRange.to) {
    return res.status(400).json({ message: 'dateRange with from and to is required' })
  }

  const fromDate = new Date(dateRange.from)
  const toDate = new Date(dateRange.to)

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return res.status(400).json({ message: 'Invalid date format in dateRange' })
  }

  if (fromDate > toDate) {
    return res.status(400).json({ message: 'dateRange.from must be before dateRange.to' })
  }

  try {
    // Verify exercise belongs to user
    const exercise = await exercisesCollection.findOne({
      _id: new ObjectId(exerciseId),
      userId: req.userId
    })

    if (!exercise) {
      return res.status(404).json({ message: 'Exercise not found or does not belong to you' })
    }

    // Get user info for author name
    const user = await usersCollection.findOne({ _id: req.userId })
    const authorName = user?.fullName || user?.firstName || 'Okänd'

    const now = new Date()
    const postDoc = {
      userId: req.userId,
      type: 'graph',
      title: trimmedTitle,
      description: typeof description === 'string' ? description.trim() : '',
      exerciseId: new ObjectId(exerciseId),
      exerciseName: exercise.name,
      authorName,
      chartType,
      metric,
      dateRange: {
        from: fromDate,
        to: toDate
      },
      dateMode: dateMode || 'range',
      specificDates: Array.isArray(specificDates) ? specificDates : null,
      graphConfig: {
        chartType,
        metric,
        dateRange: {
          from: fromDate,
          to: toDate
        }
      },
      createdAt: now,
      likeCount: 0,
      commentCount: 0
    }

    const result = await postsCollection.insertOne(postDoc)

    return res.status(201).json({
      _id: result.insertedId.toString(),
      userId: postDoc.userId.toString(),
      type: postDoc.type,
      title: postDoc.title,
      description: postDoc.description,
      exerciseId: postDoc.exerciseId.toString(),
      exerciseName: postDoc.exerciseName,
      authorName: postDoc.authorName,
      chartType: postDoc.chartType,
      metric: postDoc.metric,
      dateRange: postDoc.dateRange,
      dateMode: postDoc.dateMode,
      specificDates: postDoc.specificDates,
      graphConfig: postDoc.graphConfig,
      createdAt: postDoc.createdAt,
      likeCount: postDoc.likeCount,
      commentCount: postDoc.commentCount
    })
  } catch (error) {
    console.error('Create post error', error)
    return res.status(500).json({ message: 'Failed to create post' })
  }
})

// GET /posts - Public feed with cursor pagination
app.get('/posts', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 5, 50)
  const cursor = req.query.cursor

  try {
    let query = {}

    // Cursor-based pagination: get posts older than cursor
    if (cursor) {
      const cursorDate = new Date(cursor)
      if (!isNaN(cursorDate.getTime())) {
        query.createdAt = { $lt: cursorDate }
      }
    }

    const posts = await postsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit + 1) // Fetch one extra to check if there are more
      .toArray()

    const hasMore = posts.length > limit
    const items = posts.slice(0, limit)

    const nextCursor = hasMore && items.length > 0
      ? items[items.length - 1].createdAt.toISOString()
      : null

    return res.json({
      items: items.map((post) => ({
        _id: post._id.toString(),
        userId: post.userId.toString(),
        type: post.type,
        title: post.title,
        description: post.description,
        exerciseId: post.exerciseId.toString(),
        exerciseName: post.exerciseName,
        authorName: post.authorName,
        chartType: post.chartType,
        metric: post.metric,
        dateRange: post.dateRange,
        dateMode: post.dateMode,
        specificDates: post.specificDates,
        graphConfig: post.graphConfig,
        createdAt: post.createdAt,
        likeCount: post.likeCount,
        commentCount: post.commentCount
      })),
      nextCursor
    })
  } catch (error) {
    console.error('Get posts error', error)
    return res.status(500).json({ message: 'Failed to fetch posts' })
  }
})

// GET /posts/:postId - Get single post
app.get('/posts/:postId', async (req, res) => {
  const { postId } = req.params

  if (!ObjectId.isValid(postId)) {
    return res.status(400).json({ message: 'Invalid post ID' })
  }

  try {
    const post = await postsCollection.findOne({ _id: new ObjectId(postId) })

    if (!post) {
      return res.status(404).json({ message: 'Post not found' })
    }

    return res.json({
      _id: post._id.toString(),
      userId: post.userId.toString(),
      type: post.type,
      title: post.title,
      description: post.description,
      exerciseId: post.exerciseId.toString(),
      exerciseName: post.exerciseName,
      authorName: post.authorName,
      chartType: post.chartType,
      metric: post.metric,
      dateRange: post.dateRange,
      dateMode: post.dateMode,
      specificDates: post.specificDates,
      graphConfig: post.graphConfig,
      createdAt: post.createdAt,
      likeCount: post.likeCount,
      commentCount: post.commentCount
    })
  } catch (error) {
    console.error('Get post error', error)
    return res.status(500).json({ message: 'Failed to fetch post' })
  }
})

// DELETE /posts/:postId - Delete own post
app.delete('/posts/:postId', requireUser, async (req, res) => {
  const { postId } = req.params

  if (!ObjectId.isValid(postId)) {
    return res.status(400).json({ message: 'Invalid post ID' })
  }

  try {
    const result = await postsCollection.deleteOne({
      _id: new ObjectId(postId),
      userId: req.userId
    })

    if (result.deletedCount === 0) {
      // Check if post exists but belongs to someone else
      const post = await postsCollection.findOne({ _id: new ObjectId(postId) })
      if (post) {
        return res.status(403).json({ message: 'You can only delete your own posts' })
      }
      return res.status(404).json({ message: 'Post not found' })
    }

    // Also delete likes and comments for this post
    await postLikesCollection.deleteMany({ postId: new ObjectId(postId) })
    await postCommentsCollection.deleteMany({ postId: new ObjectId(postId) })

    return res.status(204).end()
  } catch (error) {
    console.error('Delete post error', error)
    return res.status(500).json({ message: 'Failed to delete post' })
  }
})

// ==================== POST LIKES ====================

// POST /posts/:postId/like - Like a post
app.post('/posts/:postId/like', requireUser, async (req, res) => {
  const { postId } = req.params

  if (!ObjectId.isValid(postId)) {
    return res.status(400).json({ message: 'Invalid post ID' })
  }

  try {
    // Check if post exists
    const post = await postsCollection.findOne({ _id: new ObjectId(postId) })
    if (!post) {
      return res.status(404).json({ message: 'Post not found' })
    }

    // Check if already liked
    const existingLike = await postLikesCollection.findOne({
      postId: new ObjectId(postId),
      userId: req.userId
    })

    if (existingLike) {
      return res.status(400).json({ message: 'Already liked' })
    }

    // Create like
    await postLikesCollection.insertOne({
      postId: new ObjectId(postId),
      userId: req.userId,
      createdAt: new Date()
    })

    // Increment likeCount on post
    await postsCollection.updateOne(
      { _id: new ObjectId(postId) },
      { $inc: { likeCount: 1 } }
    )

    const newCount = (post.likeCount || 0) + 1
    return res.status(201).json({ liked: true, likeCount: newCount })
  } catch (error) {
    console.error('Like post error', error)
    return res.status(500).json({ message: 'Failed to like post' })
  }
})

// DELETE /posts/:postId/like - Unlike a post
app.delete('/posts/:postId/like', requireUser, async (req, res) => {
  const { postId } = req.params

  if (!ObjectId.isValid(postId)) {
    return res.status(400).json({ message: 'Invalid post ID' })
  }

  try {
    const result = await postLikesCollection.deleteOne({
      postId: new ObjectId(postId),
      userId: req.userId
    })

    if (result.deletedCount === 0) {
      return res.status(400).json({ message: 'Not liked yet' })
    }

    // Decrement likeCount on post
    await postsCollection.updateOne(
      { _id: new ObjectId(postId) },
      { $inc: { likeCount: -1 } }
    )

    const post = await postsCollection.findOne({ _id: new ObjectId(postId) })
    const newCount = post?.likeCount || 0

    return res.json({ liked: false, likeCount: newCount })
  } catch (error) {
    console.error('Unlike post error', error)
    return res.status(500).json({ message: 'Failed to unlike post' })
  }
})

// GET /posts/:postId/like - Check if user has liked a post
app.get('/posts/:postId/like', requireUser, async (req, res) => {
  const { postId } = req.params

  if (!ObjectId.isValid(postId)) {
    return res.status(400).json({ message: 'Invalid post ID' })
  }

  try {
    const like = await postLikesCollection.findOne({
      postId: new ObjectId(postId),
      userId: req.userId
    })

    return res.json({ liked: !!like })
  } catch (error) {
    console.error('Check like error', error)
    return res.status(500).json({ message: 'Failed to check like status' })
  }
})

// ==================== POST COMMENTS ====================

// GET /posts/:postId/comments - Get comments for a post
app.get('/posts/:postId/comments', async (req, res) => {
  const { postId } = req.params

  if (!ObjectId.isValid(postId)) {
    return res.status(400).json({ message: 'Invalid post ID' })
  }

  try {
    const comments = await postCommentsCollection
      .find({ postId: new ObjectId(postId) })
      .sort({ createdAt: 1 })
      .toArray()

    return res.json({
      comments: comments.map(c => ({
        _id: c._id.toString(),
        postId: c.postId.toString(),
        userId: c.userId.toString(),
        authorName: c.authorName,
        content: c.content,
        createdAt: c.createdAt
      }))
    })
  } catch (error) {
    console.error('Get comments error', error)
    return res.status(500).json({ message: 'Failed to fetch comments' })
  }
})

// POST /posts/:postId/comments - Add a comment
app.post('/posts/:postId/comments', requireUser, async (req, res) => {
  const { postId } = req.params
  const { content } = req.body

  if (!ObjectId.isValid(postId)) {
    return res.status(400).json({ message: 'Invalid post ID' })
  }

  const trimmedContent = typeof content === 'string' ? content.trim() : ''
  if (!trimmedContent) {
    return res.status(400).json({ message: 'Comment content is required' })
  }

  if (trimmedContent.length > 500) {
    return res.status(400).json({ message: 'Comment must be 500 characters or less' })
  }

  try {
    // Check if post exists
    const post = await postsCollection.findOne({ _id: new ObjectId(postId) })
    if (!post) {
      return res.status(404).json({ message: 'Post not found' })
    }

    // Get user info for author name
    const user = await usersCollection.findOne({ _id: req.userId })
    const authorName = user?.fullName || user?.firstName || 'Okänd'

    const commentDoc = {
      postId: new ObjectId(postId),
      userId: req.userId,
      authorName,
      content: trimmedContent,
      createdAt: new Date()
    }

    const result = await postCommentsCollection.insertOne(commentDoc)

    // Increment commentCount on post
    await postsCollection.updateOne(
      { _id: new ObjectId(postId) },
      { $inc: { commentCount: 1 } }
    )

    return res.status(201).json({
      _id: result.insertedId.toString(),
      postId: commentDoc.postId.toString(),
      userId: commentDoc.userId.toString(),
      authorName: commentDoc.authorName,
      content: commentDoc.content,
      createdAt: commentDoc.createdAt
    })
  } catch (error) {
    console.error('Add comment error', error)
    return res.status(500).json({ message: 'Failed to add comment' })
  }
})

// DELETE /posts/:postId/comments/:commentId - Delete own comment
app.delete('/posts/:postId/comments/:commentId', requireUser, async (req, res) => {
  const { postId, commentId } = req.params

  if (!ObjectId.isValid(postId) || !ObjectId.isValid(commentId)) {
    return res.status(400).json({ message: 'Invalid ID' })
  }

  try {
    const result = await postCommentsCollection.deleteOne({
      _id: new ObjectId(commentId),
      postId: new ObjectId(postId),
      userId: req.userId
    })

    if (result.deletedCount === 0) {
      // Check if comment exists but belongs to someone else
      const comment = await postCommentsCollection.findOne({ _id: new ObjectId(commentId) })
      if (comment) {
        return res.status(403).json({ message: 'You can only delete your own comments' })
      }
      return res.status(404).json({ message: 'Comment not found' })
    }

    // Decrement commentCount on post
    await postsCollection.updateOne(
      { _id: new ObjectId(postId) },
      { $inc: { commentCount: -1 } }
    )

    return res.status(204).end()
  } catch (error) {
    console.error('Delete comment error', error)
    return res.status(500).json({ message: 'Failed to delete comment' })
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
    setsCollection = db.collection('sets')
    postsCollection = db.collection('posts')
    postLikesCollection = db.collection('postLikes')
    postCommentsCollection = db.collection('postComments')
    await usersCollection.createIndex({ email: 1 }, { unique: true })
    await workoutsCollection.createIndex({ userId: 1, createdAt: -1 })
    await workoutsCollection.createIndex({ userId: 1, name: 1 }, { unique: true })
    await exercisesCollection.createIndex({ userId: 1, name: 1 })
    await workoutExercisesCollection.createIndex({ userId: 1, workoutId: 1, order: 1 })
    await workoutExercisesCollection.createIndex(
      { userId: 1, workoutId: 1, exerciseId: 1 },
      { unique: true }
    )
    await setsCollection.createIndex({ userId: 1, exerciseId: 1, date: -1 })
    await setsCollection.createIndex({ userId: 1, groupId: 1 })
    // Posts indexes
    await postsCollection.createIndex({ createdAt: -1 })
    await postsCollection.createIndex({ userId: 1, createdAt: -1 })
    await postsCollection.createIndex({ exerciseId: 1, createdAt: -1 })
    // PostLikes indexes
    await postLikesCollection.createIndex({ postId: 1, userId: 1 }, { unique: true })
    await postLikesCollection.createIndex({ postId: 1 })
    // PostComments indexes
    await postCommentsCollection.createIndex({ postId: 1, createdAt: 1 })
    await postCommentsCollection.createIndex({ userId: 1 })

    app.listen(PORT, () => {
      console.log(`API listening on http://localhost:${PORT}`)
    })
  } catch (error) {
    console.error('Failed to connect to MongoDB', error)
    process.exit(1)
  }
}

start()
