import { ObjectId } from 'mongodb'
import { collections } from '../db/collections.js'
import { requireUser } from '../middleware/requireUser.js'

// ==================== KONSTANTER ====================
// Giltiga mätvärden för grafer i poster
const VALID_METRICS = ['maxWeight', 'totalVolume', 'e1rm', 'setCount', 'allSets']
// Giltiga diagramtyper
const VALID_CHART_TYPES = ['bar', 'line']

export function registerPostRoutes(app) {
  /**
   * GET /exercises - Hämta alla övningar för dropdown-menyer
   * Returnerar lista med övningsnamn och ID:n för inloggad användare
   */
  app.get('/exercises', requireUser, async (req, res) => {
    try {
      const exercises = await collections.exercisesCollection
        .find({ userId: req.userId })
        .sort({ name: 1 })
        .toArray()

      return res.json(
        exercises.map((ex) => ({
          _id: ex._id.toString(),
          name: ex.name
        }))
      )
    } catch (error) {
      console.error('Get exercises error', error)
      return res.status(500).json({ message: 'Failed to fetch exercises' })
    }
  })

  /**
   * POST /posts - Skapa ny post (graf eller bild)
   * Graf-poster visar träningsstatistik med diagram
   * Bild-poster visar uppladdade bilder
   * Kräver: type ('graph' eller 'image'), title, och typ-specifik data
   */
  app.post('/posts', requireUser, async (req, res) => {
    const { type, title, description, exerciseId, chartType, metric, dateRange, dateMode, specificDates, imageUrl } = req.body

    // Validate type
    if (type !== 'graph' && type !== 'image') {
      return res.status(400).json({ message: 'Type must be either "graph" or "image"' })
    }

    // Validate title
    const trimmedTitle = typeof title === 'string' ? title.trim() : ''
    if (!trimmedTitle) {
      return res.status(400).json({ message: 'Title is required' })
    }
    if (trimmedTitle.length > 80) {
      return res.status(400).json({ message: 'Title must be 80 characters or less' })
    }

    // Get user info for author name
    const user = await collections.usersCollection.findOne({ _id: req.userId })
    const authorName = user?.fullName || user?.firstName || 'Okänd'
    const now = new Date()

    try {
      // Handle image post
      if (type === 'image') {
        if (!imageUrl || typeof imageUrl !== 'string') {
          return res.status(400).json({ message: 'imageUrl is required for image posts' })
        }

        const postDoc = {
          userId: req.userId,
          type: 'image',
          title: trimmedTitle,
          description: typeof description === 'string' ? description.trim() : '',
          imageUrl,
          authorName,
          createdAt: now,
          likeCount: 0,
          commentCount: 0
        }

        const result = await collections.postsCollection.insertOne(postDoc)

        return res.status(201).json({
          _id: result.insertedId.toString(),
          userId: postDoc.userId.toString(),
          type: postDoc.type,
          title: postDoc.title,
          description: postDoc.description,
          imageUrl: postDoc.imageUrl,
          authorName: postDoc.authorName,
          profileImageUrl: user?.profileImageUrl || null,
          createdAt: postDoc.createdAt,
          likeCount: postDoc.likeCount,
          commentCount: postDoc.commentCount
        })
      }

      // Handle graph post
      // Validate exerciseId
      if (!exerciseId || !ObjectId.isValid(exerciseId)) {
        return res.status(400).json({ message: 'Valid exerciseId is required' })
      }

      // Validate chartType
      if (!VALID_CHART_TYPES.includes(chartType)) {
        return res.status(400).json({ message: `chartType must be one of: ${VALID_CHART_TYPES.join(', ')}` })
      }

      // Validate metric
      if (!VALID_METRICS.includes(metric)) {
        return res.status(400).json({ message: `metric must be one of: ${VALID_METRICS.join(', ')}` })
      }

      // Validate dateRange
      if (!dateRange || !dateRange.from || !dateRange.to) {
        return res.status(400).json({ message: 'dateRange with from and to is required' })
      }

      const fromDate = new Date(dateRange.from)
      const toDate = new Date(dateRange.to)

      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        return res.status(400).json({ message: 'Invalid date format in dateRange' })
      }

      if (fromDate > toDate) {
        return res.status(400).json({ message: 'dateRange.from must be before dateRange.to' })
      }

      // Verify exercise belongs to user
      const exercise = await collections.exercisesCollection.findOne({
        _id: new ObjectId(exerciseId),
        userId: req.userId
      })

      if (!exercise) {
        return res.status(404).json({ message: 'Exercise not found or does not belong to you' })
      }

      const postDoc = {
        userId: req.userId,
        type: 'graph',
        title: trimmedTitle,
        description: typeof description === 'string' ? description.trim() : '',
        exerciseId: new ObjectId(exerciseId),
        exerciseName: exercise.name,
        authorName,
        chartType,
        metric,
        dateRange: {
          from: fromDate,
          to: toDate
        },
        dateMode: dateMode || 'range',
        specificDates: Array.isArray(specificDates) ? specificDates : null,
        graphConfig: {
          chartType,
          metric,
          dateRange: {
            from: fromDate,
            to: toDate
          }
        },
        createdAt: now,
        likeCount: 0,
        commentCount: 0
      }

      const result = await collections.postsCollection.insertOne(postDoc)

      return res.status(201).json({
        _id: result.insertedId.toString(),
        userId: postDoc.userId.toString(),
        type: postDoc.type,
        title: postDoc.title,
        description: postDoc.description,
        exerciseId: postDoc.exerciseId.toString(),
        exerciseName: postDoc.exerciseName,
        authorName: postDoc.authorName,
        profileImageUrl: user?.profileImageUrl || null,
        chartType: postDoc.chartType,
        metric: postDoc.metric,
        dateRange: postDoc.dateRange,
        dateMode: postDoc.dateMode,
        specificDates: postDoc.specificDates,
        graphConfig: postDoc.graphConfig,
        createdAt: postDoc.createdAt,
        likeCount: postDoc.likeCount,
        commentCount: postDoc.commentCount
      })
    } catch (error) {
      console.error('Create post error', error)
      return res.status(500).json({ message: 'Failed to create post' })
    }
  })

  // GET /posts - Public feed with cursor pagination
  app.get('/posts', async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 5, 50)
    const cursor = req.query.cursor
    const userId = req.query.userId // Optional filter by user

    try {
      let query = {}

      // Filter by userId if provided
      if (userId && ObjectId.isValid(userId)) {
        query.userId = new ObjectId(userId)
      }

      // Cursor-based pagination: get posts older than cursor
      if (cursor) {
        const cursorDate = new Date(cursor)
        if (!isNaN(cursorDate.getTime())) {
          query.createdAt = { $lt: cursorDate }
        }
      }

      const posts = await collections.postsCollection
        .find(query)
        .sort({ createdAt: -1 })
        .limit(limit + 1) // Fetch one extra to check if there are more
        .toArray()

      const hasMore = posts.length > limit
      const items = posts.slice(0, limit)

      const nextCursor = hasMore && items.length > 0
        ? items[items.length - 1].createdAt.toISOString()
        : null

      // Get unread comment counts if userId filter is used (user viewing their own posts)
      let unreadCounts = {}
      if (userId && ObjectId.isValid(userId)) {
        const postIds = items.map(p => p._id)
        const unreads = await collections.postUnreadCommentsCollection
          .find({ postId: { $in: postIds }, userId: new ObjectId(userId) })
          .toArray()
        
        unreads.forEach(unread => {
          unreadCounts[unread.postId.toString()] = unread.count || 0
        })
      }

      // Fetch profile images for post authors
      const authorIds = [...new Set(items.map(post => post.userId.toString()))]
      const authorDocs = authorIds.length > 0
        ? await collections.usersCollection.find({ _id: { $in: authorIds.map(id => new ObjectId(id)) } }).toArray()
        : []

      const profileImageMap = new Map(
        authorDocs.map(user => [user._id.toString(), user.profileImageUrl || null])
      )

      return res.json({
        items: items.map((post) => ({
          _id: post._id.toString(),
          userId: post.userId.toString(),
          type: post.type || 'graph',
          title: post.title,
          description: post.description,
          exerciseId: post.exerciseId?.toString(),
          exerciseName: post.exerciseName,
          imageUrl: post.imageUrl,
          authorName: post.authorName,
          profileImageUrl: profileImageMap.get(post.userId.toString()) || null,
          chartType: post.chartType,
          metric: post.metric,
          dateRange: post.dateRange,
          dateMode: post.dateMode,
          specificDates: post.specificDates,
          graphConfig: post.graphConfig,
          createdAt: post.createdAt,
          likeCount: post.likeCount,
          commentCount: post.commentCount,
          unreadCommentCount: unreadCounts[post._id.toString()] || 0
        })),
        nextCursor
      })
    } catch (error) {
      console.error('Get posts error', error)
      return res.status(500).json({ message: 'Failed to fetch posts' })
    }
  })

  // GET /posts/new - Get new posts (newer than a timestamp)
  app.get('/posts/new', async (req, res) => {
    const after = req.query.after // ISO date string
    const limit = Math.min(parseInt(req.query.limit) || 20, 50)

    if (!after) {
      return res.status(400).json({ message: 'after parameter is required' })
    }

    try {
      const afterDate = new Date(after)
      if (isNaN(afterDate.getTime())) {
        return res.status(400).json({ message: 'Invalid after date format' })
      }

      // Get posts created after the given timestamp
      const posts = await collections.postsCollection
        .find({ createdAt: { $gt: afterDate } })
        .sort({ createdAt: 1 }) // Oldest first (so they can be prepended in order)
        .limit(limit)
        .toArray()

      const authorIds = [...new Set(posts.map(post => post.userId.toString()))]
      const authorDocs = authorIds.length > 0
        ? await collections.usersCollection.find({ _id: { $in: authorIds.map(id => new ObjectId(id)) } }).toArray()
        : []

      const profileImageMap = new Map(
        authorDocs.map(user => [user._id.toString(), user.profileImageUrl || null])
      )

      return res.json({
        count: posts.length,
        items: posts.map((post) => ({
          _id: post._id.toString(),
          userId: post.userId.toString(),
          type: post.type || 'graph',
          title: post.title,
          description: post.description,
          exerciseId: post.exerciseId?.toString(),
          exerciseName: post.exerciseName,
          imageUrl: post.imageUrl,
          authorName: post.authorName,
          profileImageUrl: profileImageMap.get(post.userId.toString()) || null,
          chartType: post.chartType,
          metric: post.metric,
          dateRange: post.dateRange,
          dateMode: post.dateMode,
          specificDates: post.specificDates,
          graphConfig: post.graphConfig,
          createdAt: post.createdAt,
          likeCount: post.likeCount,
          commentCount: post.commentCount
        }))
      })
    } catch (error) {
      console.error('Get new posts error', error)
      return res.status(500).json({ message: 'Failed to fetch new posts' })
    }
  })

  // GET /posts/:postId - Get single post
  app.get('/posts/:postId', async (req, res) => {
    const { postId } = req.params

    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid post ID' })
    }

    try {
      const post = await collections.postsCollection.findOne({ _id: new ObjectId(postId) })

      if (!post) {
        return res.status(404).json({ message: 'Post not found' })
      }

      const author = await collections.usersCollection.findOne({ _id: post.userId })

      return res.json({
        _id: post._id.toString(),
        userId: post.userId.toString(),
        type: post.type || 'graph',
        title: post.title,
        description: post.description,
        exerciseId: post.exerciseId?.toString(),
        exerciseName: post.exerciseName,
        imageUrl: post.imageUrl,
        authorName: post.authorName,
        profileImageUrl: author?.profileImageUrl || null,
        chartType: post.chartType,
        metric: post.metric,
        dateRange: post.dateRange,
        dateMode: post.dateMode,
        specificDates: post.specificDates,
        graphConfig: post.graphConfig,
        createdAt: post.createdAt,
        likeCount: post.likeCount,
        commentCount: post.commentCount
      })
    } catch (error) {
      console.error('Get post error', error)
      return res.status(500).json({ message: 'Failed to fetch post' })
    }
  })

  // GET /posts/:postId/chart-data - Get chart data for a post (public)
  app.get('/posts/:postId/chart-data', async (req, res) => {
    const { postId } = req.params

    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid post ID' })
    }

    try {
      // Get the post
      const post = await collections.postsCollection.findOne({ _id: new ObjectId(postId) })
      if (!post) {
        return res.status(404).json({ message: 'Post not found' })
      }

      // Image posts don't have chart data
      if (post.type === 'image' || !post.exerciseId) {
        return res.status(400).json({ message: 'This post does not have chart data' })
      }

      // Get all sets for this exercise (belonging to the post creator)
      const sets = await collections.setsCollection
        .find({ 
          exerciseId: post.exerciseId,
          userId: post.userId
        })
        .sort({ date: -1 })
        .toArray()

      // Group sets by groupId
      const groupMap = new Map()
      for (const set of sets) {
        const groupId = set.groupId?.toString() || set._id.toString()
        if (!groupMap.has(groupId)) {
          groupMap.set(groupId, {
            groupId,
            date: set.date,
            sets: []
          })
        }
        groupMap.get(groupId).sets.push({
          _id: set._id.toString(),
          weight: set.weight,
          reps: set.reps,
          isDropSet: set.isDropSet || false
        })
      }

      const groups = Array.from(groupMap.values())

      return res.json({
        exerciseId: post.exerciseId.toString(),
        exerciseName: post.exerciseName,
        groups
      })
    } catch (error) {
      console.error('Get post chart data error', error)
      return res.status(500).json({ message: 'Failed to fetch chart data' })
    }
  })

  // DELETE /posts/:postId - Delete own post
  app.delete('/posts/:postId', requireUser, async (req, res) => {
    const { postId } = req.params

    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid post ID' })
    }

    try {
      const result = await collections.postsCollection.deleteOne({
        _id: new ObjectId(postId),
        userId: req.userId
      })

      if (result.deletedCount === 0) {
        // Check if post exists but belongs to someone else
        const post = await collections.postsCollection.findOne({ _id: new ObjectId(postId) })
        if (post) {
          return res.status(403).json({ message: 'You can only delete your own posts' })
        }
        return res.status(404).json({ message: 'Post not found' })
      }

      // Also delete likes and comments for this post
      await collections.postLikesCollection.deleteMany({ postId: new ObjectId(postId) })
      await collections.postCommentsCollection.deleteMany({ postId: new ObjectId(postId) })

      return res.status(204).end()
    } catch (error) {
      console.error('Delete post error', error)
      return res.status(500).json({ message: 'Failed to delete post' })
    }
  })

  // ==================== GILLA-MARKERINGAR ====================

  /**
   * POST /posts/:postId/like - Gilla en post
   * En användare kan bara gilla en post en gång
   */
  app.post('/posts/:postId/like', requireUser, async (req, res) => {
    const { postId } = req.params

    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid post ID' })
    }

    try {
      // Check if post exists
      const post = await collections.postsCollection.findOne({ _id: new ObjectId(postId) })
      if (!post) {
        return res.status(404).json({ message: 'Post not found' })
      }

      // Check if already liked
      const existingLike = await collections.postLikesCollection.findOne({
        postId: new ObjectId(postId),
        userId: req.userId
      })

      if (existingLike) {
        return res.status(400).json({ message: 'Already liked' })
      }

      // Create like
      await collections.postLikesCollection.insertOne({
        postId: new ObjectId(postId),
        userId: req.userId,
        createdAt: new Date()
      })

      // Increment likeCount on post
      await collections.postsCollection.updateOne(
        { _id: new ObjectId(postId) },
        { $inc: { likeCount: 1 } }
      )

      const newCount = (post.likeCount || 0) + 1
      return res.status(201).json({ liked: true, likeCount: newCount })
    } catch (error) {
      console.error('Like post error', error)
      return res.status(500).json({ message: 'Failed to like post' })
    }
  })

  // DELETE /posts/:postId/like - Unlike a post
  app.delete('/posts/:postId/like', requireUser, async (req, res) => {
    const { postId } = req.params

    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid post ID' })
    }

    try {
      const result = await collections.postLikesCollection.deleteOne({
        postId: new ObjectId(postId),
        userId: req.userId
      })

      if (result.deletedCount === 0) {
        return res.status(400).json({ message: 'Not liked yet' })
      }

      // Decrement likeCount on post
      await collections.postsCollection.updateOne(
        { _id: new ObjectId(postId) },
        { $inc: { likeCount: -1 } }
      )

      const post = await collections.postsCollection.findOne({ _id: new ObjectId(postId) })
      const newCount = post?.likeCount || 0

      return res.json({ liked: false, likeCount: newCount })
    } catch (error) {
      console.error('Unlike post error', error)
      return res.status(500).json({ message: 'Failed to unlike post' })
    }
  })

  // GET /posts/:postId/like - Check if user has liked a post
  app.get('/posts/:postId/like', requireUser, async (req, res) => {
    const { postId } = req.params

    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid post ID' })
    }

    try {
      const like = await collections.postLikesCollection.findOne({
        postId: new ObjectId(postId),
        userId: req.userId
      })

      return res.json({ liked: !!like })
    } catch (error) {
      console.error('Check like error', error)
      return res.status(500).json({ message: 'Failed to check like status' })
    }
  })

  // ==================== KOMMENTARER ====================

  /**
   * GET /posts/:postId/comments - Hämta kommentarer för en post
   * Offentligt endpoint - kräver inte inloggning
   */
  app.get('/posts/:postId/comments', async (req, res) => {
    const { postId } = req.params

    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid post ID' })
    }

    try {
      const comments = await collections.postCommentsCollection
        .find({ postId: new ObjectId(postId) })
        .sort({ createdAt: 1 })
        .toArray()

      const authorIds = [...new Set(comments.map(comment => comment.userId.toString()))]
      const authorDocs = authorIds.length > 0
        ? await collections.usersCollection.find({ _id: { $in: authorIds.map(id => new ObjectId(id)) } }).toArray()
        : []

      const profileImageMap = new Map(
        authorDocs.map(user => [user._id.toString(), user.profileImageUrl || null])
      )

      return res.json({
        comments: comments.map(c => ({
          _id: c._id.toString(),
          postId: c.postId.toString(),
          userId: c.userId.toString(),
          authorName: c.authorName,
          profileImageUrl: profileImageMap.get(c.userId.toString()) || null,
          content: c.content,
          createdAt: c.createdAt
        }))
      })
    } catch (error) {
      console.error('Get comments error', error)
      return res.status(500).json({ message: 'Failed to fetch comments' })
    }
  })

  // POST /posts/:postId/comments - Add a comment
  app.post('/posts/:postId/comments', requireUser, async (req, res) => {
    const { postId } = req.params
    const { content } = req.body

    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid post ID' })
    }

    const trimmedContent = typeof content === 'string' ? content.trim() : ''
    if (!trimmedContent) {
      return res.status(400).json({ message: 'Comment content is required' })
    }

    if (trimmedContent.length > 500) {
      return res.status(400).json({ message: 'Comment must be 500 characters or less' })
    }

    try {
      // Check if post exists
      const post = await collections.postsCollection.findOne({ _id: new ObjectId(postId) })
      if (!post) {
        return res.status(404).json({ message: 'Post not found' })
      }

      // Get user info for author name
      const user = await collections.usersCollection.findOne({ _id: req.userId })
      const authorName = user?.fullName || user?.firstName || 'Okänd'

      const commentDoc = {
        postId: new ObjectId(postId),
        userId: req.userId,
        authorName,
        content: trimmedContent,
        createdAt: new Date()
      }

      const result = await collections.postCommentsCollection.insertOne(commentDoc)

      // Increment commentCount on post
      await collections.postsCollection.updateOne(
        { _id: new ObjectId(postId) },
        { $inc: { commentCount: 1 } }
      )

      // If commenter is not the post author, increment unread count
      if (post.userId.toString() !== req.userId.toString()) {
        await collections.postUnreadCommentsCollection.updateOne(
          { postId: new ObjectId(postId), userId: post.userId },
          { $inc: { count: 1 } },
          { upsert: true }
        )
      }

      // If commenter is not the post author, increment unread count
      if (post.userId.toString() !== req.userId.toString()) {
        await collections.postUnreadCommentsCollection.updateOne(
          { postId: new ObjectId(postId), userId: post.userId },
          { $inc: { count: 1 } },
          { upsert: true }
        )
      }

      return res.status(201).json({
        _id: result.insertedId.toString(),
        postId: commentDoc.postId.toString(),
        userId: commentDoc.userId.toString(),
        authorName: commentDoc.authorName,
        profileImageUrl: user?.profileImageUrl || null,
        content: commentDoc.content,
        createdAt: commentDoc.createdAt
      })
    } catch (error) {
      console.error('Add comment error', error)
      return res.status(500).json({ message: 'Failed to add comment' })
    }
  })

  // POST /posts/:postId/mark-read - Mark comments as read
  app.post('/posts/:postId/mark-read', requireUser, async (req, res) => {
    const { postId } = req.params

    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid post ID' })
    }

    try {
      // Delete the unread entry (sets count to 0)
      await collections.postUnreadCommentsCollection.deleteOne({
        postId: new ObjectId(postId),
        userId: req.userId
      })

      return res.json({ success: true })
    } catch (error) {
      console.error('Mark read error', error)
      return res.status(500).json({ message: 'Failed to mark as read' })
    }
  })

  // DELETE /posts/:postId/comments/:commentId - Delete own comment
  app.delete('/posts/:postId/comments/:commentId', requireUser, async (req, res) => {
    const { postId, commentId } = req.params

    if (!ObjectId.isValid(postId) || !ObjectId.isValid(commentId)) {
      return res.status(400).json({ message: 'Invalid ID' })
    }

    try {
      const result = await collections.postCommentsCollection.deleteOne({
        _id: new ObjectId(commentId),
        postId: new ObjectId(postId),
        userId: req.userId
      })

      if (result.deletedCount === 0) {
        // Check if comment exists but belongs to someone else
        const comment = await collections.postCommentsCollection.findOne({ _id: new ObjectId(commentId) })
        if (comment) {
          return res.status(403).json({ message: 'You can only delete your own comments' })
        }
        return res.status(404).json({ message: 'Comment not found' })
      }

      // Decrement commentCount on post
      await collections.postsCollection.updateOne(
        { _id: new ObjectId(postId) },
        { $inc: { commentCount: -1 } }
      )

      return res.status(204).end()
    } catch (error) {
      console.error('Delete comment error', error)
      return res.status(500).json({ message: 'Failed to delete comment' })
    }
  })
}
