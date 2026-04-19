export async function downloadPhoto(url: string, eventName: string, eventDate: string) {
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

    const date = new Date(eventDate).toISOString().split('T')[0];
    const safeEventName = eventName.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
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

function formatEventTime(eventDate: string) {
  const parsed = new Date(eventDate)
  if (Number.isNaN(parsed.getTime())) {
    return eventDate
  }

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
  }).format(parsed)
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

  const label = 'MFU PhotoFinder'
  const folderName = sanitizeText(eventName || 'Photo Folder')
  const timeText = formatEventTime(eventDate)

  const titleFontSize = Math.max(15, Math.round(canvas.width * 0.02))
  const bodyFontSize = Math.max(12, Math.round(canvas.width * 0.012))
  const badgeSize = Math.max(28, Math.round(canvas.width * 0.032))

  context.textAlign = 'left'
  context.textBaseline = 'alphabetic'

  context.fillStyle = 'rgba(255, 255, 255, 0.96)'
  context.font = `700 ${titleFontSize}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI"`
  context.fillText(label, padding, canvas.height - barHeight + padding + titleFontSize)

  context.font = `600 ${bodyFontSize}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI"`
  context.fillStyle = 'rgba(255, 255, 255, 0.9)'
  context.fillText(`Folder: ${folderName}`, padding, canvas.height - barHeight + padding + titleFontSize + Math.round(bodyFontSize * 1.25))
  context.fillText(`Date: ${timeText}`, padding, canvas.height - barHeight + padding + titleFontSize + Math.round(bodyFontSize * 2.25))

  const badgeX = canvas.width - padding - badgeSize
  const badgeY = canvas.height - padding - badgeSize
  context.beginPath()
  context.roundRect(badgeX, badgeY, badgeSize, badgeSize, badgeSize / 2)
  context.fillStyle = 'rgba(255, 255, 255, 0.16)'
  context.fill()

  context.fillStyle = 'rgba(255, 255, 255, 0.95)'
  context.font = `700 ${Math.max(12, Math.round(canvas.width * 0.014))}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI"`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText('PF', badgeX + badgeSize / 2, badgeY + badgeSize / 2 + 1)

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
