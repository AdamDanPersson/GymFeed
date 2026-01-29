/**
 * Health check endpoint för att verifiera att servern är igång
 * Används av deployment-plattformar för att övervaka serverns status
 */
export function registerHealthRoutes(app) {
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' })
  })
}
