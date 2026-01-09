import { initializeApp } from 'firebase/app'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'

const firebaseConfig = {
  apiKey: "AIzaSyDMqilKKv2LNN7eyRYt3R0KcwAPQIA90wI",
  authDomain: "gymfeedp.firebaseapp.com",
  projectId: "gymfeedp",
  storageBucket: "gymfeedp.firebasestorage.app",
  messagingSenderId: "85621238030",
  appId: "1:85621238030:web:8be0db397b13a036a28f5f",
  measurementId: "G-67KX4FES12"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Storage
export const storage = getStorage(app)

/**
 * Upload an image to Firebase Storage
 * @param {File} file - The image file to upload
 * @param {string} folder - The folder path (e.g., 'profile-pictures', 'posts')
 * @param {string} fileName - Optional custom filename
 * @returns {Promise<string>} - The download URL of the uploaded image
 */
export async function uploadImage(file, folder = 'images', fileName = null) {
  if (!file) {
    throw new Error('No file provided')
  }

  // Validate file type
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!validTypes.includes(file.type)) {
    throw new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.')
  }

  // Validate file size (max 5MB)
  const maxSize = 5 * 1024 * 1024 // 5MB
  if (file.size > maxSize) {
    throw new Error('File too large. Maximum size is 5MB.')
  }

  // Generate unique filename if not provided
  const uniqueName = fileName || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  const extension = file.name.split('.').pop()
  const fullPath = `${folder}/${uniqueName}.${extension}`

  // Create reference and upload
  const storageRef = ref(storage, fullPath)
  const snapshot = await uploadBytes(storageRef, file)

  // Get download URL
  const downloadURL = await getDownloadURL(snapshot.ref)
  return downloadURL
}

/**
 * Upload a profile picture
 * @param {File} file - The image file
 * @param {string} userId - The user's ID
 * @returns {Promise<string>} - The download URL
 */
export async function uploadProfilePicture(file, userId) {
  return uploadImage(file, 'profile-pictures', userId)
}

/**
 * Upload a post image
 * @param {File} file - The image file
 * @param {string} postId - The post's ID (optional)
 * @returns {Promise<string>} - The download URL
 */
export async function uploadPostImage(file, postId = null) {
  const fileName = postId || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  return uploadImage(file, 'posts', fileName)
}

export default app
