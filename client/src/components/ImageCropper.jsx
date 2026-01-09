import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import './ImageCropper.css'

/**
 * Skapar en beskuren bild från originalbilden
 */
const createCroppedImage = async (imageSrc, pixelCrop, outputSize = 400) => {
  const image = new Image()
  image.src = imageSrc
  
  await new Promise((resolve) => {
    image.onload = resolve
  })

  const canvas = document.createElement('canvas')
  canvas.width = outputSize
  canvas.height = outputSize
  const ctx = canvas.getContext('2d')

  // Rita den beskurna delen av bilden på canvasen
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputSize,
    outputSize
  )

  // Konvertera canvas till blob
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        resolve(blob)
      },
      'image/jpeg',
      0.9
    )
  })
}

export default function ImageCropper({ 
  imageSrc, 
  onCropComplete, 
  onCancel,
  outputSize = 400 
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const onCropChange = useCallback((crop) => {
    setCrop(crop)
  }, [])

  const onZoomChange = useCallback((zoom) => {
    setZoom(zoom)
  }, [])

  const onCropAreaComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return
    
    setIsProcessing(true)
    try {
      const croppedBlob = await createCroppedImage(
        imageSrc, 
        croppedAreaPixels, 
        outputSize
      )
      onCropComplete(croppedBlob)
    } catch (error) {
      console.error('Error cropping image:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="image-cropper-overlay">
      <div className="image-cropper-modal">
        <div className="image-cropper-header">
          <h3>Beskär bild</h3>
          <p>Dra och zooma för att välja område (400×400 px)</p>
        </div>
        
        <div className="image-cropper-container">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={onCropAreaComplete}
            cropShape="rect"
            showGrid={true}
          />
        </div>

        <div className="image-cropper-controls">
          <label className="image-cropper-zoom-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="11" y1="8" x2="11" y2="14"/>
              <line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
            Zoom
          </label>
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="image-cropper-zoom-slider"
          />
        </div>

        <div className="image-cropper-actions">
          <button 
            type="button"
            className="image-cropper-btn image-cropper-btn--cancel"
            onClick={onCancel}
            disabled={isProcessing}
          >
            Avbryt
          </button>
          <button 
            type="button"
            className="image-cropper-btn image-cropper-btn--confirm"
            onClick={handleConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? 'Bearbetar...' : 'Använd bild'}
          </button>
        </div>
      </div>
    </div>
  )
}
