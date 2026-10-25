import prisma from "@/lib/prisma"
import { extractFaces } from "@/lib/ai"
import { deleteFromCloudinary } from "@/lib/cloudinary"

export type QueuePriority = "HIGH" | "NORMAL" | "LOW"

export interface QueueJob {
  photoId: string
  storageUrl: string
  imageBuffer?: Buffer
  fileName?: string
  retries?: number
  enqueuedAt: number
  priority?: QueuePriority
}

interface QueueStats {
  queued: number
  highPriorityQueued: number
  normalPriorityQueued: number
  lowPriorityQueued: number
  processing: number
  completed: number
  failed: number
  concurrencyLimit: number
}

class AiProcessingQueue {
  private highQueue: QueueJob[] = []
  private normalQueue: QueueJob[] = []
  private lowQueue: QueueJob[] = []
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
   * Enqueue a photo with priority
   * - HIGH: Urgent / VIP / User re-try
   * - NORMAL: Single photo uploads (default)
   * - LOW: Batch uploads / Photographer bulk albums / DB recovery
   */
  public async enqueue(job: Omit<QueueJob, "enqueuedAt">, priority: QueuePriority = "NORMAL") {
    const jobPriority = job.priority ?? priority
    const fullJob: QueueJob = {
      ...job,
      priority: jobPriority,
      retries: job.retries ?? 0,
      enqueuedAt: Date.now(),
    }

    if (jobPriority === "HIGH") {
      this.highQueue.push(fullJob)
      console.log(`[AI Queue] Enqueued HIGH priority job: ${fullJob.photoId}`)
    } else if (jobPriority === "LOW") {
      this.lowQueue.push(fullJob)
    } else {
      this.normalQueue.push(fullJob)
    }

    this.processNext()
  }

  /**
   * Enqueue multiple photos in batch (defaults to LOW priority)
   */
  public async enqueueBatch(jobs: Array<Omit<QueueJob, "enqueuedAt">>, priority: QueuePriority = "LOW") {
    for (const job of jobs) {
      await this.enqueue(job, priority)
    }
  }

  /**
   * Check if a photo is currently waiting in any priority queue
   */
  public isQueued(photoId: string): boolean {
    return (
      this.highQueue.some((j) => j.photoId === photoId) ||
      this.normalQueue.some((j) => j.photoId === photoId) ||
      this.lowQueue.some((j) => j.photoId === photoId)
    )
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
        console.log(`[AI Queue] Recovering ${pendingPhotos.length} pending photos from database (LOW priority)...`)
        for (const p of pendingPhotos) {
          // Avoid duplicate enqueuing
          if (!this.isQueued(p.id)) {
            this.lowQueue.push({
              photoId: p.id,
              storageUrl: p.storageUrl,
              retries: 0,
              priority: "LOW",
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
      queued: this.highQueue.length + this.normalQueue.length + this.lowQueue.length,
      highPriorityQueued: this.highQueue.length,
      normalPriorityQueued: this.normalQueue.length,
      lowPriorityQueued: this.lowQueue.length,
      processing: this.activeWorkers,
      completed,
      failed,
      concurrencyLimit: this.concurrencyLimit,
    }
  }

  /**
   * Pull the next highest priority job:
   * 1. HIGH priority (User action / retry / VIP)
   * 2. NORMAL priority (Single photo upload)
   * 3. LOW priority (Batch upload / DB recovery)
   */
  private getNextJob(): QueueJob | undefined {
    if (this.highQueue.length > 0) return this.highQueue.shift()
    if (this.normalQueue.length > 0) return this.normalQueue.shift()
    return this.lowQueue.shift()
  }

  /**
   * Main dispatch loop
   */
  private async processNext() {
    if (this.activeWorkers >= this.concurrencyLimit) return

    const job = this.getNextJob()
    if (!job) return

    this.activeWorkers++

    // Process job in background without awaiting here
    this.executeJob(job)
      .catch((err) => {
        console.error(`[AI Queue] Unexpected error in job ${job.photoId}:`, err)
      })
      .finally(() => {
        this.activeWorkers--
        // Trigger next job in queue (will prioritize HIGH jobs if any arrived)
        this.processNext()
      })
  }

  /**
   * Process a single photo job: extract faces, insert embeddings into pgvector
   */
  private async executeJob(job: QueueJob) {
    const { photoId, storageUrl, priority = "NORMAL" } = job

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

      console.log(`[AI Queue] Successfully processed [${priority}] photo ${photoId} (${faces.length} faces indexed)`)
    } catch (error: any) {
      console.warn(`[AI Queue] AI processing failed for photo ${photoId}:`, error?.message || error)

      // Retry logic: retry up to 2 times with a slight delay
      if ((job.retries ?? 0) < 2) {
        console.log(`[AI Queue] Re-enqueuing photo ${photoId} (attempt ${(job.retries ?? 0) + 2}/3, priority: ${priority})...`)
        setTimeout(() => {
          this.enqueue(
            {
              ...job,
              retries: (job.retries ?? 0) + 1,
            },
            priority
          )
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
