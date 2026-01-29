import { ObjectId } from 'mongodb'

/**
 * Middleware för att verifiera att användaren är inloggad
 * Kontrollerar x-user-id header och sätter req.userId
 */
export function requireUser(req, res, next) {
  const userIdHeader = req.header('x-user-id')?.trim()

  if (!userIdHeader || !ObjectId.isValid(userIdHeader)) {
    return res.status(401).json({ message: 'User authentication required' })
  }

  req.userId = new ObjectId(userIdHeader)
  next()
}
