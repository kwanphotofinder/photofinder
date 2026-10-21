export interface ChunkUploadOptions {
  eventId: string
  chunkSize?: number // default 1MB
  maxRetries?: number // default 3
  onProgress?: (percent: number, currentChunk: number, totalChunks: number) => void
  onStatusChange?: (status: string) => void
}

export interface ChunkUploadResult {
  success: boolean
  photoId?: string
  storageUrl?: string
  status?: string
  message?: string
  error?: string
}

/**
 * Generate a consistent upload ID based on file metadata so resumed uploads map to the same session
 */
export function generateUploadId(file: File, eventId: string): string {
  const cleanName = file.name.replace(/[^a-zA-Z0-9_-]/g, "_")
  return `up_${cleanName}_${file.size}_${file.lastModified}_${eventId.slice(0, 8)}`
}

/**
 * Uploads a file using resumable chunking (slices into 1MB chunks)
 * Features:
 * - Checks server for already uploaded chunks to skip them
 * - Slices file and uploads each chunk
 * - Retries individual chunk failures automatically on network glitch
 * - Emits precise real-time progress percentages
 */
export async function uploadFileInChunks(
  file: File,
  options: ChunkUploadOptions
): Promise<ChunkUploadResult> {
  const {
    eventId,
    chunkSize = 1024 * 1024, // 1MB chunks
    maxRetries = 3,
    onProgress,
    onStatusChange,
  } = options

  const uploadId = generateUploadId(file, eventId)
  const totalChunks = Math.max(1, Math.ceil(file.size / chunkSize))
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null

  const headers: HeadersInit = {}
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  // 1. Query server to check which chunks are already uploaded
  let alreadyUploadedChunks: number[] = []
  try {
    const statusRes = await fetch(`/api/photos/upload/chunk?uploadId=${encodeURIComponent(uploadId)}`, {
      headers,
    })
    if (statusRes.ok) {
      const statusData = await statusRes.json()
      if (statusData.exists && Array.isArray(statusData.uploadedChunks)) {
        alreadyUploadedChunks = statusData.uploadedChunks
        onStatusChange?.(`Resuming from ${alreadyUploadedChunks.length}/${totalChunks} chunks...`)
      }
    }
  } catch (err) {
    // If status check fails, proceed starting from chunk 0
  }

  // 2. Upload missing chunks sequentially
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    if (alreadyUploadedChunks.includes(chunkIndex)) {
      const progressPercent = Math.round(((chunkIndex + 1) / totalChunks) * 100)
      onProgress?.(progressPercent, chunkIndex + 1, totalChunks)
      continue
    }

    const start = chunkIndex * chunkSize
    const end = Math.min(start + chunkSize, file.size)
    const chunkBlob = file.slice(start, end)

    const formData = new FormData()
    formData.append("uploadId", uploadId)
    formData.append("chunkIndex", String(chunkIndex))
    formData.append("totalChunks", String(totalChunks))
    formData.append("fileName", file.name)
    formData.append("eventId", eventId)
    formData.append("chunk", chunkBlob, `${file.name}.part${chunkIndex}`)

    // Retry loop for this specific chunk
    let attempt = 0
    let chunkSuccess = false
    let lastError: any = null
    let responseData: any = null

    while (attempt < maxRetries && !chunkSuccess) {
      attempt++
      try {
        if (attempt > 1) {
          onStatusChange?.(`Reconnecting... attempt ${attempt}/${maxRetries}`)
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)))
        }

        const res = await fetch("/api/photos/upload/chunk", {
          method: "POST",
          headers,
          body: formData,
        })

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}))
          throw new Error(errBody.error || `HTTP ${res.status}`)
        }

        responseData = await res.json()
        chunkSuccess = true

        const progressPercent = Math.round(((chunkIndex + 1) / totalChunks) * 100)
        onProgress?.(progressPercent, chunkIndex + 1, totalChunks)
      } catch (err: any) {
        lastError = err
        console.warn(`[ChunkUpload] Chunk ${chunkIndex} failed (attempt ${attempt}):`, err?.message)
      }
    }

    if (!chunkSuccess) {
      return {
        success: false,
        error: `Network disconnected while uploading part ${chunkIndex + 1}/${totalChunks}: ${
          lastError?.message || "Connection timed out"
        }`,
      }
    }

    // If this was the final chunk and server returned the completed photo
    if (chunkIndex === totalChunks - 1 && responseData?.status === "completed") {
      return {
        success: true,
        photoId: responseData.photoId,
        storageUrl: responseData.storageUrl,
        status: "completed",
        message: responseData.message,
      }
    }
  }

  return {
    success: true,
    status: "completed",
    message: "Uploaded successfully",
  }
}
