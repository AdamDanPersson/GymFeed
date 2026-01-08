import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { fetchPosts, deletePost, getExerciseSets, getStoredUser, getStoredUserId } from '../lib/apiClient'
import './Flow.css'

// Metric labels for display
const METRIC_LABELS = {
  maxWeight: 'Max vikt',
  totalVolume: 'Total volym',
  e1rm: 'Estimerat 1RM',
  setCount: 'Antal set',
  allSets: 'Alla set'
}

// Calculate chart data from sets based on metric
function calculateChartData(groups, metric, dateRange, dateMode, specificDates) {
  if (!groups || groups.length === 0) return []

  let filteredGroups

  if (dateMode === 'twoDays' && specificDates && specificDates.length === 2) {
    // Filter to only include the two specific dates
    filteredGroups = groups.filter(group => {
      const groupDateStr = new Date(group.date).toISOString().split('T')[0]
      return specificDates.includes(groupDateStr)
    })
  } else {
    // Filter by date range - use date strings for comparison
    const fromDateStr = dateRange.from.split('T')[0]
    const toDateStr = dateRange.to.split('T')[0]
    
    filteredGroups = groups.filter(group => {
      const groupDateStr = new Date(group.date).toISOString().split('T')[0]
      return groupDateStr >= fromDateStr && groupDateStr <= toDateStr
    })
  }

  // Sort by date ascending
  const sortedGroups = [...filteredGroups].sort((a, b) => 
    new Date(a.date) - new Date(b.date)
  )

  switch (metric) {
    case 'maxWeight':
      return sortedGroups.map((group) => {
        const maxWeight = Math.max(...group.sets.map(s => parseFloat(s.weight) || 0))
        const date = new Date(group.date).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })
        return { date, value: maxWeight }
      })

    case 'totalVolume':
      return sortedGroups.map((group) => {
        const volume = group.sets.reduce((sum, set) => {
          const w = parseFloat(set.weight) || 0
          const r = parseInt(set.reps) || 0
          return sum + (w * r)
        }, 0)
        const date = new Date(group.date).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })
        return { date, value: Math.round(volume) }
      })

    case 'e1rm':
      return sortedGroups.map((group) => {
        // Epley formula: weight × (1 + reps/30)
        const e1rmValues = group.sets.map(s => {
          const w = parseFloat(s.weight) || 0
          const r = parseInt(s.reps) || 0
          if (w === 0 || r === 0) return 0
          return w * (1 + r / 30)
        })
        const maxE1rm = Math.max(...e1rmValues)
        const date = new Date(group.date).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })
        return { date, value: Math.round(maxE1rm * 10) / 10 }
      })

    case 'setCount':
      return sortedGroups.map((group) => {
        const date = new Date(group.date).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })
        return { date, value: group.sets.length }
      })

    default:
      return []
  }
}

