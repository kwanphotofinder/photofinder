export type PhotoShareVariant = "original" | "watermarked"

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

async function shareFile(file: File, fallbackUrl: string, fallbackFileName: string) {
  if (typeof navigator !== "undefined" && navigator.share) {
    const canShareFiles = typeof navigator.canShare === "function" ? navigator.canShare({ files: [file] }) : true
    if (canShareFiles) {
      await navigator.share({
        title: fallbackFileName,
        text: "Shared from MFU PhotoFinder",
        files: [file],
      })
      return true
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(fallbackUrl)
    return false
  }

  window.open(fallbackUrl, "_blank")
  return false
}

export async function sharePhotoOriginal(photo: SharePhotoInput) {
  const blob = await fetchImageBlob(photo.url)
  const fileName = buildFileName(photo, "original")
  const file = new File([blob], fileName, { type: blob.type || "image/jpeg" })
  return shareFile(file, photo.url, fileName)
}

export async function sharePhotoWatermarked(photo: SharePhotoInput) {
  const watermarkText = `${photo.eventName} • ${new Date(photo.eventDate).toLocaleDateString()}`
  const blob = await createWatermarkedBlob(photo.url, watermarkText)
  const fileName = buildFileName(photo, "watermarked")
  const file = new File([blob], fileName, { type: blob.type || "image/jpeg" })
  return shareFile(file, photo.url, fileName)
}
