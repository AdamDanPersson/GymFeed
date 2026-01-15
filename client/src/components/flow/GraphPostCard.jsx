import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import {
  deletePost,
  likePost,
  unlikePost,
  checkPostLike,
  fetchComments,
  addComment,
  deleteComment,
  fetchPostChartData
} from '../../lib/apiClient'
import './GraphPostCard.css'

const METRIC_LABELS = {
  maxWeight: 'Max vikt',
  totalVolume: 'Total volym',
  e1rm: 'Estimerat 1RM',
  setCount: 'Antal set',
  totalReps: 'Totala reps',
  allSets: 'Alla set'
}

function calculateChartData(groups, metric, dateRange, dateMode, specificDates) {
  if (!groups || groups.length === 0) return []

  let filteredGroups

  if (dateMode === 'twoDays' && specificDates && specificDates.length === 2) {
    filteredGroups = groups.filter(group => {
      const groupDateStr = new Date(group.date).toISOString().split('T')[0]
      return specificDates.includes(groupDateStr)
    })
  } else {
    const fromDateStr = dateRange.from.split('T')[0]
    const toDateStr = dateRange.to.split('T')[0]

    filteredGroups = groups.filter(group => {
      const groupDateStr = new Date(group.date).toISOString().split('T')[0]
      return groupDateStr >= fromDateStr && groupDateStr <= toDateStr
    })
  }

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

    case 'totalReps':
      return sortedGroups.map((group) => {
        const totalReps = group.sets.reduce((sum, set) => sum + (parseInt(set.reps) || 0), 0)
        const date = new Date(group.date).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })
        return { date, value: totalReps }
      })

    default:
      return []
  }
}

