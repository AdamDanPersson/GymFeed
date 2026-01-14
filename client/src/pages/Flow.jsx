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
import { fetchPosts, fetchNewPosts, getStoredUserId } from '../lib/apiClient'
import GraphPostCard from '../components/flow/GraphPostCard'
import FlowNewPostsButton from '../components/flow/FlowNewPostsButton'
import './Flow.css'

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
      <FlowNewPostsButton
        count={newPostsCount}
        onClick={loadNewPosts}
        isLoading={isLoadingNewPosts}
      />
      
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
