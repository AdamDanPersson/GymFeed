/**
 * Flow-sidan (Socialt Flöde)
 * 
 * Visar alla användares poster i ett scrollbart flöde.
 * Funktioner inkluderar:
 * - Visa poster med grafer eller bilder
 * - Gilla och kommentera poster
 * - Polling för nya poster (realtidsuppdatering)
 * - Oändlig scroll med cursor-baserad paginering
 * 
 * Polling-logik:
 * - Var 10:e sekund kontrolleras om det finns nya poster
 * - Användaren ser en knapp för att ladda nya poster
 * - Detta undviker att flödet plötsligt ändras under läsning
 */

// ==================== IMPORTS ====================
// React hooks
import { useCallback, useEffect, useMemo, useState, useRef } from 'react'

// Diagram-komponenter för att visa statistik
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

// API-funktioner för datahantering
import { 
  fetchPosts, 
  fetchNewPosts, 
  deletePost, 
  getStoredUser, 
  getStoredUserId, 
  likePost, 
  unlikePost, 
  checkPostLike, 
  fetchComments, 
  addComment, 
  deleteComment, 
  fetchPostChartData 
} from '../lib/apiClient'

import './Flow.css'

// ==================== KONSTANTER ====================

// ==================== KONSTANTER ====================

/**
 * Svenska etiketter för olika mätvärden i grafer
 * Används för att visa användarvänliga namn i UI
 */
const METRIC_LABELS = {
  maxWeight: 'Max vikt',
  totalVolume: 'Total volym',
  e1rm: 'Estimerat 1RM',
  setCount: 'Antal set',
  totalReps: 'Totala reps',
  allSets: 'Alla set'
}

// ==================== HJÄLPFUNKTIONER ====================

/**
 * Beräknar diagramdata från set-grupper baserat på valt mätvärde
 * 
 * Funktionen tar rådata från API:et och transformerar det till
 * ett format som Recharts kan rendera. Stödjer olika mätvärden:
 * - maxWeight: Högsta vikten per träningstillfälle
 * - totalVolume: Total volym (vikt × reps) per tillfälle
 * - e1rm: Estimerat 1 rep max med Epley-formeln
 * - setCount: Antal set per tillfälle
 * 
 * @param {Array} groups - Grupper av set från API
 * @param {string} metric - Vilket mätvärde som ska visas
 * @param {Object} dateRange - Datumintervall med from/to
 * @param {string} dateMode - 'range' eller 'twoDays'
 * @param {Array} specificDates - Specifika datum vid 'twoDays'-läge
 * @returns {Array} Formaterad data för Recharts
 */
function calculateChartData(groups, metric, dateRange, dateMode, specificDates) {
  if (!groups || groups.length === 0) return []

  let filteredGroups

  // Filtrera grupper baserat på datumläge
  if (dateMode === 'twoDays' && specificDates && specificDates.length === 2) {
    // Två-dagars jämförelse: filtrera till exakt dessa två datum
    filteredGroups = groups.filter(group => {
      const groupDateStr = new Date(group.date).toISOString().split('T')[0]
      return specificDates.includes(groupDateStr)
    })
  } else {
    // Intervall-läge: filtrera inom datumspånnet
    const fromDateStr = dateRange.from.split('T')[0]
    const toDateStr = dateRange.to.split('T')[0]
    
    filteredGroups = groups.filter(group => {
      const groupDateStr = new Date(group.date).toISOString().split('T')[0]
      return groupDateStr >= fromDateStr && groupDateStr <= toDateStr
    })
  }

  // Sortera kronologiskt för korrekt grafordning
  const sortedGroups = [...filteredGroups].sort((a, b) => 
    new Date(a.date) - new Date(b.date)
  )

  // Transformera data baserat på valt mätvärde
  switch (metric) {
    case 'maxWeight':
      // Högsta vikt: hitta max bland alla set
      return sortedGroups.map((group) => {
        const maxWeight = Math.max(...group.sets.map(s => parseFloat(s.weight) || 0))
        const date = new Date(group.date).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })
        return { date, value: maxWeight }
      })

    case 'totalVolume':
      // Total volym: summa av (vikt × reps) för alla set
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
      // Estimerat 1RM med Epley-formeln: vikt × (1 + reps/30)
      return sortedGroups.map((group) => {
        const e1rmValues = group.sets.map(s => {
          const w = parseFloat(s.weight) || 0
          const r = parseInt(s.reps) || 0
          if (w === 0 || r === 0) return 0
          return w * (1 + r / 30) // Epley-formeln
        })
        const maxE1rm = Math.max(...e1rmValues)
        const date = new Date(group.date).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })
        return { date, value: Math.round(maxE1rm * 10) / 10 }
      })

    case 'setCount':
      // Antal set: räkna antalet set per tillfälle
      return sortedGroups.map((group) => {
        const date = new Date(group.date).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })
        return { date, value: group.sets.length }
      })

    case 'totalReps':
      // Totala reps: summa av alla reps per tillfälle
      return sortedGroups.map((group) => {
        const totalReps = group.sets.reduce((sum, set) => sum + (parseInt(set.reps) || 0), 0)
        const date = new Date(group.date).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })
        return { date, value: totalReps }
      })

    default:
      return []
  }
}

