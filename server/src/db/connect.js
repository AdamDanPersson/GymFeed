import { MongoClient } from 'mongodb'

export async function connectDb(MONGODB_URI, DB_NAME, collections) {
  const client = new MongoClient(MONGODB_URI)
  await client.connect()
  const db = client.db(DB_NAME)
  collections.usersCollection = db.collection('users')
  collections.workoutsCollection = db.collection('workouts')
  collections.exercisesCollection = db.collection('exercises')
  collections.workoutExercisesCollection = db.collection('workoutExercises')
  collections.setsCollection = db.collection('sets')
  collections.postsCollection = db.collection('posts')
  collections.postLikesCollection = db.collection('postLikes')
  collections.postCommentsCollection = db.collection('postComments')
  collections.postUnreadCommentsCollection = db.collection('postUnreadComments')

  const {
    usersCollection,
    workoutsCollection,
    exercisesCollection,
    workoutExercisesCollection,
    setsCollection,
    postsCollection,
    postLikesCollection,
    postCommentsCollection,
    postUnreadCommentsCollection
  } = collections

  await usersCollection.createIndex({ email: 1 }, { unique: true })
  await workoutsCollection.createIndex({ userId: 1, createdAt: -1 })
  await workoutsCollection.createIndex({ userId: 1, name: 1 }, { unique: true })
  await exercisesCollection.createIndex({ userId: 1, name: 1 })
  await workoutExercisesCollection.createIndex({ userId: 1, workoutId: 1, order: 1 })
  await workoutExercisesCollection.createIndex(
    { userId: 1, workoutId: 1, exerciseId: 1 },
    { unique: true }
  )
  await setsCollection.createIndex({ userId: 1, exerciseId: 1, date: -1 })
  await setsCollection.createIndex({ userId: 1, groupId: 1 })
  // Posts indexes
  await postsCollection.createIndex({ createdAt: -1 })
  await postsCollection.createIndex({ userId: 1, createdAt: -1 })
  await postsCollection.createIndex({ exerciseId: 1, createdAt: -1 })
  // PostLikes indexes
  await postLikesCollection.createIndex({ postId: 1, userId: 1 }, { unique: true })
  await postLikesCollection.createIndex({ postId: 1 })
  // PostComments indexes
  await postCommentsCollection.createIndex({ postId: 1, createdAt: 1 })
  await postCommentsCollection.createIndex({ userId: 1 })
  // PostUnreadComments indexes
  await postUnreadCommentsCollection.createIndex({ postId: 1, userId: 1 }, { unique: true })
  await postUnreadCommentsCollection.createIndex({ userId: 1 })
}
