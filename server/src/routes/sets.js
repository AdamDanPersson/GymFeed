import { ObjectId } from 'mongodb'
import { collections } from '../db/collections.js'
import { requireUser } from '../middleware/requireUser.js'

export function registerSetRoutes(app) {
  /**
   * POST /exercises/:exerciseId/sets/bulk - Spara flera set på en gång
   * Används när användaren sparar ett träningspass med alla set
   * Kräver: sets[] med weight, reps, isDropSet för varje set
   */
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
      const exercise = await collections.exercisesCollection.findOne({ _id: exerciseObjectId, userId: req.userId })
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

      const result = await collections.setsCollection.insertMany(setDocs)

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
      const exercise = await collections.exercisesCollection.findOne({ _id: exerciseObjectId, userId: req.userId })
      if (!exercise) {
        return res.status(404).json({ message: 'Exercise not found' })
      }

      // Get all sets for this exercise
      const sets = await collections.setsCollection
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
      const result = await collections.setsCollection.findOneAndUpdate(
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
      const result = await collections.setsCollection.deleteOne({
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
}
