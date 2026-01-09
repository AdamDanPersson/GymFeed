import { memo, useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { getMonthlyVisits } from '../../lib/apiClient'

const MonthlyVisitsChart = memo(function MonthlyVisitsChart({ user }) {
  const [monthlyData, setMonthlyData] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) {
      setMonthlyData([])
      return
    }

    let ignore = false
    setIsLoading(true)
    setError('')

    getMonthlyVisits()
      .then((data) => {
        if (!ignore) {
          setMonthlyData(data)
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err.message)
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoading(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [user])

  const totalVisits = useMemo(() => {
    return monthlyData.reduce((sum, month) => sum + month.visits, 0)
  }, [monthlyData])

  if (!user) {
    return null
  }

  return (
    <div className="monthly-visits-card">
      <div className="monthly-visits-header">
        <h2 className="monthly-visits-title">Gymbesök senaste 12 månaderna</h2>
        <span className="monthly-visits-total">{totalVisits} besök totalt</span>
      </div>
      
      {isLoading ? (
        <p className="monthly-visits-loading">Laddar statistik...</p>
      ) : error ? (
        <p className="monthly-visits-error">{error}</p>
      ) : monthlyData.length > 0 ? (
        <div className="monthly-visits-chart">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis 
                dataKey="label" 
                tick={{ fontSize: 11 }}
                tickLine={false}
              />
              <YAxis 
                allowDecimals={false}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip 
                cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null
                  const data = payload[0]?.payload
                  return (
                    <div className="monthly-visits-tooltip">
                      <p className="monthly-visits-tooltip-label">{data.label}</p>
                      <p className="monthly-visits-tooltip-value">
                        {data.visits} {data.visits === 1 ? 'besök' : 'besök'}
                      </p>
                    </div>
                  )
                }}
              />
              <Bar 
                dataKey="visits" 
                fill="#6366f1" 
                radius={[4, 4, 0, 0]}
                maxBarSize={50}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="monthly-visits-empty">Ingen träningsdata ännu</p>
      )}
    </div>
  )
})

export default MonthlyVisitsChart
