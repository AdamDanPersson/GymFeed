import { ObjectId } from 'mongodb'
import { collections } from '../db/collections.js'
import { requireUser } from '../middleware/requireUser.js'

export function registerWorkoutRoutes(app) {
  /**
   * GET /workouts - Hämta alla träningspass för inloggad användare
   * Sorterade efter ordning, sedan skapelsedatum
   */
  app.get('/workouts', requireUser, async (req, res) => {
    try {
      const docs = await collections.workoutsCollection
        .find({ userId: req.userId })
        .sort({ order: 1, createdAt: -1 })
        .toArray()

      return res.json(docs.map(serializeWorkout))
    } catch (error) {
      console.error('Get workouts error', error)
      return res.status(500).json({ message: 'Failed to fetch workouts' })
    }
  })

  /**
   * POST /workouts - Skapa nytt träningspass
   * Kräver: name (namn på passet)
   */
  app.post('/workouts', requireUser, async (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''

    if (!name) {
      return res.status(400).json({ message: 'Workout name is required' })
    }

    try {
      // Get the highest order value for this user
      const lastWorkout = await collections.workoutsCollection
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

      const result = await collections.workoutsCollection.insertOne(doc)
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
      const result = await collections.workoutsCollection.deleteOne({
        _id: workoutObjectId,
        userId: req.userId
      })

      if (result.deletedCount === 0) {
        return res.status(404).json({ message: 'Workout not found' })
      }

      // Find all exercise links for this workout to get exerciseIds
      const links = await collections.workoutExercisesCollection.find({
        userId: req.userId,
        workoutId: workoutObjectId
      }).toArray()

      const exerciseIds = links.map(link => link.exerciseId).filter(Boolean)

      // Delete all exercise links for this workout
      await collections.workoutExercisesCollection.deleteMany({ userId: req.userId, workoutId: workoutObjectId })

      // Only delete exercises that are not used in any other workout
      if (exerciseIds.length > 0) {
        for (const exerciseId of exerciseIds) {
          const otherLinks = await collections.workoutExercisesCollection.countDocuments({
            userId: req.userId,
            exerciseId: exerciseId
          })

          if (otherLinks === 0) {
            await collections.exercisesCollection.deleteOne({
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
      const result = await collections.workoutsCollection.findOneAndUpdate(
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
      const originalWorkout = await collections.workoutsCollection.findOne({
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

      const insertResult = await collections.workoutsCollection.insertOne(newWorkout)
      const newWorkoutId = insertResult.insertedId

      // Get all exercise links from the original workout
      const originalLinks = await collections.workoutExercisesCollection
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

        await collections.workoutExercisesCollection.insertMany(newLinks)
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

  // ==================== ÖVNINGAR I TRÄNINGSPASS ====================

  /**
   * GET /workouts/:workoutId/exercises - Hämta alla övningar i ett pass
   */
  app.get('/workouts/:workoutId/exercises', requireUser, async (req, res) => {
    try {
      const workoutObjectId = await assertWorkoutOwner(req.params.workoutId, req.userId)

      const links = await collections.workoutExercisesCollection
        .find({ userId: req.userId, workoutId: workoutObjectId })
        .sort({ order: 1, createdAt: 1 })
        .toArray()

      const exerciseIds = links.map((link) => link.exerciseId)
      const exercises = await collections.exercisesCollection
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
        exerciseDoc = await collections.exercisesCollection.findOne({ _id: new ObjectId(exerciseId), userId: req.userId })
        if (!exerciseDoc) {
          return res.status(404).json({ message: 'Exercise not found' })
        }
      } else {
        exerciseDoc = await collections.exercisesCollection.findOne({ userId: req.userId, name })
        if (!exerciseDoc) {
          const now = new Date()
          const newExercise = {
            userId: req.userId,
            name,
            createdAt: now
          }
          const result = await collections.exercisesCollection.insertOne(newExercise)
          exerciseDoc = { ...newExercise, _id: result.insertedId }
        }
      }

      const lastLink = await collections.workoutExercisesCollection
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
        const linkResult = await collections.workoutExercisesCollection.insertOne(linkDoc)
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

      const count = await collections.workoutExercisesCollection.countDocuments({
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

      await collections.workoutExercisesCollection.bulkWrite(bulkOps)
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

      const link = await collections.workoutExercisesCollection.findOne({
        _id: new ObjectId(linkId),
        userId: req.userId,
        workoutId: workoutObjectId
      })

      if (!link) {
        return res.status(404).json({ message: 'Exercise link not found' })
      }

      const exerciseId = link.exerciseId

      const result = await collections.workoutExercisesCollection.deleteOne({
        _id: new ObjectId(linkId),
        userId: req.userId,
        workoutId: workoutObjectId
      })

      if (result.deletedCount === 0) {
        return res.status(404).json({ message: 'Exercise link not found' })
      }

      // Only delete the exercise if it's not used in any other workout
      const otherLinks = await collections.workoutExercisesCollection.countDocuments({
        userId: req.userId,
        exerciseId: exerciseId
      })

      if (otherLinks === 0) {
        await collections.exercisesCollection.deleteOne({
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

      const link = await collections.workoutExercisesCollection.findOne({
        _id: new ObjectId(linkId),
        userId: req.userId,
        workoutId: workoutObjectId
      })

      if (!link) {
        return res.status(404).json({ message: 'Exercise link not found' })
      }

      const exerciseObjectId = link.exerciseId

      await collections.exercisesCollection.updateOne(
        { _id: exerciseObjectId, userId: req.userId },
        { $set: { name, updatedAt: new Date() } }
      )

      const exerciseDoc = await collections.exercisesCollection.findOne({ _id: exerciseObjectId, userId: req.userId })
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

      const originalLink = await collections.workoutExercisesCollection.findOne({
        _id: new ObjectId(linkId),
        userId: req.userId,
        workoutId: workoutObjectId
      })

      if (!originalLink) {
        return res.status(404).json({ message: 'Exercise link not found' })
      }

      const originalExercise = await collections.exercisesCollection.findOne({
        _id: originalLink.exerciseId,
        userId: req.userId
      })

      if (!originalExercise) {
        return res.status(404).json({ message: 'Exercise not found' })
      }

      const copyName = `${originalExercise.name} (kopia)`

      let exerciseDoc = await collections.exercisesCollection.findOne({ userId: req.userId, name: copyName })
      if (!exerciseDoc) {
        const now = new Date()
        const newExercise = {
          userId: req.userId,
          name: copyName,
          createdAt: now
        }
        const result = await collections.exercisesCollection.insertOne(newExercise)
        exerciseDoc = { ...newExercise, _id: result.insertedId }
      }

      const lastLink = await collections.workoutExercisesCollection
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
        const linkResult = await collections.workoutExercisesCollection.insertOne(linkDoc)
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

      const link = await collections.workoutExercisesCollection.findOne({
        _id: new ObjectId(linkId),
        userId: req.userId,
        workoutId: sourceWorkoutId
      })

      if (!link) {
        return res.status(404).json({ message: 'Exercise link not found' })
      }

      const exerciseId = link.exerciseId

      const existingLink = await collections.workoutExercisesCollection.findOne({
        userId: req.userId,
        workoutId: targetWorkoutObjectId,
        exerciseId: exerciseId
      })

      if (existingLink) {
        return res.status(409).json({ message: 'Exercise already exists in target workout' })
      }

      await collections.workoutExercisesCollection.deleteOne({
        _id: new ObjectId(linkId),
        userId: req.userId,
        workoutId: sourceWorkoutId
      })

      const lastLink = await collections.workoutExercisesCollection
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

      const linkResult = await collections.workoutExercisesCollection.insertOne(newLinkDoc)
      const exerciseDoc = await collections.exercisesCollection.findOne({ _id: exerciseId, userId: req.userId })

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
      const count = await collections.workoutsCollection.countDocuments({
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

      await collections.workoutsCollection.bulkWrite(bulkOps)

      // Return updated workouts
      const updatedWorkouts = await collections.workoutsCollection
        .find({ userId: req.userId })
        .sort({ order: 1, createdAt: -1 })
        .toArray()

      return res.json(updatedWorkouts.map(serializeWorkout))
    } catch (error) {
      console.error('Reorder workouts error', error)
      return res.status(500).json({ message: 'Failed to reorder workouts' })
    }
  })
}

// ==================== HJÄLPFUNKTIONER ====================

/**
 * Verifierar att ett träningspass tillhör användaren
 * @param {string} workoutId - ID för träningspasset
 * @param {ObjectId} userId - Användarens ID
 * @returns {ObjectId} ObjectId för träningspasset
 * @throws {Error} Om passet inte finns eller inte tillhör användaren
 */
async function assertWorkoutOwner(workoutId, userId) {
  if (!ObjectId.isValid(workoutId)) {
    const error = new Error('Invalid workout id')
    error.status = 400
    throw error
  }

  const workoutObjectId = new ObjectId(workoutId)
  const workout = await collections.workoutsCollection.findOne({ _id: workoutObjectId, userId })
  if (!workout) {
    const error = new Error('Workout not found')
    error.status = 404
    throw error
  }

  return workoutObjectId
}

/**
 * Formaterar en övningslänk till ett responsobjekt
 * @param {Object} linkDoc - Länkdokumentet från databasen
 * @param {Object} exerciseDoc - Övningsdokumentet
 * @returns {Object} Formaterat responsobjekt
 */
function toLinkResponse(linkDoc, exerciseDoc) {
  return {
    linkId: linkDoc._id.toString(),
    exerciseId: linkDoc.exerciseId.toString(),
    name: exerciseDoc?.name ?? null,
    order: linkDoc.order ?? 0
  }
}

/**
 * Formaterar ett träningspass-dokument till ett responsobjekt
 * @param {Object} doc - Dokument från databasen
 * @returns {Object} Formaterat objekt för API-respons
 */
function serializeWorkout(doc) {
  return {
    _id: doc._id.toString(),
    name: doc.name,
    order: doc.order ?? 0,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt || doc.createdAt
  }
}
