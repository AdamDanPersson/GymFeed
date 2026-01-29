import { collections } from '../db/collections.js'
import { requireUser } from '../middleware/requireUser.js'

/**
 * PUT /users/profile-image - Uppdatera profilbild för inloggad användare
 * Kräver: imageUrl
 */
export function registerUsersRoutes(app) {
  app.put('/users/profile-image', requireUser, async (req, res) => {
    const rawImageUrl = req.body?.imageUrl
    const imageUrl = typeof rawImageUrl === 'string' ? rawImageUrl.trim() : null

    try {
      const result = await collections.usersCollection.findOneAndUpdate(
        { _id: req.userId },
        { $set: { profileImageUrl: imageUrl || null, updatedAt: new Date() } },
        { returnDocument: 'after' }
      )

      if (!result) {
        return res.status(404).json({ message: 'User not found' })
      }

      return res.json({
        profileImageUrl: result.profileImageUrl || null
      })
    } catch (error) {
      console.error('Update profile image error', error)
      return res.status(500).json({ message: 'Failed to update profile image' })
    }
  })
}
