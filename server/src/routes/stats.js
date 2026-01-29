import { collections } from '../db/collections.js'
import { requireUser } from '../middleware/requireUser.js'

export function registerStatsRoutes(app) {
  /**
   * GET /stats/monthly-visits - Hämta gymbesöksstatistik
   * Returnerar antal unika dagar med loggade set per månad (senaste 12 månaderna)
   * Används för att visa användarens träningsfrekvens i statistikvyn
   */
  app.get('/stats/monthly-visits', requireUser, async (req, res) => {
    try {
      // Beräkna datumintervall: 12 månader bakåt från nu
      const now = new Date()
      const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1) // Start of month 12 months ago
      
      // Get all sets within date range
      const sets = await collections.setsCollection
        .find({ 
          userId: req.userId,
          date: { $gte: twelveMonthsAgo }
        })
        .toArray()
      
      // Group by month and count unique dates (days with logged exercises)
      const monthlyVisits = {}
      const seenDates = new Set()
      
      for (const set of sets) {
        const date = new Date(set.date)
        // Create unique key for this day (YYYY-MM-DD)
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        
        // Only count each day once
        if (seenDates.has(dateKey)) continue
        seenDates.add(dateKey)
        
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
}
