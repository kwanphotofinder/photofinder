import JSZip from "jszip"

let cachedLogosPromise: Promise<[HTMLImageElement, HTMLImageElement]> | null = null

function getLogos() {
  if (!cachedLogosPromise) {
    cachedLogosPromise = Promise.all([
      loadAssetImage('/Logo.png'),
      loadAssetImage('/Logo2.png'),
    ]).catch((err) => {
      cachedLogosPromise = null
      throw err
    })
  }
  return cachedLogosPromise
}

export async function downloadPhotosAsZip(
  photos: Array<{ url: string; eventName?: string; eventDate?: string; uploadDate?: string; id?: string }>,
  zipFilename = "photofinder_selected_photos.zip",
  onProgress?: (percent: number, current: number, total: number) => void
) {
  if (!photos.length) return

  const zip = new JSZip()
  const folder = zip.folder("photos") || zip
  const total = photos.length

  for (let i = 0; i < total; i++) {
    const photo = photos[i]
    try {
      const response = await fetch(photo.url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const blob = await response.blob()

      let fileBlob: Blob = blob
      try {
        const image = await loadImage(blob)
        fileBlob = await createWatermarkedBlob(
          image,
          photo.eventName || "PhotoFinder",
          photo.eventDate || photo.uploadDate || new Date().toISOString()
        )
      } catch (watermarkErr) {
        console.warn(`Failed to watermark photo ${i + 1}, using original image:`, watermarkErr)
        fileBlob = blob
      }

      const safeEvent = (photo.eventName || "photo")
        .replace(/[^a-zA-Z0-9_\u0E00-\u0E7F-]+/g, "_")
        .replace(/_+/g, "_")
        .slice(0, 30)
      const dateVal = photo.uploadDate || photo.eventDate
      const dateStr = dateVal ? new Date(dateVal).toISOString().split("T")[0] : `photo`
      const ext = "jpg"
      const fileName = `${safeEvent || "photo"}_${dateStr}_${i + 1}.${ext}`

      folder.file(fileName, fileBlob)
      if (onProgress) {
        onProgress(Math.round(((i + 1) / total) * 80), i + 1, total)
      }
    } catch (err) {
      console.warn(`Failed to fetch photo for zip: ${photo.url}`, err)
    }
  }

  if (onProgress) {
    onProgress(85, total, total)
  }

  const content = await zip.generateAsync({ type: "blob" }, (metadata) => {
    if (onProgress) {
      onProgress(85 + Math.round(metadata.percent * 0.15), total, total)
    }
  })

  const link = document.createElement("a")
  const url = URL.createObjectURL(content)
  link.href = url
  link.download = zipFilename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  if (onProgress) {
    onProgress(100, total, total)
  }
}

export async function downloadPhoto(url: string, eventName: string, eventDate: string, _photoId?: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch photo: ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      throw new Error(`Unexpected content type: ${contentType || 'unknown'}`);
    }

    const blob = await response.blob();
    const image = await loadImage(blob)
    const watermarkedBlob = await createWatermarkedBlob(image, eventName, eventDate)
    const blobUrl = window.URL.createObjectURL(watermarkedBlob);
    const a = document.createElement('a');
    a.href = blobUrl;

    const parsedDate = eventDate ? new Date(eventDate) : new Date();
    const date = (!Number.isNaN(parsedDate.getTime()) ? parsedDate : new Date()).toISOString().split('T')[0];
    const safeEventName = (eventName || 'photo')
      .replace(/[^a-zA-Z0-9_\u0E00-\u0E7F-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    a.download = `${safeEventName || 'photo'}_${date}.jpg`;

    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(blobUrl);
    document.body.removeChild(a);
  } catch (err) {
    console.error('Failed to download photo:', err);
    alert('Unable to download automatically. Opening photo in new tab...');
    // Fallback to opening in new tab
    window.open(url, '_blank');
  }
}

function sanitizeText(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\p{P}\p{S} ]/gu, '')
}

function formatDayMonthYear(eventDate: string) {
  const parsed = new Date(eventDate)
  if (Number.isNaN(parsed.getTime())) {
    return eventDate
  }

  const day = String(parsed.getDate()).padStart(2, '0')
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const year = parsed.getFullYear()
  return `${day}/${month}/${year}`
}

function loadAssetImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Failed to load watermark asset: ${src}`))
    image.src = src
  })
}

function getContainedSize(image: HTMLImageElement, maxWidth: number, maxHeight: number) {
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  const scale = Math.min(maxWidth / width, maxHeight / height)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

async function loadImage(blob: Blob) {
  const objectUrl = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.src = objectUrl
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Failed to load image for download'))
    })
    return image
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function createWatermarkedBlob(image: HTMLImageElement, eventName: string, eventDate: string) {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Canvas is not supported')
  }

  canvas.width = image.naturalWidth || image.width
  canvas.height = image.naturalHeight || image.height

  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  const padding = Math.max(15, Math.round(canvas.width * 0.024))
  const barHeight = Math.max(92, Math.round(canvas.height * 0.13))
  const gradient = context.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height)
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)')
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.78)')

  context.fillStyle = gradient
  context.fillRect(0, canvas.height - barHeight, canvas.width, canvas.height)

  const folderName = sanitizeText(eventName || 'Photo Folder')
  const timeText = eventDate ? formatDayMonthYear(eventDate) : formatDayMonthYear(new Date().toISOString())
  const infoText = `${timeText} ● ${folderName}`

  const logoMaxHeight = Math.max(72, Math.round(canvas.height * 0.12))
  const logoMaxWidth = Math.max(220, Math.round(canvas.width * 0.22))
  const universitySize = Math.max(72, Math.round(canvas.height * 0.12))

  const [photoFinderLogo, universityLogo] = await getLogos()

  const leftLogoSize = getContainedSize(photoFinderLogo, logoMaxWidth, logoMaxHeight)
  const leftLogoX = padding
  const bodyFontSize = Math.max(16, Math.round(canvas.width * 0.018))
  const leftLogoY = canvas.height - padding - leftLogoSize.height
  context.drawImage(photoFinderLogo, leftLogoX, leftLogoY, leftLogoSize.width, leftLogoSize.height)

  context.textAlign = 'left'
  context.textBaseline = 'middle'
  context.fillStyle = 'rgba(255, 255, 255, 0.96)'
  context.font = `600 ${bodyFontSize}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI"`
  const infoX = leftLogoX + leftLogoSize.width + Math.max(12, Math.round(canvas.width * 0.012))
  const infoY = leftLogoY + leftLogoSize.height / 2
  context.fillText(infoText, infoX, infoY)

  const universityLogoSize = getContainedSize(universityLogo, universitySize, universitySize)
  const universityX = canvas.width - padding - universityLogoSize.width
  const universityY = canvas.height - padding - universityLogoSize.height
  context.drawImage(universityLogo, universityX, universityY, universityLogoSize.width, universityLogoSize.height)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((outputBlob) => {
      if (!outputBlob) {
        reject(new Error('Failed to create watermarked image'))
        return
      }

      resolve(outputBlob)
    }, 'image/jpeg', 0.95)
  })
}
