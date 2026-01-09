/**
 * Firebase Konfiguration och Bilduppladdning
 * 
 * Denna modul hanterar all integration med Firebase, specifikt:
 * - Initiering av Firebase-appen
 * - Uppladdning av bilder till Firebase Storage
 * - Hjälpfunktioner för profilbilder och postbilder
 * 
 * Firebase Storage används för att lagra användaruppladdade bilder
 * såsom profilbilder och bilder i poster.
 */

// ==================== IMPORTS ====================
import { initializeApp } from 'firebase/app'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'

// ==================== KONFIGURATION ====================
/**
 * Firebase-projektets konfiguration
 * Dessa värden hämtas från Firebase Console
 * OBS: API-nyckeln är säker att exponera i frontend-kod
 * då Firebase-säkerhetsregler hanterar behörigheter
 */
const firebaseConfig = {
  apiKey: "AIzaSyDMqilKKv2LNN7eyRYt3R0KcwAPQIA90wI",
  authDomain: "gymfeedp.firebaseapp.com",
  projectId: "gymfeedp",
  storageBucket: "gymfeedp.firebasestorage.app",
  messagingSenderId: "85621238030",
  appId: "1:85621238030:web:8be0db397b13a036a28f5f",
  measurementId: "G-67KX4FES12"
}

// ==================== INITIERING ====================
// Initiera Firebase-appen med konfigurationen
const app = initializeApp(firebaseConfig)

// Initiera Storage-tjänsten för bilduppladdning
export const storage = getStorage(app)

// ==================== KONSTANTER ====================
// Tillåtna bildformat
const VALID_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
// Maximal filstorlek (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024

// ==================== HJÄLPFUNKTIONER ====================

/**
 * Genererar ett unikt filnamn baserat på tidstämpel och slumpmässig sträng
 * @returns {string} Unikt filnamn utan filändelse
 */
function generateUniqueFileName() {
  const timestamp = Date.now()
  const randomString = Math.random().toString(36).substring(2, 9)
  return `${timestamp}-${randomString}`
}

// ==================== UPPLADDNINGSFUNKTIONER ====================

/**
 * Ladda upp en bild till Firebase Storage
 * 
 * Funktionen validerar filtyp och storlek innan uppladdning.
 * Efter lyckad uppladdning returneras en publik URL.
 * 
 * @param {File} file - Bildfilen som ska laddas upp
 * @param {string} folder - Mapp i Storage (t.ex. 'profile-pictures', 'posts')
 * @param {string} [fileName] - Valfritt anpassat filnamn (annars genereras ett unikt)
 * @returns {Promise<string>} Publik URL till den uppladdade bilden
 * @throws {Error} Om filen saknas, har fel typ eller är för stor
 * 
 * @example
 * const url = await uploadImage(file, 'posts', 'my-image')
 * // Returnerar: 'https://firebasestorage.googleapis.com/...'
 */
export async function uploadImage(file, folder = 'images', fileName = null) {
  // Validera att fil finns
  if (!file) {
    throw new Error('No file provided')
  }

  // Validera filtyp - endast bilder tillåts
  if (!VALID_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.')
  }

  // Validera filstorlek - max 5MB
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File too large. Maximum size is 5MB.')
  }

  // Generera unikt filnamn om inget anges
  const uniqueName = fileName || generateUniqueFileName()
  const extension = file.name.split('.').pop()
  const fullPath = `${folder}/${uniqueName}.${extension}`

  // Skapa referens till lagringsplatsen och ladda upp filen
  const storageRef = ref(storage, fullPath)
  const snapshot = await uploadBytes(storageRef, file)

  // Hämta och returnera publik nedladdnings-URL
  const downloadURL = await getDownloadURL(snapshot.ref)
  return downloadURL
}

/**
 * Ladda upp en profilbild för en användare
 * 
 * Profilbilder sparas i mappen 'profile-pictures' med användarens ID
 * som filnamn. Detta innebär att gamla profilbilder automatiskt
 * skrivs över vid uppdatering.
 * 
 * @param {File} file - Bildfilen
 * @param {string} userId - Användarens unika ID
 * @returns {Promise<string>} URL till profilbilden
 */
export async function uploadProfilePicture(file, userId) {
  return uploadImage(file, 'profile-pictures', userId)
}

/**
 * Ladda upp en bild för en post i flödet
 * 
 * Postbilder sparas i mappen 'posts'. Om inget postId anges
 * genereras ett unikt filnamn automatiskt.
 * 
 * @param {File} file - Bildfilen
 * @param {string} [postId] - Valfritt post-ID som filnamn
 * @returns {Promise<string>} URL till den uppladdade bilden
 */
export async function uploadPostImage(file, postId = null) {
  const fileName = postId || generateUniqueFileName()
  return uploadImage(file, 'posts', fileName)
}

// Exportera Firebase-appen som default
export default app