function GraphPostCard({ post, currentUserId, onDelete, onUpdatePost }) {
  const [chartData, setChartData] = useState([])
  const [isLoadingChart, setIsLoadingChart] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)

  const [isLiked, setIsLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(post.likeCount || 0)
  const [isLiking, setIsLiking] = useState(false)

  const [comments, setComments] = useState([])
  const [showComments, setShowComments] = useState(false)
  const [isLoadingComments, setIsLoadingComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [commentCount, setCommentCount] = useState(post.commentCount || 0)

  const isOwner = currentUserId && post.userId === currentUserId
  const isLoggedIn = !!currentUserId

  useEffect(() => {
    if (!isLoggedIn) return

    checkPostLike(post._id)
      .then((data) => setIsLiked(data.liked))
      .catch(() => {})
  }, [post._id, isLoggedIn])

  useEffect(() => {
    if (!post._id || post.type === 'image') return

    let ignore = false
    setIsLoadingChart(true)

    fetchPostChartData(post._id)
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
  }, [post._id, post.type, post.metric, post.dateRange, post.dateMode, post.specificDates])

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

  const handleLike = useCallback(async () => {
    if (!isLoggedIn || isLiking) return

    setIsLiking(true)
    try {
      if (isLiked) {
        const result = await unlikePost(post._id)
        setIsLiked(false)
        setLikeCount(result.likeCount)
      } else {
        const result = await likePost(post._id)
        setIsLiked(true)
        setLikeCount(result.likeCount)
      }
    } catch (err) {
      console.error('Failed to toggle like:', err)
    } finally {
      setIsLiking(false)
    }
  }, [post._id, isLiked, isLiking, isLoggedIn])

  const handleToggleComments = useCallback(async () => {
    if (!showComments) {
      setShowComments(true)
      setIsLoadingComments(true)
      try {
        const data = await fetchComments(post._id)
        setComments(data.comments || [])
      } catch (err) {
        console.error('Failed to fetch comments:', err)
      } finally {
        setIsLoadingComments(false)
      }
    } else {
      setShowComments(false)
    }
  }, [post._id, showComments])

  const handleSubmitComment = useCallback(async (e) => {
    e.preventDefault()
    if (!commentText.trim() || isSubmittingComment || !isLoggedIn) return

    setIsSubmittingComment(true)
    try {
      const newComment = await addComment(post._id, commentText.trim())
      setComments(prev => [...prev, newComment])
      setCommentCount(prev => prev + 1)
      setCommentText('')
    } catch (err) {
      console.error('Failed to add comment:', err)
      alert('Kunde inte lägga till kommentar: ' + err.message)
    } finally {
      setIsSubmittingComment(false)
    }
  }, [post._id, commentText, isSubmittingComment, isLoggedIn])

  const handleDeleteComment = useCallback(async (commentId) => {
    try {
      await deleteComment(post._id, commentId)
      setComments(prev => prev.filter(c => c._id !== commentId))
      setCommentCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Failed to delete comment:', err)
      alert('Kunde inte ta bort kommentar: ' + err.message)
    }
  }, [post._id])

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
        {post.type !== 'image' && (
          <span className="tag-chip">{METRIC_LABELS[post.metric] || post.metric}</span>
        )}
      </header>

      <div className="feed-card__title">
        <h3>{post.title}</h3>
        {post.type !== 'image' && (
          <span className="feed-card__exercise">{post.exerciseName}</span>
        )}
      </div>

      <div className={`feed-card__body ${post.type === 'image' ? 'feed-card__body--image' : ''}`}>
        {post.type === 'image' ? (
          <img
            src={post.imageUrl}
            alt={post.title}
            className="feed-card__image"
          />
        ) : isLoadingChart ? (
          <div className="feed-card__loading">Laddar graf...</div>
        ) : chartData.length === 0 ? (
          <div className="feed-card__empty">Ingen data för valt intervall</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={180}>
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
                  strokeWidth={3}
                  dot={{ fill: '#ff6d1f', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
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
        <div className="footer-actions">
          <button
            type="button"
            className={`footer-action ${isLiked ? 'footer-action--liked' : ''}`}
            onClick={handleLike}
            disabled={!isLoggedIn || isLiking}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {likeCount}
          </button>
          <button
            type="button"
            className={`footer-action ${showComments ? 'footer-action--active' : ''}`}
            onClick={handleToggleComments}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {commentCount}
          </button>
        </div>
        <div className="footer-stats">
          <span className="footer-stat">
            {post.type === 'image' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3l2-2h8l2 2h3a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
            ) : post.chartType === 'bar' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="6" y1="20" x2="6" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="18" y1="20" x2="18" y2="14" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
            )}
            {post.type === 'image' ? 'Bild' : post.chartType === 'bar' ? 'Stapeldiagram' : 'Linjediagram'}
          </span>
          {isOwner && (
            <button
              type="button"
              className="feed-card__delete"
              onClick={handleDelete}
              disabled={isDeleting}
              aria-label="Ta bort post"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {showComments && (
        <div className="feed-card__comments">
          {isLoadingComments ? (
            <div className="comments__loading">Laddar kommentarer...</div>
          ) : comments.length === 0 ? (
            <div className="comments__empty">Inga kommentarer ännu</div>
          ) : (
            <ul className="comments__list">
              {comments.map((comment) => (
                <li key={comment._id} className="comment">
                  <div className="comment__header">
                    <span className="comment__author">{comment.authorName}</span>
                    <span className="comment__date">
                      {new Date(comment.createdAt).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })}
                    </span>
                    {currentUserId === comment.userId && (
                      <button
                        type="button"
                        className="comment__delete"
                        onClick={() => handleDeleteComment(comment._id)}
                        aria-label="Ta bort kommentar"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <p className="comment__content">{comment.content ?? comment.text}</p>
                </li>
              ))}
            </ul>
          )}

          {isLoggedIn && (
            <form className="comments__form" onSubmit={handleSubmitComment}>
              <input
                type="text"
                className="comments__input"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Skriv en kommentar..."
                maxLength={500}
              />
              <button
                type="submit"
                className="comments__submit"
                disabled={!commentText.trim() || isSubmittingComment}
              >
                {isSubmittingComment ? '...' : 'Skicka'}
              </button>
            </form>
          )}
        </div>
      )}
    </article>
  )
}

export default GraphPostCard
export { METRIC_LABELS }