// Graph Post Card Component
function GraphPostCard({ post, currentUserId, onDelete }) {
  const [chartData, setChartData] = useState([])
  const [isLoadingChart, setIsLoadingChart] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)

  const isOwner = currentUserId && post.userId === currentUserId

  // Fetch exercise data for chart
  useEffect(() => {
    if (!post.exerciseId) return

    let ignore = false
    setIsLoadingChart(true)

    getExerciseSets(post.exerciseId)
      .then((data) => {
        if (!ignore && data.groups) {
          const computed = calculateChartData(data.groups, post.metric, post.dateRange, post.dateMode, post.specificDates)
          setChartData(computed)
        }
      })
      .catch((err) => {
        console.error('Failed to fetch chart data:', err)
      })
      .finally(() => {
        if (!ignore) {
          setIsLoadingChart(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [post.exerciseId, post.metric, post.dateRange])

  const handleDelete = useCallback(async () => {
    if (!confirm('Är du säker på att du vill ta bort denna post?')) return

    setIsDeleting(true)
    try {
      await deletePost(post._id)
      onDelete(post._id)
    } catch (err) {
      console.error('Failed to delete post:', err)
      alert('Kunde inte ta bort posten: ' + err.message)
    } finally {
      setIsDeleting(false)
    }
  }, [post._id, onDelete])

  const formattedDate = useMemo(() => {
    const date = new Date(post.createdAt)
    return date.toLocaleDateString('sv-SE', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }, [post.createdAt])

  return (
    <article className="feed-card">
      <header className="feed-card__header">
        <div className="avatar-block">
          <span className="avatar-block__initial">
            {post.authorName?.charAt(0).toUpperCase() || '?'}
          </span>
        </div>
        <div className="meta-block">
          <span className="meta-line meta-line--bold">{post.authorName}</span>
          <span className="meta-line meta-line--light">{formattedDate}</span>
        </div>
        <span className="tag-chip">{METRIC_LABELS[post.metric] || post.metric}</span>
      </header>

      <div className="feed-card__title">
        <h3>{post.title}</h3>
        <span className="feed-card__exercise">{post.exerciseName}</span>
      </div>

      <div className="feed-card__body">
        {isLoadingChart ? (
          <div className="feed-card__loading">Laddar graf...</div>
        ) : chartData.length === 0 ? (
          <div className="feed-card__empty">Ingen data för valt intervall</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {post.chartType === 'bar' ? (
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#1b150f" />
                <YAxis tick={{ fontSize: 11 }} stroke="#1b150f" />
                <Tooltip 
                  contentStyle={{ 
                    background: '#faf3e1', 
                    border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: '8px'
                  }} 
                />
                <Bar dataKey="value" fill="#ff6d1f" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#1b150f" />
                <YAxis tick={{ fontSize: 11 }} stroke="#1b150f" />
                <Tooltip 
                  contentStyle={{ 
                    background: '#faf3e1', 
                    border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: '8px'
                  }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#ff6d1f" 
                  strokeWidth={2} 
                  dot={{ r: 4, fill: '#ff6d1f' }} 
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      {post.description && (
        <p className="feed-card__description">{post.description}</p>
      )}

      <div className="feed-card__footer">
        <div className="footer-stats">
          <span className="footer-stat">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            {post.likeCount}
          </span>
          <span className="footer-stat">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            {post.commentCount}
          </span>
        </div>

        {isOwner && (
          <button
            type="button"
            className="feed-card__delete"
            onClick={handleDelete}
            disabled={isDeleting}
            aria-label="Ta bort post"
          >
            {isDeleting ? 'Tar bort...' : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            )}
          </button>
        )}
      </div>
    </article>
  )
}

function FlowPage() {
  const [posts, setPosts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState(null)
  const [error, setError] = useState('')
  const loadMoreRef = useRef(null)

  const currentUserId = useMemo(() => getStoredUserId(), [])

  // Initial load
  useEffect(() => {
    let ignore = false
    setIsLoading(true)
    setError('')

    fetchPosts({ limit: 5 })
      .then((data) => {
        if (!ignore) {
          setPosts(data.items || [])
          setNextCursor(data.nextCursor)
        }
      })
      .catch((err) => {
        console.error('Failed to fetch posts:', err)
        if (!ignore) {
          setError('Kunde inte ladda inlägg')
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
  }, [])

  // Load more posts
  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return

    setIsLoadingMore(true)

    try {
      const data = await fetchPosts({ limit: 5, cursor: nextCursor })
      setPosts(prev => [...prev, ...(data.items || [])])
      setNextCursor(data.nextCursor)
    } catch (err) {
      console.error('Failed to load more posts:', err)
    } finally {
      setIsLoadingMore(false)
    }
  }, [nextCursor, isLoadingMore])

  // Infinite scroll with Intersection Observer
  useEffect(() => {
    if (!loadMoreRef.current || !nextCursor) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(loadMoreRef.current)

    return () => observer.disconnect()
  }, [nextCursor, loadMore])

  const handleDeletePost = useCallback((postId) => {
    setPosts(prev => prev.filter(p => p._id !== postId))
  }, [])

  return (
    <main className="flow-page" aria-labelledby="flow-heading">
      <div className="flow-feed">
        {isLoading ? (
          <div className="flow-feed__loading">Laddar inlägg...</div>
        ) : error ? (
          <div className="flow-feed__error">{error}</div>
        ) : posts.length === 0 ? (
          <div className="flow-feed__empty">
            <p>Inga inlägg än. Var först med att dela din progression!</p>
          </div>
        ) : (
          <>
            {posts.map((post) => (
              <GraphPostCard 
                key={post._id} 
                post={post} 
                currentUserId={currentUserId}
                onDelete={handleDeletePost}
              />
            ))}
            
            {/* Load more trigger */}
            {nextCursor && (
              <div ref={loadMoreRef} className="flow-feed__load-more">
                {isLoadingMore && <span>Laddar fler...</span>}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}

export default FlowPage