// ==================== KOMPONENTER ====================

/**
 * GraphPostCard - Visar en enskild post i flödet
 * 
 * Hanterar både graf-poster (med diagram) och bild-poster.
 * Inkluderar funktionalitet för:
 * - Visa/dölj kommentarer
 * - Gilla/avgilla
 * - Ta bort (endast ägarens poster)
 * 
 * @param {Object} post - Posten som ska visas
 * @param {string} currentUserId - Inloggad användares ID
 * @param {Function} onDelete - Callback när post tas bort
 * @param {Function} onUpdatePost - Callback för att uppdatera post
 */
function GraphPostCard({ post, currentUserId, onDelete, onUpdatePost }) {
  // ===== DIAGRAM-STATE =====
  const [chartData, setChartData] = useState([])
  const [isLoadingChart, setIsLoadingChart] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // ===== GILLA-STATE =====
  const [isLiked, setIsLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(post.likeCount || 0)
  const [isLiking, setIsLiking] = useState(false)
  
  // ===== KOMMENTAR-STATE =====
  const [comments, setComments] = useState([])
  const [showComments, setShowComments] = useState(false)
  const [isLoadingComments, setIsLoadingComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [commentCount, setCommentCount] = useState(post.commentCount || 0)

  // ===== BERÄKNADE VÄRDEN =====
  const isOwner = currentUserId && post.userId === currentUserId
  const isLoggedIn = !!currentUserId

  // Check if user has liked this post
  useEffect(() => {
    if (!isLoggedIn) return
    
    checkPostLike(post._id)
      .then((data) => setIsLiked(data.liked))
      .catch(() => {}) // Silently fail
  }, [post._id, isLoggedIn])

  // Fetch chart data for post (uses public endpoint) - only for graph posts
  useEffect(() => {
    // Skip fetching chart data for image posts
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

  // Handle like/unlike
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

  // Toggle comments section
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

  // Submit comment
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

  // Delete comment
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
        <div className="footer-actions">
          <button
            type="button"
            className={`footer-action ${isLiked ? 'footer-action--liked' : ''}`}
            onClick={handleLike}
            disabled={!isLoggedIn || isLiking}
            aria-label={isLiked ? 'Ta bort gilla' : 'Gilla'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <span>{likeCount}</span>
          </button>
          <button
            type="button"
            className={`footer-action ${showComments ? 'footer-action--active' : ''}`}
            onClick={handleToggleComments}
            aria-label="Visa kommentarer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span>{commentCount}</span>
          </button>
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

      {/* Comments Section */}
      {showComments && (
        <div className="feed-card__comments">
          {isLoadingComments ? (
            <div className="comments__loading">Laddar kommentarer...</div>
          ) : (
            <>
              {comments.length === 0 ? (
                <p className="comments__empty">Inga kommentarer än</p>
              ) : (
                <ul className="comments__list">
                  {comments.map((comment) => (
                    <li key={comment._id} className="comment">
                      <div className="comment__header">
                        <span className="comment__author">{comment.authorName}</span>
                        <span className="comment__date">
                          {new Date(comment.createdAt).toLocaleDateString('sv-SE', { 
                            month: 'short', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
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
                      <p className="comment__content">{comment.content}</p>
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
            </>
          )}
        </div>
      )}
    </article>
  )
}

/**
 * FlowPage - Huvudkomponent för det sociala flödet
 * 
 * Hanterar:
 * - Initial laddning av poster
 * - Polling för nya poster (var 10:e sekund)
 * - Oändlig scroll med "Ladda fler"-knapp
 * - Borttagning av poster
 * 
 * Polling-strategi:
 * Vi använder polling istället för WebSockets för enkelhet.
 * Nya poster visas inte automatiskt - användaren måste
 * klicka på en knapp för att ladda dem. Detta förhindrar
 * att innehållet "hoppar" medan användaren läser.
 */
function FlowPage() {
  // ===== POSTER-STATE =====
  const [posts, setPosts] = useState([])           // Lista med poster
  const [isLoading, setIsLoading] = useState(true) // Första laddningen
  const [isLoadingMore, setIsLoadingMore] = useState(false) // Laddar fler
  const [nextCursor, setNextCursor] = useState(null) // Cursor för paginering
  const [error, setError] = useState('') // Felmeddelande
  
  // ===== NYA POSTER-STATE (för polling) =====
  const [newPostsCount, setNewPostsCount] = useState(0)     // Antal nya poster
  const [latestPostTime, setLatestPostTime] = useState(null) // Senaste postens tid
  const [isLoadingNewPosts, setIsLoadingNewPosts] = useState(false)
  
  // ===== REFS =====
  const pollingIntervalRef = useRef(null)  // Referens till polling-intervallet
  const feedContainerRef = useRef(null)    // Referens till flödes-containern

  // Hämta inloggad användares ID (memoized för prestanda)
  const currentUserId = useMemo(() => getStoredUserId(), [])

  // ===== INITIAL LADDNING =====
  // Hämtar de första posterna när sidan laddas
  useEffect(() => {
    let ignore = false // Undvik race conditions vid snabb navigering
    setIsLoading(true)
    setError('')

    fetchPosts({ limit: 5 })
      .then((data) => {
        if (!ignore) {
          const items = data.items || []
          setPosts(items)
          setNextCursor(data.nextCursor)
          
          // Spara senaste postens tid för polling
          // Detta är referenspunkten för att hitta "nya" poster
          if (items.length > 0) {
            setLatestPostTime(items[0].createdAt)
          }
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

    // Cleanup-funktion som körs vid unmount
    return () => {
      ignore = true
    }
  }, [])

  // ===== POLLING FÖR NYA POSTER =====
  // Kontrollerar var 10:e sekund om det finns nya poster
  // Visar en badge/knapp istället för att automatiskt ladda dem
  useEffect(() => {
    // Starta inte polling förrän vi har en referenstid och initial laddning är klar
    if (!latestPostTime || isLoading) return

    /**
     * Kontrollerar om det finns nya poster sedan senaste kända posten
     * Uppdaterar endast räknaren, laddar inte posterna automatiskt
     */
    const checkForNewPosts = async () => {
      try {
        const data = await fetchNewPosts({ after: latestPostTime, limit: 20 })
        if (data.count > 0) {
          setNewPostsCount(data.count)
        }
      } catch (err) {
        // Tysta fel - polling ska inte störa användaren
        console.error('Failed to check for new posts:', err)
      }
    }

    // Starta polling med 10 sekunders intervall
    pollingIntervalRef.current = setInterval(checkForNewPosts, 10000)

    // Cleanup: stoppa polling när komponenten unmountas
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [latestPostTime, isLoading])

  // ===== LADDA NYA POSTER =====
  // Anropas när användaren klickar på "Nya poster"-knappen
  const loadNewPosts = useCallback(async () => {
    if (!latestPostTime || isLoadingNewPosts) return

    setIsLoadingNewPosts(true)

    try {
      const data = await fetchNewPosts({ after: latestPostTime, limit: 20 })
      if (data.items && data.items.length > 0) {
        // Lägg till nya poster överst i listan
        setPosts(prev => {
          // Undvik dubletter genom att filtrera bort redan existerande
          const existingIds = new Set(prev.map(p => p._id))
          const newItems = data.items.filter(p => !existingIds.has(p._id))
          // Reversa eftersom API:et returnerar äldst först
          return [...newItems.reverse(), ...prev]
        })
        
        // Uppdatera referenstiden till den nyaste posten
        const newestPost = data.items[data.items.length - 1]
        setLatestPostTime(newestPost.createdAt)
        
        // Nollställ räknaren och scrolla upp
        setNewPostsCount(0)
        
        // Smooth scroll till toppen
        if (feedContainerRef.current) {
          feedContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }
      }
    } catch (err) {
      console.error('Failed to load new posts:', err)
    } finally {
      setIsLoadingNewPosts(false)
    }
  }, [latestPostTime, isLoadingNewPosts])

  // ===== LADDA FLER POSTER =====
  // Oändlig scroll: laddar äldre poster när användaren scrollar ner
  const loadMore = useCallback(async () => {
    // Avbryt om det inte finns fler poster eller laddning pågår
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

  const handleDeletePost = useCallback((postId) => {
    setPosts(prev => prev.filter(p => p._id !== postId))
  }, [])

  return (
    <main className="flow-page" aria-labelledby="flow-heading">
      {/* New posts indicator */}
      {newPostsCount > 0 && (
        <button
          type="button"
          className="flow-new-posts-btn"
          onClick={loadNewPosts}
          disabled={isLoadingNewPosts}
          aria-label={`Ladda ${newPostsCount} nya inlägg`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7"/>
          </svg>
          {newPostsCount > 0 && (
            <span className="flow-new-posts-badge">{newPostsCount}</span>
          )}
        </button>
      )}
      
      <div ref={feedContainerRef} className="flow-feed">
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
            
            {/* Load more button */}
            {nextCursor && (
              <div className="flow-feed__load-more">
                <button 
                  className="flow-feed__load-more-btn"
                  onClick={loadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? 'Laddar...' : 'Ladda fler inlägg'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}

export default FlowPage
