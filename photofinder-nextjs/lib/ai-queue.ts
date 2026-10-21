import prisma from "@/lib/prisma"
import { extractFaces } from "@/lib/ai"
import { deleteFromCloudinary } from "@/lib/cloudinary"

export interface QueueJob {
  photoId: string
  storageUrl: string
  imageBuffer?: Buffer
  fileName?: string
  retries?: number
  enqueuedAt: number
}

interface QueueStats {
  queued: number
  processing: number
  completed: number
  failed: number
  concurrencyLimit: number
}

class AiProcessingQueue {
  private queue: QueueJob[] = []
  private activeWorkers = 0
  private concurrencyLimit = 2 // Process up to 2 photos concurrently to avoid CPU throttling
  private isDraining = false
  private isInitialized = false

  constructor() {
    // Start background processor
    this.startWorker()
  }

  /**
   * Set concurrency limit (e.g. 2 for single-core/low-spec, 4 for multi-core)
   */
  public setConcurrency(limit: number) {
    this.concurrencyLimit = Math.max(1, Math.min(10, limit))
  }

  /**
   * Enqueue a photo for asynchronous face recognition processing
   */
  public async enqueue(job: Omit<QueueJob, "enqueuedAt">) {
    const fullJob: QueueJob = {
      ...job,
      retries: job.retries ?? 0,
      enqueuedAt: Date.now(),
    }

    this.queue.push(fullJob)
    this.processNext()
  }

  /**
   * Enqueue multiple photos in batch
   */
  public async enqueueBatch(jobs: Array<Omit<QueueJob, "enqueuedAt">>) {
    for (const job of jobs) {
      await this.enqueue(job)
    }
  }

  /**
   * Recover any pending photos from PostgreSQL database that were not completed
   * (e.g. after a server restart or deployment)
   */
  public async recoverPendingPhotos() {
    if (this.isInitialized) return
    this.isInitialized = true

    try {
      const pendingPhotos = await prisma.photo.findMany({
        where: { processingStatus: { in: ["PENDING", "PROCESSING"] } },
        select: { id: true, storageUrl: true },
        take: 100,
        orderBy: { createdAt: "asc" },
      })

      if (pendingPhotos.length > 0) {
        console.log(`[AI Queue] Recovering ${pendingPhotos.length} pending photos from database...`)
        for (const p of pendingPhotos) {
          // Avoid duplicate enqueuing
          if (!this.queue.some((j) => j.photoId === p.id)) {
            this.queue.push({
              photoId: p.id,
              storageUrl: p.storageUrl,
              retries: 0,
              enqueuedAt: Date.now(),
            })
          }
        }
        this.processNext()
      }
    } catch (err) {
      console.error("[AI Queue] Failed to recover pending photos:", err)
    }
  }

  /**
   * Get real-time queue health & progress statistics
   */
  public async getStats(): Promise<QueueStats> {
    let completed = 0
    let failed = 0

    try {
      const counts = await prisma.photo.groupBy({
        by: ["processingStatus"],
        _count: true,
      })

      for (const c of counts) {
        if (c.processingStatus === "COMPLETED") completed = c._count
        if (c.processingStatus === "FAILED") failed = c._count
      }
    } catch {
      // Fallback
    }

    return {
      queued: this.queue.length,
      processing: this.activeWorkers,
      completed,
      failed,
      concurrencyLimit: this.concurrencyLimit,
    }
  }

  /**
   * Main dispatch loop
   */
  private async processNext() {
    if (this.activeWorkers >= this.concurrencyLimit) return
    if (this.queue.length === 0) return

    const job = this.queue.shift()
    if (!job) return

    this.activeWorkers++

    // Process job in background without awaiting here
    this.executeJob(job)
      .catch((err) => {
        console.error(`[AI Queue] Unexpected error in job ${job.photoId}:`, err)
      })
      .finally(() => {
        this.activeWorkers--
        // Trigger next job in queue
        this.processNext()
      })
  }

  /**
   * Process a single photo job: extract faces, insert embeddings into pgvector
   */
  private async executeJob(job: QueueJob) {
    const { photoId, storageUrl } = job

    try {
      // Mark as PROCESSING in database
      await prisma.photo.update({
        where: { id: photoId },
        data: { processingStatus: "PROCESSING" },
      })

      let buffer = job.imageBuffer

      // If buffer was not retained in memory (e.g. recovered job), fetch from storageUrl
      if (!buffer) {
        const res = await fetch(storageUrl)
        if (!res.ok) throw new Error(`Failed to fetch image from ${storageUrl}`)
        const arrayBuf = await res.arrayBuffer()
        buffer = Buffer.from(arrayBuf)
      }

      // Send to AI Service
      const faces = await extractFaces(buffer, job.fileName || `photo_${photoId}.webp`)

      if (!faces || faces.length === 0) {
        // No faces detected; clean up photo to preserve storage
        console.log(`[AI Queue] Photo ${photoId} had no faces detected. Cleaning up storage...`)
        try {
          if (storageUrl && storageUrl.includes("cloudinary")) {
            await deleteFromCloudinary(storageUrl)
          }
          await prisma.photo.delete({ where: { id: photoId } })
        } catch {
          // Ignore deletion error
        }
        return
      }

      // Insert face embeddings with pgvector
      for (const face of faces) {
        const vectorString = `[${face.embedding.join(",")}]`
        await prisma.$executeRawUnsafe(
          `
          INSERT INTO "faces" ("id", "photoId", "confidence", "x", "y", "w", "h", "embedding")
          VALUES (
            gen_random_uuid(), 
            $1, 
            $2, 
            $3, 
            $4, 
            $5, 
            $6, 
            $7::vector
          )
        `,
          photoId,
          face.det_score,
          face.bbox[0],
          face.bbox[1],
          face.bbox[2] - face.bbox[0],
          face.bbox[3] - face.bbox[1],
          vectorString
        )
      }

      // Mark COMPLETED
      await prisma.photo.update({
        where: { id: photoId },
        data: { processingStatus: "COMPLETED" },
      })

      console.log(`[AI Queue] Successfully processed photo ${photoId} (${faces.length} faces indexed)`)
    } catch (error: any) {
      console.warn(`[AI Queue] AI processing failed for photo ${photoId}:`, error?.message || error)

      // Retry logic: retry up to 2 times with a slight delay
      if ((job.retries ?? 0) < 2) {
        console.log(`[AI Queue] Re-enqueuing photo ${photoId} (attempt ${(job.retries ?? 0) + 2}/3)...`)
        setTimeout(() => {
          this.queue.push({
            ...job,
            retries: (job.retries ?? 0) + 1,
          })
          this.processNext()
        }, 3000)
      } else {
        // Exceeded retries, mark FAILED
        await prisma.photo.update({
          where: { id: photoId },
          data: { processingStatus: "FAILED" },
        }).catch(() => {})
      }
    }
  }

  private startWorker() {
    // Check pending recovery after short startup delay
    setTimeout(() => {
      this.recoverPendingPhotos()
    }, 2000)
  }
}

// Global Singleton instance
const globalForAiQueue = globalThis as unknown as { aiQueue?: AiProcessingQueue }
export const aiQueue = globalForAiQueue.aiQueue ?? new AiProcessingQueue()
if (process.env.NODE_ENV !== "production") globalForAiQueue.aiQueue = aiQueue
