import { collections } from '../db/collections.js'

/**
 * POST /auth/register - Registrera ny användare
 * Kräver: email, password (minst 8 tecken), firstName, lastName
 */
export function registerAuthRoutes(app) {
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
      profileImageUrl: null,
      createdAt: new Date()
    }

    try {
      const result = await collections.usersCollection.insertOne(userDoc)
      return res.status(201).json({
        userId: result.insertedId.toString(),
        email: normalizedEmail,
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        name: fullName,
        profileImageUrl: null
      })
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ message: 'Email already exists' })
      }
      console.error('Register error', error)
      return res.status(500).json({ message: 'Failed to register user' })
    }
  })

  /**
   * POST /auth/login - Logga in användare
   * Kräver: email, password
   * Returnerar: userId, email, namn
   */
  app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' })
    }

    const normalizedEmail = email.trim().toLowerCase()

    try {
      const user = await collections.usersCollection.findOne({ email: normalizedEmail })
      if (!user || user.password !== password) {
        return res.status(401).json({ message: 'Invalid credentials' })
      }

      const responseFullName = user.fullName || user.name || null

      return res.json({
        userId: user._id.toString(),
        email: user.email,
        firstName: user.firstName || null,
        lastName: user.lastName || null,
        name: responseFullName,
        profileImageUrl: user.profileImageUrl || null
      })
    } catch (error) {
      console.error('Login error', error)
      return res.status(500).json({ message: 'Failed to login' })
    }
  })
}
