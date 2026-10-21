import { convertHeicToJpeg } from "./heic-converter"

export interface ClientOptimizationOptions {
  maxDimension?: number // Maximum width or height in pixels (default: 2048)
  quality?: number      // Compression quality 0.0 - 1.0 (default: 0.85)
  format?: "image/webp" | "image/jpeg" // Preferred format (default: image/webp with jpeg fallback)
}

export interface OptimizationResult {
  file: File
  originalSize: number
  optimizedSize: number
  width: number
  height: number
  savingsPercent: number
}

/**
 * Checks if the browser canvas supports exporting to WebP
 */
function checkWebpSupport(): boolean {
  if (typeof document === "undefined") return false
  const canvas = document.createElement("canvas")
  canvas.width = 1
  canvas.height = 1
  return canvas.toDataURL("image/webp").indexOf("data:image/webp") === 0
}

let isWebpSupported: boolean | null = null

/**
 * Optimizes an image file on the client side before upload:
 * - Automatically converts HEIC/HEIF to JPEG
 * - Resizes dimensions to maxDimension (default: 2048px) maintaining aspect ratio
 * - Compresses to WebP (or JPEG fallback) at quality 0.85
 * - Drastically reduces upload bandwidth and prevents 413 "File too large" errors
 */
export async function optimizeImageOnClient(
  inputFile: File,
  options: ClientOptimizationOptions = {}
): Promise<File> {
  const {
    maxDimension = 2048,
    quality = 0.85,
    format = "image/webp",
  } = options

  // 1. If running outside the browser or not an image, return original
  if (typeof window === "undefined" || !inputFile.type.startsWith("image/") && !inputFile.name.match(/\.(heic|heif)$/i)) {
    return inputFile
  }

  const originalSize = inputFile.size

  try {
    // 2. Convert HEIC to JPEG if needed
    const file = await convertHeicToJpeg(inputFile)

    // 3. Load image into memory to read dimensions
    let width = 0
    let height = 0
    let imageSource: ImageBitmap | HTMLImageElement

    if (typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(file)
        width = bitmap.width
        height = bitmap.height
        imageSource = bitmap
      } catch {
        // Fallback to Image element if createImageBitmap fails on some formats
        imageSource = await loadImageElement(file)
        width = imageSource.naturalWidth || imageSource.width
        height = imageSource.naturalHeight || imageSource.height
      }
    } else {
      imageSource = await loadImageElement(file)
      width = imageSource.naturalWidth || imageSource.width
      height = imageSource.naturalHeight || imageSource.height
    }

    if (!width || !height) {
      return file
    }

    // 4. Calculate target dimensions (never upscale)
    let targetWidth = width
    let targetHeight = height

    if (width > maxDimension || height > maxDimension) {
      const scale = Math.min(maxDimension / width, maxDimension / height)
      targetWidth = Math.round(width * scale)
      targetHeight = Math.round(height * scale)
    } else if (file.size <= 1.5 * 1024 * 1024 && file.type === "image/webp") {
      // Already small enough WebP and within dimensions
      return file
    }

    // 5. Draw to canvas
    const canvas = document.createElement("canvas")
    canvas.width = targetWidth
    canvas.height = targetHeight

    const ctx = canvas.getContext("2d", { alpha: false })
    if (!ctx) {
      return file
    }

    // Enable high quality image smoothing
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = "high"

    // Fill white background for safety (JPEG/WebP transparency)
    ctx.fillStyle = "#FFFFFF"
    ctx.fillRect(0, 0, targetWidth, targetHeight)

    ctx.drawImage(imageSource, 0, 0, targetWidth, targetHeight)

    // Clean up bitmap if used
    if ("close" in imageSource && typeof imageSource.close === "function") {
      imageSource.close()
    }

    // 6. Export as Blob (WebP with JPEG fallback)
    if (isWebpSupported === null) {
      isWebpSupported = checkWebpSupport()
    }

    const preferredFormat = (format === "image/webp" && isWebpSupported) ? "image/webp" : "image/jpeg"
    const extension = preferredFormat === "image/webp" ? ".webp" : ".jpg"

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), preferredFormat, quality)
    })

    if (!blob) {
      return file
    }

    // If compressed version is somehow larger (extremely rare), keep smaller original
    if (blob.size >= originalSize && width <= maxDimension && height <= maxDimension) {
      return file
    }

    // Replace extension
    const baseName = file.name.replace(/\.[^/.]+$/, "")
    const optimizedFileName = `${baseName}${extension}`

    return new File([blob], optimizedFileName, {
      type: preferredFormat,
      lastModified: Date.now(),
    })
  } catch (error) {
    console.warn(`[ClientImageOptimizer] Could not optimize ${inputFile.name}, using original:`, error)
    return inputFile
  }
}

/**
 * Loads a File into an HTMLImageElement
 */
function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (err) => {
      URL.revokeObjectURL(url)
      reject(err)
    }
    img.src = url
  })
}

/**
 * Batch optimizes an array of files on the client with progress tracking
 */
export async function optimizeImagesOnClient(
  files: File[],
  options?: ClientOptimizationOptions,
  onProgress?: (progress: { current: number; total: number; fileName: string; currentFile: File }) => void
): Promise<File[]> {
  const optimizedFiles: File[] = []
  const total = files.length

  for (let i = 0; i < total; i++) {
    const rawFile = files[i]
    onProgress?.({ current: i + 1, total, fileName: rawFile.name, currentFile: rawFile })

    const optimized = await optimizeImageOnClient(rawFile, options)
    optimizedFiles.push(optimized)
  }

  return optimizedFiles
}
