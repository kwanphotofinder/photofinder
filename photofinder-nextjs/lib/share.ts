export type PhotoShareVariant = "original" | "watermarked"
export type ShareChannel = "native" | "copy" | "line" | "whatsapp" | "facebook" | "x"

export interface SharePhotoInput {
  url: string
  eventName: string
  eventDate: string
}

function sanitizeFilePart(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase()
}

function buildFileName(photo: SharePhotoInput, variant: PhotoShareVariant) {
  const date = new Date(photo.eventDate).toISOString().split("T")[0]
  const base = sanitizeFilePart(photo.eventName || "photo")
  return `${base}_${date}_${variant}.jpg`
}

function buildShareText(photo: SharePhotoInput, variant: PhotoShareVariant) {
  const date = new Date(photo.eventDate).toLocaleDateString()
  const label = variant === "watermarked" ? "Watermarked photo" : "Photo"
  return `MFU PhotoFinder - ${label} from ${photo.eventName} (${date})`
}

function openShareWindow(url: string) {
  const popup = window.open(url, "_blank", "noopener,noreferrer")
  if (!popup) {
    throw new Error("Popup blocked")
  }
}


async function fetchImageBlob(url: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`)
  }
  return response.blob()
}

async function blobToImage(blob: Blob) {
  const objectUrl = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.crossOrigin = "anonymous"
    image.src = objectUrl
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error("Failed to load image for sharing"))
    })
    return image
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function createWatermarkedBlob(url: string, watermarkText: string) {
  const sourceBlob = await fetchImageBlob(url)
  const image = await blobToImage(sourceBlob)
  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d")

  if (!context) {
    throw new Error("Canvas is not supported")
  }

  canvas.width = image.naturalWidth || image.width
  canvas.height = image.naturalHeight || image.height

  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  const padding = Math.max(24, Math.round(canvas.width * 0.03))
  const barHeight = Math.max(72, Math.round(canvas.height * 0.12))
  const gradient = context.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height)
  gradient.addColorStop(0, "rgba(0, 0, 0, 0)")
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.72)")

  context.fillStyle = gradient
  context.fillRect(0, canvas.height - barHeight, canvas.width, barHeight)

  const logoSize = Math.max(28, Math.round(canvas.width * 0.035))
  const textX = padding
  const textY = canvas.height - padding - Math.round(logoSize * 0.2)

  context.fillStyle = "rgba(255, 255, 255, 0.96)"
  context.font = `700 ${Math.max(20, Math.round(canvas.width * 0.022))}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\"`
  context.fillText("MFU PhotoFinder", textX, textY - 18)

  context.font = `500 ${Math.max(14, Math.round(canvas.width * 0.014))}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\"`
  context.fillStyle = "rgba(255, 255, 255, 0.88)"
  context.fillText(watermarkText, textX, textY)

  context.beginPath()
  context.roundRect(canvas.width - padding - logoSize, canvas.height - padding - logoSize, logoSize, logoSize, 999)
  context.fillStyle = "rgba(255, 255, 255, 0.14)"
  context.fill()

  context.fillStyle = "rgba(255, 255, 255, 0.9)"
  context.font = `700 ${Math.max(16, Math.round(canvas.width * 0.018))}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\"`
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.fillText("PF", canvas.width - padding - logoSize / 2, canvas.height - padding - logoSize / 2 + 1)
  context.textAlign = "start"
  context.textBaseline = "alphabetic"

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to create watermarked image"))
        return
      }
      resolve(blob)
    }, "image/jpeg", 0.95)
  })
}


async function shareFile(file: File, fallbackUrl: string, fallbackFileName: string, shareText: string) {
  if (typeof navigator !== "undefined" && navigator.share) {
    const canShareFiles = typeof navigator.canShare === "function" ? navigator.canShare({ files: [file] }) : true
    if (canShareFiles) {
      await navigator.share({
        title: fallbackFileName,
        text: shareText,
        files: [file],
      })
      return true
    }

    try {
      await navigator.share({
        title: fallbackFileName,
        text: shareText,
        url: fallbackUrl,
      })
      return true
    } catch {
      // Fall through to clipboard / open-tab fallback.
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(fallbackUrl)
    return false
  }

  window.open(fallbackUrl, "_blank")
  return false
}

export async function sharePhotoToChannel(
  photo: SharePhotoInput,
  variant: PhotoShareVariant,
  channel: ShareChannel,
) {
  const shareText = buildShareText(photo, variant)
  const shareUrl = photo.url

  if (channel === "native") {
    if (variant === "watermarked") {
      return sharePhotoWatermarked(photo)
    }

    return sharePhotoOriginal(photo)
  }

  if (channel === "copy") {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`)
      return false
    }
    openShareWindow(shareUrl)
    return false
  }

  const encodedUrl = encodeURIComponent(shareUrl)
  const encodedText = encodeURIComponent(shareText)

  if (channel === "line") {
    openShareWindow(`https://social-plugins.line.me/lineit/share?url=${encodedUrl}&text=${encodedText}`)
    return false
  }

  if (channel === "whatsapp") {
    openShareWindow(`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`)
    return false
  }

  if (channel === "facebook") {
    openShareWindow(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`)
    return false
  }

  if (channel === "x") {
    openShareWindow(`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`)
    return false
  }

  throw new Error(`Unsupported share channel: ${channel}`)
}

export async function sharePhotoOriginal(photo: SharePhotoInput) {
  const fileName = buildFileName(photo, "original")
  const shareText = `Shared from MFU PhotoFinder - ${photo.eventName}`

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({
        title: fileName,
        text: shareText,
        url: photo.url,
      })
      return true
    } catch {
      // Fall through to clipboard / open-tab fallback.
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(photo.url)
    return false
  }

  window.open(photo.url, "_blank")
  return false
}

export async function sharePhotoWatermarked(photo: SharePhotoInput) {
  const fileName = buildFileName(photo, "watermarked")
  const shareText = `Shared from MFU PhotoFinder - ${photo.eventName}`

  try {
    const watermarkText = `${photo.eventName} • ${new Date(photo.eventDate).toLocaleDateString()}`
    const blob = await createWatermarkedBlob(photo.url, watermarkText)
    const file = new File([blob], fileName, { type: blob.type || "image/jpeg" })
    return shareFile(file, photo.url, fileName, shareText)
  } catch (error) {
    console.error("Failed to create watermarked share file:", error)
    return sharePhotoOriginal(photo)
  }
}
