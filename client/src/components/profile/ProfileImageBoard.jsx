/**
 * ProfileImageBoard - Hantering av användarens profilbild
 * 
 * Liknar Post-flödet för bilduppladdning, men är förenklad:
 * - Endast bilduppladdning
 * - Beskärning till kvadrat
 * - Export 200x200 px
 */

// ==================== IMPORTS ====================
// React hooks
import { useCallback, useEffect, useRef, useState } from 'react'

// API-funktioner
import { getStoredUser, getStoredUserId, updateProfileImage } from '../../lib/apiClient'

// Firebase för bilduppladdning
import { uploadProfilePicture } from '../../lib/firebase'

// Bildbeskärningskomponent
import ImageCropper from '../ImageCropper'

export default function ProfileImageBoard({ user, openProfileImageCreator, onUserUpdate }) {
  // ==================== STATE ====================
  const [isEditingProfileImage, setIsEditingProfileImage] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [isSavingProfileImage, setIsSavingProfileImage] = useState(false)
  const [error, setError] = useState('')

  // Cropper
  const [showCropper, setShowCropper] = useState(false)
  const [cropperImageSrc, setCropperImageSrc] = useState('')
  const fileInputRef = useRef(null)
  const profileBoardRef = useRef(null)

  const activeProfileImageUrl = user?.profileImageUrl || ''

  // ===== EFFEKT: Öppna profilbildsskapare från navigation =====
  useEffect(() => {
    if (openProfileImageCreator && user) {
      setIsEditingProfileImage(true)
      setTimeout(() => {
        profileBoardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [openProfileImageCreator, user])

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
    const croppedFile = new File([croppedBlob], 'profile-image.jpg', { type: 'image/jpeg' })
    setSelectedImage(croppedFile)

    const previewUrl = URL.createObjectURL(croppedBlob)
    setImagePreviewUrl(previewUrl)

    URL.revokeObjectURL(cropperImageSrc)
    setCropperImageSrc('')
    setShowCropper(false)
  }, [cropperImageSrc])

  /**
   * Hantera avbrytning av bildbeskärning
   * Rensar upp resurser och stänger beskäraren
   */
  const handleCropCancel = useCallback(() => {
    if (cropperImageSrc) {
      URL.revokeObjectURL(cropperImageSrc)
    }
    setCropperImageSrc('')
    setShowCropper(false)
  }, [cropperImageSrc])

  // Rensa förhandsvisnings-URL vid unmount eller byte av bild
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl)
      }
    }
  }, [imagePreviewUrl])

  // ==================== SPARA PROFILBILD ====================

  const handleSaveProfileImage = useCallback(async (e) => {
    e.preventDefault()
    setError('')

    if (!selectedImage) {
      setError('Välj en bild att ladda upp')
      return
    }

    const userId = getStoredUserId()
    if (!userId) {
      setError('Du måste logga in')
      return
    }

    setIsSavingProfileImage(true)

    try {
      setIsUploadingImage(true)
      const imageUrl = await uploadProfilePicture(selectedImage, userId)
      setIsUploadingImage(false)

      const updated = await updateProfileImage({ imageUrl })
      const resolvedUrl = updated?.profileImageUrl || imageUrl

      const storedUser = getStoredUser()
      const nextUser = storedUser ? { ...storedUser, profileImageUrl: resolvedUrl } : null
      if (nextUser) {
        localStorage.setItem('user', JSON.stringify(nextUser))
        onUserUpdate?.(nextUser)
      }

      // Reset form
      setSelectedImage(null)
      setImagePreviewUrl('')
      setIsEditingProfileImage(false)
    } catch (err) {
      console.error('Failed to update profile image:', err)
      setError(err.message || 'Något gick fel')
      setIsUploadingImage(false)
    } finally {
      setIsSavingProfileImage(false)
    }
  }, [onUserUpdate, selectedImage])

  const handleRemoveProfileImage = useCallback(async () => {
    setError('')

    const userId = getStoredUserId()
    if (!userId) {
      setError('Du måste logga in')
      return
    }

    setIsSavingProfileImage(true)
    try {
      await updateProfileImage({ imageUrl: null })

      const storedUser = getStoredUser()
      const nextUser = storedUser ? { ...storedUser, profileImageUrl: null } : null
      if (nextUser) {
        localStorage.setItem('user', JSON.stringify(nextUser))
        onUserUpdate?.(nextUser)
      }
    } catch (err) {
      console.error('Failed to remove profile image:', err)
      setError(err.message || 'Något gick fel')
    } finally {
      setIsSavingProfileImage(false)
    }
  }, [onUserUpdate])

  /**
   * Avbryt uppladdning av profilbild
   */
  const handleCancel = useCallback(() => {
    setSelectedImage(null)
    setImagePreviewUrl('')
    setError('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    setIsEditingProfileImage(false)
  }, [])

  // ==================== RENDER ====================
  if (!user) {
    return (
      <section ref={profileBoardRef} className="pass-menu" aria-label="Profilbild">
        <h2>Profilbild</h2>
        <p className="pass-menu__message">Du måste logga in för att uppdatera profilbild.</p>
      </section>
    )
  }

  return (
    <section ref={profileBoardRef} className="pass-menu" aria-label="Profilbild">
      {/* Image Cropper Modal */}
      {showCropper && cropperImageSrc && (
        <ImageCropper
          imageSrc={cropperImageSrc}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
          outputSize={200}
        />
      )}

      <h2>Profilbild</h2>
      {error && !isEditingProfileImage && (
        <p className="pass-menu__message pass-menu__message--error">{error}</p>
      )}

      <div className="pass-menu__board pass-menu__board--post">
        <div
          className={`pass-tile pass-tile--saved pass-tile--post ${activeProfileImageUrl ? 'pass-tile--image' : ''}`}
          style={activeProfileImageUrl ? {
            backgroundImage: `url(${activeProfileImageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          } : {}}
        >
          <div className="pass-tile__actions">
            <button
              type="button"
              className="pass-tile__delete-btn"
              onClick={handleRemoveProfileImage}
              disabled={!activeProfileImageUrl || isSavingProfileImage}
              aria-label="Ta bort profilbild"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
          </div>

          <div className="pass-tile__content">
            <h3>{activeProfileImageUrl ? 'Aktiv profilbild' : 'Ingen profilbild'}</h3>
            <span className="pass-tile__type-badge">{activeProfileImageUrl ? 'Aktiv' : 'Saknas'}</span>
          </div>
        </div>

        <button
          type="button"
          className="pass-tile pass-tile--add"
          onClick={() => setIsEditingProfileImage(true)}
          aria-label="Lägg till profilbild"
          disabled={isEditingProfileImage}
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>

      {isEditingProfileImage && (
        <div className="post-creator">
          <div className="post-creator__header">
            <h3>Ny profilbild</h3>
            <button
              type="button"
              className="post-creator__close"
              onClick={handleCancel}
              aria-label="Stäng profilbildsformulär"
            >
              ✕
            </button>
          </div>

          <form className="post-creator__form" onSubmit={handleSaveProfileImage}>
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
                <span className="post-creator__file-hint">Max 5MB. JPEG eller PNG rekommenderas.</span>
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

            <div className="post-creator__actions">
              <button
                type="button"
                className="post-creator__cancel"
                onClick={handleCancel}
                disabled={isSavingProfileImage || isUploadingImage}
              >
                Avbryt
              </button>
              <button
                type="submit"
                className="post-creator__submit"
                disabled={!selectedImage || isSavingProfileImage || isUploadingImage}
              >
                {isUploadingImage ? 'Laddar upp...' : isSavingProfileImage ? 'Sparar...' : 'Spara profilbild'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
