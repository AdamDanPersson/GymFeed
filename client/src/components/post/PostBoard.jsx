/**
 * PostBoard - Hantering av användarens egna poster
 * 
 * Denna komponent hanterar skapande och hantering av användarens poster.
 * Till skillnad från Flow.jsx som visar alla poster, visar denna
 * endast den inloggade användarens egna poster.
 * 
 * Funktioner:
 * - Skapa graf-poster (träningsstatistik med diagram)
 * - Skapa bild-poster (uppladdade bilder)
 * - Visa och hantera egna poster
 * - Kommentarsystem med olästa-indikator
 * - Bildbeskärning innan uppladdning
 */

// ==================== IMPORTS ====================
// React hooks
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// Diagram-komponenter från Recharts
import { 
  BarChart, Bar, 
  LineChart, Line, 
  CartesianGrid, 
  XAxis, YAxis, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts'

// API-funktioner
import {
  addComment,
  createPost,
  deleteComment,
  deletePost,
  fetchComments,
  fetchExercises,
  fetchPostChartData,
  fetchPosts,
  getExerciseSets,
  getStoredUserId,
  markCommentsAsRead
} from '../../lib/apiClient'

// Firebase för bilduppladdning
import { uploadPostImage } from '../../lib/firebase'

// Bildbeskärningskomponent
import ImageCropper from '../ImageCropper'

export default function PostBoard({ user, openPostCreator }) {
  // ==================== STATE ====================
  
  // ===== POSTER-STATE =====
  const [posts, setPosts] = useState([])              // Lista med användarens poster
  const [isLoadingPosts, setIsLoadingPosts] = useState(true)  // Laddningsstatus
  const [isCreatingPost, setIsCreatingPost] = useState(false) // Visar skaparformuläret
  const postBoardRef = useRef(null)                   // Referens för scroll-till-funktion

  // ===== EFFEKT: Öppna post-skapare från navigation =====
  // När användaren klickar på "Skapa post" i navigationen
  useEffect(() => {
    if (openPostCreator && user) {
      setIsCreatingPost(true)
      // Scrolla till post-sektionen efter kort fördröjning för DOM-uppdatering
      setTimeout(() => {
        postBoardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [openPostCreator, user])
  
  // ===== FORMULÄR-STATE FÖR NY POST =====
  const [postType, setPostType] = useState('graph')            // 'graph' eller 'image'
  const [postTitle, setPostTitle] = useState('')               // Titel på posten
  const [postDescription, setPostDescription] = useState('')   // Valfri beskrivning
  
  // ===== GRAF-SPECIFIK STATE =====
  const [selectedExerciseId, setSelectedExerciseId] = useState('')  // Vald övning
  const [selectedChartType, setSelectedChartType] = useState('bar') // 'bar' eller 'line'
  const [selectedMetric, setSelectedMetric] = useState('maxWeight') // Mätvärde för graf
  const [dateRangeFrom, setDateRangeFrom] = useState('')            // Startdatum
  const [dateRangeTo, setDateRangeTo] = useState('')                // Slutdatum
  const [datePreset, setDatePreset] = useState('30d')               // Datumpreset
  const [compareDay1, setCompareDay1] = useState('')                // För två-dagars jämförelse
  const [compareDay2, setCompareDay2] = useState('')                // För två-dagars jämförelse
  
  // ===== LADDNINGS- OCH FEL-STATE =====
  const [isSavingPost, setIsSavingPost] = useState(false)
  const [exercises, setExercises] = useState([])           // Lista med övningar för dropdown
  const [isLoadingExercises, setIsLoadingExercises] = useState(false)
  const [error, setError] = useState('')                   // Felmeddelande
  const [previewData, setPreviewData] = useState([])       // Data för graf-förhandsvisning
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [availableDates, setAvailableDates] = useState([]) // Tillgängliga datum för övningen
  
  // ===== BILD-UPPLADDNING STATE =====
  const [selectedImage, setSelectedImage] = useState(null)     // Vald bildfil
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')   // Förhandsvisnings-URL
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [showCropper, setShowCropper] = useState(false)        // Visa bildbeskäraren
  const [cropperImageSrc, setCropperImageSrc] = useState('')   // Bild för beskärning
  const fileInputRef = useRef(null)                            // Referens till file input
  
  // ===== VALD POST FÖR VISNING =====
  const [selectedPost, setSelectedPost] = useState(null)           // Vald post för detaljvy
  const [selectedPostChartData, setSelectedPostChartData] = useState([]) // Grafdata för vald post
  const [isLoadingSelectedPost, setIsLoadingSelectedPost] = useState(false)
  const selectedPostRef = useRef(null)                              // Referens för scroll
  
  // ===== KOMMENTAR-STATE =====
  const [comments, setComments] = useState([])                 // Kommentarer på vald post
  const [showComments, setShowComments] = useState(false)      // Visa kommentarer
  const [isLoadingComments, setIsLoadingComments] = useState(false)
  const [commentText, setCommentText] = useState('')           // Text för ny kommentar
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [postImageLoaded, setPostImageLoaded] = useState({})
  const [selectedPostImageLoaded, setSelectedPostImageLoaded] = useState(false)

  // ===== BERÄKNADE VÄRDEN =====
  // Memoized userId för att undvika onödiga omberäkningar
  const userId = useMemo(() => getStoredUserId(), [])

  // ==================== DATA HÄMTNING ====================

  // ===== HÄMTA ANVÄNDARENS POSTER =====
  useEffect(() => {
    if (!userId) {
      setIsLoadingPosts(false)
      return
    }

    let ignore = false // Förhindra race conditions
    setIsLoadingPosts(true)

    fetchPosts({ limit: 50, userId })
      .then((data) => {
        if (!ignore) {
          setPosts(data.items || [])
        }
      })
      .catch((err) => {
        console.error('Failed to fetch posts:', err)
      })
      .finally(() => {
        if (!ignore) {
          setIsLoadingPosts(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [userId])

  useEffect(() => {
    if (!posts.length) return
    setPostImageLoaded((prev) => {
      const next = { ...prev }
      posts.forEach((post) => {
        if (post.type === 'image' && post.imageUrl && !(post._id in next)) {
          next[post._id] = false
        }
      })
      return next
    })
  }, [posts])

  // ===== POLLING FÖR OLÄSTA KOMMENTARER =====
  // Kontrollerar var 10:e sekund om det finns nya olästa kommentarer
  // Uppdaterar endast räknaren, inte hela post-objektet
  useEffect(() => {
    if (!userId || isLoadingPosts) return

    const pollUnreadComments = async () => {
      try {
        const data = await fetchPosts({ limit: 50, userId })
        setPosts(prevPosts => {
          // Uppdatera endast unreadCommentCount för att undvika UI-störningar
          const updatedPosts = prevPosts.map(prevPost => {
            const newPost = data.items?.find(p => p._id === prevPost._id)
            if (newPost && newPost.unreadCommentCount !== prevPost.unreadCommentCount) {
              return { ...prevPost, unreadCommentCount: newPost.unreadCommentCount }
            }
            return prevPost
          })
          return updatedPosts
        })
      } catch (err) {
        console.error('Failed to poll unread comments:', err)
      }
    }

    // Polla var 10:e sekund
    const intervalId = setInterval(pollUnreadComments, 10000)

    return () => {
      clearInterval(intervalId)
    }
  }, [userId, isLoadingPosts])

  // ==================== DATUMHANTERING ====================

  /**
   * Applicera ett datumpreset för graf-intervallet
   * Beräknar från-datum baserat på valt preset (7d, 30d, 90d, etc.)
   */
  const applyDatePreset = useCallback((preset) => {
    const now = new Date()
    const to = now.toISOString().split('T')[0] // Dagens datum
    let from
    
    // Beräkna startdatum baserat på preset
    switch (preset) {
      case '7d':
        from = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        break
      case '30d':
        from = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        break
      case '90d':
        from = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        break
      case '1y':
        from = new Date(now - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        break
      case 'all':
        from = '2020-01-01' // Från början av appen
        break
      default:
        from = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }
    
    setDateRangeFrom(from)
    setDateRangeTo(to)
    setDatePreset(preset)
  }, [])

  // Sätt standarddatum (30 dagar) vid montering
  useEffect(() => {
    applyDatePreset('30d')
  }, [applyDatePreset])

  // ===== HÄMTA ÖVNINGAR FÖR DROPDOWN =====
  useEffect(() => {
    if (!user || !isCreatingPost) {
      return
    }

    let ignore = false
    setIsLoadingExercises(true)

    fetchExercises()
      .then((data) => {
        if (!ignore) {
          setExercises(data)
        }
      })
      .catch((err) => {
        console.error('Failed to fetch exercises:', err)
      })
      .finally(() => {
        if (!ignore) {
          setIsLoadingExercises(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [user, isCreatingPost])

  // ===== HÄMTA TILLGÄNGLIGA DATUM FÖR ÖVNING =====
  // Används för två-dagars jämförelse-dropdown
  useEffect(() => {
    if (!selectedExerciseId) {
      setAvailableDates([])
      return
    }

    let ignore = false

    getExerciseSets(selectedExerciseId)
      .then((data) => {
        if (ignore || !data.groups) return
        
        // Extrahera unika datum från set-grupper
        const dates = data.groups.map(group => {
          const d = new Date(group.date)
          return d.toISOString().split('T')[0]
        })
        
        // Sortera nyast först och ta bort dubletter
        const uniqueDates = [...new Set(dates)].sort((a, b) => new Date(b) - new Date(a))
        setAvailableDates(uniqueDates)
      })
      .catch((err) => {
        console.error('Failed to fetch available dates:', err)
      })

    return () => {
      ignore = true
    }
  }, [selectedExerciseId])

  // ===== HÄMTA FÖRHANDSVISNINGSDATA FÖR GRAF =====
  // Uppdateras när övning, mätvärde eller datumintervall ändras
  useEffect(() => {
    // Kontrollera att vi har giltiga datum baserat på preset
    const hasTwoDaysInput = datePreset === 'twoDays' && compareDay1 && compareDay2
    const hasRangeInput = datePreset !== 'twoDays' && dateRangeFrom && dateRangeTo

    if (!selectedExerciseId || (!hasTwoDaysInput && !hasRangeInput)) {
      setPreviewData([])
      return
    }

    let ignore = false
    setIsLoadingPreview(true)

    getExerciseSets(selectedExerciseId)
      .then((data) => {
        if (ignore || !data.groups) return

        let filteredGroups

        if (datePreset === 'twoDays') {
          // Filter to only include the two specific days
          const day1Str = compareDay1
          const day2Str = compareDay2

          filteredGroups = data.groups.filter(group => {
            const groupDateStr = new Date(group.date).toISOString().split('T')[0]
            return groupDateStr === day1Str || groupDateStr === day2Str
          })
        } else {
          // Regular range filter
          const fromDate = new Date(dateRangeFrom)
          const toDate = new Date(dateRangeTo)
          toDate.setHours(23, 59, 59, 999)

          filteredGroups = data.groups.filter(group => {
            const groupDate = new Date(group.date)
            return groupDate >= fromDate && groupDate <= toDate
          })
        }

        const sortedGroups = [...filteredGroups].sort((a, b) => 
          new Date(a.date) - new Date(b.date)
        )

        let chartData = []

        switch (selectedMetric) {
          case 'maxWeight':
            chartData = sortedGroups.map((group) => {
              const maxWeight = Math.max(...group.sets.map(s => parseFloat(s.weight) || 0))
              const date = new Date(group.date).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })
              return { date, value: maxWeight }
            })
            break

          case 'totalVolume':
            chartData = sortedGroups.map((group) => {
              const volume = group.sets.reduce((sum, set) => {
                const w = parseFloat(set.weight) || 0
                const r = parseInt(set.reps) || 0
                return sum + (w * r)
              }, 0)
              const date = new Date(group.date).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })
              return { date, value: Math.round(volume) }
            })
            break

          case 'e1rm':
            chartData = sortedGroups.map((group) => {
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
            break

          case 'setCount':
            chartData = sortedGroups.map((group) => {
              const date = new Date(group.date).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })
              return { date, value: group.sets.length }
            })
            break

          default:
            chartData = []
        }

        if (!ignore) {
          setPreviewData(chartData)
        }
      })
      .catch((err) => {
        console.error('Failed to fetch preview data:', err)
        if (!ignore) {
          setPreviewData([])
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoadingPreview(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [selectedExerciseId, selectedMetric, dateRangeFrom, dateRangeTo, datePreset, compareDay1, compareDay2])

  const formatPostDate = useCallback((value) => {
    if (!value) return ''
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return ''
    return parsed.toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' })
  }, [])

  // ==================== BILDHANTERING ====================

  /**
   * Hantera bildval - validera och visa beskäraren
   * Validerar filtyp (JPEG, PNG, WebP, GIF) och storlek (max 5MB)
   */
  const handleImageSelect = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!validTypes.includes(file.type)) {
      setError('Ogiltig filtyp. Endast JPEG, PNG, WebP och GIF tillåts.')
      return
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      setError('Bilden är för stor. Max 5MB.')
      return
    }

    setError('')
    
    // Create preview URL and show cropper
    const previewUrl = URL.createObjectURL(file)
    setCropperImageSrc(previewUrl)
    setShowCropper(true)
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  /**
   * Hantera när bildbeskärning är klar
   * Skapar en fil från den beskärda blob:en och visar förhandsvisning
   */
  const handleCropComplete = useCallback((croppedBlob) => {
    // Create a File from the blob
    const croppedFile = new File([croppedBlob], 'cropped-image.jpg', { type: 'image/jpeg' })
    setSelectedImage(croppedFile)
    
    // Create preview URL from the cropped blob
    const previewUrl = URL.createObjectURL(croppedBlob)
    setImagePreviewUrl(previewUrl)
    
    // Cleanup cropper state
    URL.revokeObjectURL(cropperImageSrc)
    setCropperImageSrc('')
    setShowCropper(false)
  }, [cropperImageSrc])

  /**
   * Hantera avbrytning av bildbeskärning
   * Rensar upp resurser och stänger beskäraren
   */
  const handleCropCancel = useCallback(() => {
    URL.revokeObjectURL(cropperImageSrc)
    setCropperImageSrc('')
    setShowCropper(false)
  }, [cropperImageSrc])

  // Rensa förhandsvisnings-URL vid unmount eller byte av bild
  // Förhindrar minnesläckor från Object URLs
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl)
      }
    }
  }, [imagePreviewUrl])

  // ==================== POSTHANTERING ====================

  /**
   * Skapa ny post (graf eller bild)
   * Validerar input, laddar upp bild vid behov, och sparar till API
   */
  const handleCreatePost = useCallback(async (e) => {
    e.preventDefault()
    setError('')

    // Validation
    if (!postTitle.trim()) {
      setError('Titel krävs')
      return
    }

    // Type-specific validation
    if (postType === 'graph') {
      if (!selectedExerciseId) {
        setError('Välj en övning')
        return
      }

      // Validate date inputs based on preset
      if (datePreset === 'twoDays') {
        if (!compareDay1 || !compareDay2) {
          setError('Välj båda dagarna')
          return
        }
      } else {
        if (!dateRangeFrom || !dateRangeTo) {
          setError('Välj datumintervall')
          return
        }
      }
    } else if (postType === 'image') {
      if (!selectedImage) {
        setError('Välj en bild att ladda upp')
        return
      }
    }

    setIsSavingPost(true)

    try {
      let postPayload

      if (postType === 'graph') {
        // Build graph post payload
        postPayload = {
          type: 'graph',
          title: postTitle.trim(),
          description: postDescription.trim(),
          exerciseId: selectedExerciseId,
          chartType: selectedChartType,
          metric: selectedMetric,
        }

        if (datePreset === 'twoDays') {
          // Store specific dates for two-day comparison
          postPayload.dateMode = 'twoDays'
          postPayload.specificDates = [compareDay1, compareDay2]
          // Also store dateRange for backwards compatibility
          const day1 = new Date(compareDay1)
          const day2 = new Date(compareDay2)
          const fromDate = day1 < day2 ? day1 : day2
          const toDate = day1 < day2 ? day2 : day1
          postPayload.dateRange = {
            from: fromDate.toISOString(),
            to: toDate.toISOString()
          }
        } else {
          postPayload.dateMode = 'range'
          postPayload.dateRange = {
            from: new Date(dateRangeFrom).toISOString(),
            to: new Date(dateRangeTo).toISOString()
          }
        }
      } else if (postType === 'image') {
        // Upload image to Firebase
        setIsUploadingImage(true)
        const imageUrl = await uploadPostImage(selectedImage)
        setIsUploadingImage(false)

        // Build image post payload
        postPayload = {
          type: 'image',
          title: postTitle.trim(),
          description: postDescription.trim(),
          imageUrl: imageUrl,
        }
      }

      const newPost = await createPost(postPayload)

      console.log('Post created:', newPost)
      
      // Add new post to list
      setPosts(prev => [newPost, ...prev])
      
      // Reset form
      setPostTitle('')
      setPostDescription('')
      setSelectedExerciseId('')
      setSelectedChartType('bar')
      setSelectedMetric('maxWeight')
      applyDatePreset('30d')
      setSelectedImage(null)
      setImagePreviewUrl('')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      setIsCreatingPost(false)
      
    } catch (err) {
      console.error('Failed to create post:', err)
      setError(err.message || 'Något gick fel')
      setIsUploadingImage(false)
    } finally {
      setIsSavingPost(false)
    }
  }, [postType, postTitle, postDescription, selectedExerciseId, selectedChartType, selectedMetric, dateRangeFrom, dateRangeTo, datePreset, compareDay1, compareDay2, applyDatePreset, selectedImage])

  /**
   * Avbryt skapande av post
   * Återställer alla formulärfält till standardvärden
   */
  const handleCancelPost = useCallback(() => {
    setPostTitle('')
    setPostDescription('')
    setPostType('graph')
    setSelectedExerciseId('')
    setSelectedChartType('bar')
    setSelectedMetric('maxWeight')
    applyDatePreset('30d')
    setCompareDay1('')
    setCompareDay2('')
    setError('')
    setSelectedImage(null)
    setImagePreviewUrl('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    setIsCreatingPost(false)
  }, [applyDatePreset])

  /**
   * Ta bort en post
   * Bekräftar med användaren innan borttagning
   */
  const handleDeletePost = useCallback(async (postId) => {
    // Visa bekräftelsedialog på svenska
    if (!confirm('Är du säker på att du vill ta bort denna post?')) return

    try {
      await deletePost(postId)
      setPosts(prev => prev.filter(p => p._id !== postId))
      // Clear selection if deleted post was selected
      if (selectedPost?._id === postId) {
        setSelectedPost(null)
        setSelectedPostChartData([])
      }
    } catch (err) {
      console.error('Failed to delete post:', err)
      alert('Kunde inte ta bort posten: ' + err.message)
    }
  }, [selectedPost])

  /**
   * Välj en post för detaljvisning
   * Hämtar grafdata och visar post-förhandsvisning
   * Klick på samma post stänger förhandsvisningen (toggle)
   */
  const handleSelectPost = useCallback(async (post) => {
    // Toggle av om samma post klickas igen
    if (selectedPost?._id === post._id) {
      setSelectedPost(null)
      setSelectedPostChartData([])
      return
    }

    setSelectedPost(post)
    if (post.type === 'image' && post.imageUrl) {
      setSelectedPostImageLoaded(false)
    }
    setIsLoadingSelectedPost(true)
    setSelectedPostChartData([])

    try {
      const data = await fetchPostChartData(post._id)
      
      if (data.groups && data.groups.length > 0) {
        // Calculate chart data from groups
        let filteredGroups = data.groups

        if (post.dateMode === 'twoDays' && post.specificDates && post.specificDates.length === 2) {
          // Filter to only include the two specific dates
          filteredGroups = data.groups.filter(group => {
            const groupDateStr = new Date(group.date).toISOString().split('T')[0]
            return post.specificDates.includes(groupDateStr)
          })
        } else if (post.dateRange) {
          // Filter by date range
          const fromDateStr = post.dateRange.from?.split('T')[0]
          const toDateStr = post.dateRange.to?.split('T')[0]
          
          if (fromDateStr && toDateStr) {
            filteredGroups = data.groups.filter(group => {
              const groupDateStr = new Date(group.date).toISOString().split('T')[0]
              return groupDateStr >= fromDateStr && groupDateStr <= toDateStr
            })
          }
        }

        // Sort by date ascending
        const sortedGroups = [...filteredGroups].sort((a, b) => 
          new Date(a.date) - new Date(b.date)
        )

        let chartData = []
        const metric = post.metric || 'maxWeight'

        switch (metric) {
          case 'maxWeight':
            chartData = sortedGroups.map((group) => {
              const maxWeight = Math.max(...group.sets.map(s => parseFloat(s.weight) || 0))
              const date = new Date(group.date).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })
              return { date, value: maxWeight }
            })
            break

          case 'totalVolume':
            chartData = sortedGroups.map((group) => {
              const volume = group.sets.reduce((sum, set) => {
                const w = parseFloat(set.weight) || 0
                const r = parseInt(set.reps) || 0
                return sum + (w * r)
              }, 0)
              const date = new Date(group.date).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })
              return { date, value: Math.round(volume) }
            })
            break

          case 'e1rm':
            chartData = sortedGroups.map((group) => {
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
            break

          case 'setCount':
            chartData = sortedGroups.map((group) => {
              const date = new Date(group.date).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })
              return { date, value: group.sets.length }
            })
            break

          case 'totalReps':
            chartData = sortedGroups.map((group) => {
              const totalReps = group.sets.reduce((sum, set) => sum + (parseInt(set.reps) || 0), 0)
              const date = new Date(group.date).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })
              return { date, value: totalReps }
            })
            break

          default:
            chartData = []
        }

        setSelectedPostChartData(chartData)
      } else {
        setSelectedPostChartData([])
      }
    } catch (err) {
      console.error('Failed to fetch chart data:', err)
      setSelectedPostChartData([])
    } finally {
      setIsLoadingSelectedPost(false)
    }
  }, [selectedPost])

  // Scrolla till vald post när den väljs
  useEffect(() => {
    if (selectedPost && selectedPostRef.current) {
      setTimeout(() => {
        selectedPostRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [selectedPost])

  // Återställ kommentarer när en annan post väljs
  useEffect(() => {
    setComments([])
    setShowComments(false)
    setCommentText('')
  }, [selectedPost?._id])

  // ===== POLLING FÖR NYA KOMMENTARER =====
  // När kommentarsektionen är öppen, polla var 5:e sekund
  useEffect(() => {
    if (!showComments || !selectedPost || isLoadingComments) return

    const pollComments = async () => {
      try {
        const data = await fetchComments(selectedPost._id)
        const newComments = data.comments || []
        
        setComments(prevComments => {
          // Only update if there are new comments
          if (newComments.length !== prevComments.length) {
            // Find genuinely new comments (not already in list)
            const existingIds = new Set(prevComments.map(c => c._id))
            const addedComments = newComments.filter(c => !existingIds.has(c._id))
            
            if (addedComments.length > 0) {
              // Update comment count in posts and selectedPost
              const newCount = newComments.length
              setPosts(prev => prev.map(p => 
                p._id === selectedPost._id 
                  ? { ...p, commentCount: newCount }
                  : p
              ))
              setSelectedPost(prev => prev ? { ...prev, commentCount: newCount } : null)
              
              return [...prevComments, ...addedComments]
            }
          }
          return prevComments
        })
      } catch (err) {
        console.error('Failed to poll comments:', err)
      }
    }

    // Poll every 5 seconds when comments are open
    const intervalId = setInterval(pollComments, 5000)

    return () => {
      clearInterval(intervalId)
    }
  }, [showComments, selectedPost, isLoadingComments])

  /**
   * Visa/dölj kommentarsektionen
   * Hämtar kommentarer och markerar dem som lästa
   */
  const handleToggleComments = useCallback(async () => {
    if (!selectedPost) return

    if (!showComments) {
      setShowComments(true)
      setIsLoadingComments(true)
      try {
        const data = await fetchComments(selectedPost._id)
        setComments(data.comments || [])
        
        // Mark comments as read and update local state
        if (selectedPost.unreadCommentCount > 0) {
          await markCommentsAsRead(selectedPost._id)
          setPosts(prev => prev.map(p => 
            p._id === selectedPost._id 
              ? { ...p, unreadCommentCount: 0 }
              : p
          ))
          setSelectedPost(prev => prev ? { ...prev, unreadCommentCount: 0 } : null)
        }
      } catch (err) {
        console.error('Failed to fetch comments:', err)
      } finally {
        setIsLoadingComments(false)
      }
    } else {
      setShowComments(false)
    }
  }, [selectedPost, showComments])

  /**
   * Skicka en ny kommentar
   * Uppdaterar lokal state och kommentarsräknare
   */
  const handleSubmitComment = useCallback(async (e) => {
    e.preventDefault()
    // Validera att kommentaren inte är tom och att vi har rätt tillstånd
    if (!commentText.trim() || isSubmittingComment || !selectedPost || !userId) return

    setIsSubmittingComment(true)
    try {
      const newComment = await addComment(selectedPost._id, commentText.trim())
      setComments(prev => [...prev, newComment])
      setCommentText('')
      // Update comment count in the post
      setPosts(prev => prev.map(p => 
        p._id === selectedPost._id 
          ? { ...p, commentCount: (p.commentCount || 0) + 1 }
          : p
      ))
      setSelectedPost(prev => prev ? { ...prev, commentCount: (prev.commentCount || 0) + 1 } : null)
    } catch (err) {
      console.error('Failed to add comment:', err)
      alert('Kunde inte lägga till kommentar: ' + err.message)
    } finally {
      setIsSubmittingComment(false)
    }
  }, [selectedPost, commentText, isSubmittingComment, userId])

  /**
   * Ta bort en kommentar
   * Endast ägarens egna kommentarer kan tas bort
   */
  const handleDeleteComment = useCallback(async (commentId) => {
    if (!selectedPost) return

    try {
      await deleteComment(selectedPost._id, commentId)
      setComments(prev => prev.filter(c => c._id !== commentId))
      // Update comment count
      setPosts(prev => prev.map(p => 
        p._id === selectedPost._id 
          ? { ...p, commentCount: Math.max(0, (p.commentCount || 0) - 1) }
          : p
      ))
      setSelectedPost(prev => prev ? { ...prev, commentCount: Math.max(0, (prev.commentCount || 0) - 1) } : null)
    } catch (err) {
      console.error('Failed to delete comment:', err)
      alert('Kunde inte ta bort kommentar: ' + err.message)
    }
  }, [selectedPost])

  // ==================== RENDERING ====================

  // Visa meddelande om användaren inte är inloggad
  if (!user) {
    return (
      <section ref={postBoardRef} className="pass-menu" aria-label="Post">
        <h2>Post</h2>
        <p className="pass-menu__message">Du måste logga in för att skapa poster.</p>
      </section>
    )
  }

  return (
    <section ref={postBoardRef} className="pass-menu" aria-label="Post">
      {/* Image Cropper Modal */}
      {showCropper && cropperImageSrc && (
        <ImageCropper
          imageSrc={cropperImageSrc}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
          outputSize={400}
        />
      )}
      
      <h2>Post</h2>
      <div className="pass-menu__board pass-menu__board--post">
        {isLoadingPosts ? (
          <p className="pass-menu__loading">Laddar poster...</p>
        ) : posts.length === 0 && !isCreatingPost ? (
          <p className="pass-menu__empty">Inga poster ännu</p>
        ) : null}

        {/* Post tiles */}
        {posts.map((post) => (
          <div
            key={post._id}
            className={`pass-tile pass-tile--saved pass-tile--post ${post.type === 'image' ? 'pass-tile--image' : ''} ${post.type === 'image' && post.imageUrl && !postImageLoaded[post._id] ? 'pass-tile--image-loading' : ''} ${post.type === 'image' && postImageLoaded[post._id] ? 'pass-tile--image-loaded' : ''} ${selectedPost?._id === post._id ? 'pass-tile--selected' : ''}`}
            onClick={() => handleSelectPost(post)}
            style={{ cursor: 'pointer' }}
          >
            {post.type === 'image' && post.imageUrl && (
              <img
                src={post.imageUrl}
                alt={post.title}
                className="pass-tile__image"
                loading="lazy"
                onLoad={() => setPostImageLoaded((prev) => ({ ...prev, [post._id]: true }))}
                onError={() => setPostImageLoaded((prev) => ({ ...prev, [post._id]: true }))}
              />
            )}
            {post.unreadCommentCount > 0 && (
              <div className="pass-tile__unread-badge" title={`${post.unreadCommentCount} olästa kommentarer`}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="10"/>
                </svg>
              </div>
            )}
            <div className="pass-tile__content">
              <h3>{post.title}</h3>
              {post.type === 'graph' && (
                <span className="pass-tile__exercise">{post.exerciseName}</span>
              )}
              <div className="pass-tile__meta">
                <time dateTime={post.createdAt}>
                  {formatPostDate(post.createdAt)}
                </time>
                <span className="pass-tile__stats">
                  <span className="pass-tile__stat">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                    {post.likeCount || 0}
                  </span>
                  <span className="pass-tile__stat">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    {post.commentCount || 0}
                  </span>
                </span>
              </div>
            </div>
            <div className="pass-tile__actions">
              <button
                type="button"
                className="pass-tile__delete-btn"
                aria-label="Ta bort post"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeletePost(post._id)
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14"/>
                </svg>
              </button>
            </div>
          </div>
        ))}

        {/* Add post button - same style as pass */}
        <button
          type="button"
          className="pass-tile pass-tile--add"
          aria-label="Lägg till ny post"
          onClick={() => setIsCreatingPost(true)}
          disabled={isCreatingPost}
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>

      {/* Selected post preview */}
      {selectedPost && (
        <div ref={selectedPostRef} className="post-preview">
          <div className="post-preview__header">
            <h3>{selectedPost.title}</h3>
            <button
              type="button"
              className="post-preview__close"
              onClick={() => {
                setSelectedPost(null)
                setSelectedPostChartData([])
              }}
              aria-label="Stäng förhandsgranskning"
            >
              ✕
            </button>
          </div>
          
          {selectedPost.type === 'image' ? (
            <>
              <div className={`post-preview__image ${!selectedPostImageLoaded ? 'post-preview__image--loading' : ''} ${selectedPostImageLoaded ? 'post-preview__image--loaded' : ''}`}>
                <img
                  src={selectedPost.imageUrl}
                  alt={selectedPost.title}
                  loading="lazy"
                  onLoad={() => setSelectedPostImageLoaded(true)}
                  onError={() => setSelectedPostImageLoaded(true)}
                />
              </div>
              {selectedPost.description && (
                <p className="post-preview__description">{selectedPost.description}</p>
              )}
            </>
          ) : (
            <>
              <span className="post-preview__exercise">{selectedPost.exerciseName}</span>
              
              {isLoadingSelectedPost ? (
                <div className="post-preview__loading">Laddar graf...</div>
              ) : selectedPostChartData.length > 0 ? (
                <div className="post-preview__chart">
                  <ResponsiveContainer width="100%" height={250}>
                    {selectedPost.chartType === 'line' ? (
                      <LineChart data={selectedPostChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#3a3a3a" />
                        <XAxis 
                          dataKey="date" 
                          stroke="#999"
                          tick={{ fill: '#999', fontSize: 11 }}
                        />
                        <YAxis 
                          stroke="#999"
                          tick={{ fill: '#999', fontSize: 11 }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#2a2a2a', 
                            border: '1px solid #3a3a3a',
                            borderRadius: '8px'
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="value" 
                          stroke="#f5a623" 
                          strokeWidth={2}
                          dot={{ fill: '#f5a623', strokeWidth: 2 }}
                          name={selectedPost.metric === 'maxWeight' ? 'Max Vikt (kg)' : 
                                selectedPost.metric === 'totalVolume' ? 'Volym (kg)' : 
                                selectedPost.metric === 'totalReps' ? 'Reps' : 'Värde'}
                        />
                      </LineChart>
                    ) : (
                      <BarChart data={selectedPostChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#3a3a3a" />
                        <XAxis 
                          dataKey="date" 
                          stroke="#999"
                          tick={{ fill: '#999', fontSize: 11 }}
                        />
                        <YAxis 
                          stroke="#999"
                          tick={{ fill: '#999', fontSize: 11 }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#2a2a2a', 
                            border: '1px solid #3a3a3a',
                            borderRadius: '8px'
                          }}
                        />
                        <Bar 
                          dataKey="value" 
                          fill="#f5a623"
                          radius={[4, 4, 0, 0]}
                          name={selectedPost.metric === 'maxWeight' ? 'Max Vikt (kg)' : 
                                selectedPost.metric === 'totalVolume' ? 'Volym (kg)' : 
                                selectedPost.metric === 'totalReps' ? 'Reps' : 'Värde'}
                        />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="post-preview__no-data">Ingen data tillgänglig</div>
              )}

              {selectedPost.description && (
                <p className="post-preview__description">{selectedPost.description}</p>
              )}
            </>
          )}

          <div className="post-preview__meta">
            <span className="post-preview__stat">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              {selectedPost.likeCount || 0} gillningar
            </span>
            <button 
              type="button"
              className={`post-preview__stat post-preview__stat--clickable ${showComments ? 'post-preview__stat--active' : ''}`}
              onClick={handleToggleComments}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              {selectedPost.commentCount || 0} kommentarer
            </button>
          </div>

          {/* Comments section */}
          {showComments && (
            <div className="post-preview__comments">
              {isLoadingComments ? (
                <p className="post-preview__comments-loading">Laddar kommentarer...</p>
              ) : (
                <>
                  {comments.length === 0 ? (
                    <p className="post-preview__no-comments">Inga kommentarer ännu</p>
                  ) : (
                    <ul className="post-preview__comments-list">
                      {comments.map((comment) => (
                        <li key={comment._id} className="post-preview__comment">
                          <div className="post-preview__comment-header">
                            <span className="post-preview__comment-author">
                              {comment.authorName || 'Anonym'}
                            </span>
                            <time className="post-preview__comment-time">
                              {new Date(comment.createdAt).toLocaleDateString('sv-SE', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </time>
                            {comment.userId === userId && (
                              <button
                                type="button"
                                className="post-preview__comment-delete"
                                onClick={() => handleDeleteComment(comment._id)}
                                aria-label="Ta bort kommentar"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                          <p className="post-preview__comment-text">{comment.content}</p>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Add comment form */}
                  {userId && (
                    <form className="post-preview__comment-form" onSubmit={handleSubmitComment}>
                      <input
                        type="text"
                        className="post-preview__comment-input"
                        placeholder="Skriv en kommentar..."
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        disabled={isSubmittingComment}
                      />
                      <button
                        type="submit"
                        className="post-preview__comment-submit"
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
        </div>
      )}

      {/* Create post panel - expanded form */}
      {isCreatingPost && (
        <div className="post-creator">
          <div className="post-creator__header">
            <h3>Skapa post</h3>
            <button 
              type="button" 
              className="post-creator__close"
              onClick={handleCancelPost}
              aria-label="Stäng"
            >
              ✕
            </button>
          </div>

          {/* Post Type Toggle */}
          <div className="post-creator__type-toggle">
            <button
              type="button"
              className={`post-creator__type-btn ${postType === 'graph' ? 'post-creator__type-btn--active' : ''}`}
              onClick={() => setPostType('graph')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="20" x2="12" y2="10"/>
                <line x1="18" y1="20" x2="18" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="16"/>
              </svg>
              Graf
            </button>
            <button
              type="button"
              className={`post-creator__type-btn ${postType === 'image' ? 'post-creator__type-btn--active' : ''}`}
              onClick={() => setPostType('image')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              Bild
            </button>
          </div>

          <form className="post-creator__form" onSubmit={handleCreatePost}>
            <div className="post-creator__section">
              <label className="post-creator__label">
                <span>Titel på post</span>
                <input
                  type="text"
                  className="post-creator__input"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder="Ex. Bänkpress progression"
                  maxLength={100}
                  autoFocus
                  required
                />
              </label>
            </div>

            {postType === 'graph' ? (
              <>
                {error && (
                  <div className="post-creator__error">
                    {error}
                  </div>
                )}

                <div className="post-creator__section">
                  <label className="post-creator__label">
                    <span>Övning</span>
                    <select 
                      className="post-creator__select"
                      value={selectedExerciseId}
                      onChange={(e) => setSelectedExerciseId(e.target.value)}
                      required
                      disabled={isLoadingExercises}
                    >
                      <option value="" disabled>
                        {isLoadingExercises ? 'Laddar övningar...' : 'Välj övning...'}
                      </option>
                      {exercises.map((ex) => (
                        <option key={ex._id} value={ex._id}>
                          {ex.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="post-creator__section">
                  <label className="post-creator__label">
                    <span>Graftyp</span>
                    <div className="post-creator__chart-type">
                      <button
                        type="button"
                        className={`post-creator__chart-btn ${selectedChartType === 'bar' ? 'post-creator__chart-btn--active' : ''}`}
                        onClick={() => setSelectedChartType('bar')}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="20" x2="12" y2="10"/>
                          <line x1="18" y1="20" x2="18" y2="4"/>
                          <line x1="6" y1="20" x2="6" y2="16"/>
                        </svg>
                        Staplar
                      </button>
                      <button
                        type="button"
                        className={`post-creator__chart-btn ${selectedChartType === 'line' ? 'post-creator__chart-btn--active' : ''}`}
                        onClick={() => setSelectedChartType('line')}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                        </svg>
                        Linje
                      </button>
                    </div>
                  </label>
                </div>

                <div className="post-creator__section">
                  <label className="post-creator__label">
                    <span>Metric</span>
                    <select 
                      className="post-creator__select"
                      value={selectedMetric}
                      onChange={(e) => setSelectedMetric(e.target.value)}
                    >
                      <option value="maxWeight">Max vikt (top set)</option>
                      <option value="totalVolume">Total volym</option>
                      <option value="e1rm">Estimerat 1RM</option>
                      <option value="setCount">Antal set</option>
                      <option value="totalReps">Totala reps</option>
                      {selectedChartType === 'bar' && <option value="allSets">Alla set (detaljvy)</option>}
                    </select>
                  </label>
                </div>

                <div className="post-creator__section">
                  <label className="post-creator__label">
                    <span>Datumintervall</span>
                    <div className="post-creator__date-presets">
                      {[
                        { key: '7d', label: '7 dagar' },
                        { key: '30d', label: '30 dagar' },
                        { key: '90d', label: '90 dagar' },
                        { key: '1y', label: '1 år' },
                        { key: 'all', label: 'Allt' },
                        { key: 'custom', label: 'Anpassad' },
                        { key: 'twoDays', label: '2 dagar' }
                      ].map(({ key, label }) => (
                        <button
                          key={key}
                          type="button"
                          className={`post-creator__date-preset ${datePreset === key ? 'post-creator__date-preset--active' : ''}`}
                          onClick={() => {
                            if (key !== 'custom') {
                              applyDatePreset(key)
                            } else {
                              setDatePreset('custom')
                            }
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </label>
                </div>

                {datePreset === 'custom' && (
                  <div className="post-creator__section post-creator__section--row">
                    <label className="post-creator__label post-creator__label--half">
                      <span>Från</span>
                      <input
                        type="date"
                        className="post-creator__input"
                        value={dateRangeFrom}
                        onChange={(e) => setDateRangeFrom(e.target.value)}
                        required
                      />
                    </label>
                    <label className="post-creator__label post-creator__label--half">
                      <span>Till</span>
                      <input
                        type="date"
                        className="post-creator__input"
                        value={dateRangeTo}
                        onChange={(e) => setDateRangeTo(e.target.value)}
                        required
                      />
                    </label>
                  </div>
                )}

                {datePreset === 'twoDays' && (
                  <div className="post-creator__section post-creator__section--row">
                    <label className="post-creator__label post-creator__label--half">
                      <span>Dag 1</span>
                      <select
                        className="post-creator__select"
                        value={compareDay1}
                        onChange={(e) => setCompareDay1(e.target.value)}
                        required
                      >
                        <option value="">Välj datum...</option>
                        {availableDates
                          .filter(d => d !== compareDay2)
                          .map(date => (
                            <option key={date} value={date}>
                              {new Date(date).toLocaleDateString('sv-SE')}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="post-creator__label post-creator__label--half">
                      <span>Dag 2</span>
                      <select
                        className="post-creator__select"
                        value={compareDay2}
                        onChange={(e) => setCompareDay2(e.target.value)}
                        required
                      >
                        <option value="">Välj datum...</option>
                        {availableDates
                          .filter(d => d !== compareDay1)
                          .map(date => (
                            <option key={date} value={date}>
                              {new Date(date).toLocaleDateString('sv-SE')}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                )}

                <div className="post-creator__section">
                  <label className="post-creator__label">
                    <span>Beskrivning (valfritt)</span>
                    <textarea
                      className="post-creator__textarea"
                      value={postDescription}
                      onChange={(e) => setPostDescription(e.target.value)}
                      placeholder="Skriv en kort beskrivning om din progression..."
                      rows={3}
                      maxLength={500}
                    />
                  </label>
                </div>

                <div className="post-creator__preview">
                  <p className="post-creator__preview-label">Förhandsvisning</p>
                  <div className="post-creator__preview-chart">
                    {isLoadingPreview ? (
                      <div className="post-creator__preview-placeholder">
                        <span>Laddar data...</span>
                      </div>
                    ) : !selectedExerciseId ? (
                      <div className="post-creator__preview-placeholder">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="20" x2="12" y2="10"/>
                          <line x1="18" y1="20" x2="18" y2="4"/>
                          <line x1="6" y1="20" x2="6" y2="16"/>
                        </svg>
                        <span>Välj en övning för att se graf</span>
                      </div>
                    ) : previewData.length === 0 ? (
                      <div className="post-creator__preview-placeholder">
                        <span>Ingen data för valt intervall</span>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={180}>
                        {selectedChartType === 'bar' ? (
                          <BarChart data={previewData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(245, 231, 198, 0.2)" />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#f5e7c6' }} stroke="#f5e7c6" />
                            <YAxis tick={{ fontSize: 10, fill: '#f5e7c6' }} stroke="#f5e7c6" />
                            <Tooltip 
                              contentStyle={{ 
                                background: '#333', 
                                border: '1px solid rgba(245, 231, 198, 0.2)',
                                borderRadius: '8px',
                                color: '#f5e7c6'
                              }} 
                            />
                            <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        ) : (
                          <LineChart data={previewData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(245, 231, 198, 0.2)" />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#f5e7c6' }} stroke="#f5e7c6" />
                            <YAxis tick={{ fontSize: 10, fill: '#f5e7c6' }} stroke="#f5e7c6" />
                            <Tooltip 
                              contentStyle={{ 
                                background: '#333', 
                                border: '1px solid rgba(245, 231, 198, 0.2)',
                                borderRadius: '8px',
                                color: '#f5e7c6'
                              }} 
                            />
                            <Line 
                              type="monotone" 
                              dataKey="value" 
                              stroke="#6366f1" 
                              strokeWidth={2} 
                              dot={{ r: 3, fill: '#6366f1' }} 
                            />
                          </LineChart>
                        )}
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                {error && (
                  <div className="post-creator__error">
                    {error}
                  </div>
                )}

                <div className="post-creator__section">
                  <label className="post-creator__label">
                    <span>Ladda upp bild</span>
                    <div className="post-creator__file-wrapper">
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="post-creator__file-input"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={handleImageSelect}
                      />
                      <div className="post-creator__file-btn">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                          <polyline points="17 8 12 3 7 8"/>
                          <line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        {selectedImage ? selectedImage.name : 'Välj bild...'}
                      </div>
                    </div>
                    <span className="post-creator__file-hint">Max 5MB. JPEG, PNG, WebP eller GIF.</span>
                  </label>
                </div>

                <div className="post-creator__section">
                  <label className="post-creator__label">
                    <span>Beskrivning (valfritt)</span>
                    <textarea
                      className="post-creator__textarea"
                      value={postDescription}
                      onChange={(e) => setPostDescription(e.target.value)}
                      placeholder="Skriv en kort beskrivning..."
                      rows={4}
                      maxLength={500}
                    />
                  </label>
                </div>

                <div className="post-creator__preview">
                  <p className="post-creator__preview-label">Förhandsvisning</p>
                  <div className="post-creator__preview-image">
                    {imagePreviewUrl ? (
                      <img src={imagePreviewUrl} alt="Förhandsvisning" />
                    ) : (
                      <div className="post-creator__preview-placeholder">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                          <circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21 15 16 10 5 21"/>
                        </svg>
                        <span>Välj en bild för att se förhandsvisning</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            <div className="post-creator__actions">
              <button 
                type="button" 
                className="post-creator__cancel"
                onClick={handleCancelPost}
                disabled={isSavingPost || isUploadingImage}
              >
                Avbryt
              </button>
              <button 
                type="submit" 
                className="post-creator__submit"
                disabled={!postTitle.trim() || isSavingPost || isUploadingImage || (postType === 'image' && !selectedImage)}
              >
                {isUploadingImage ? 'Laddar upp...' : isSavingPost ? 'Postar...' : 'Posta till Flow'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
