export interface ChunkSession {
  uploadId: string
  fileName: string
  eventId: string
  uploaderId?: string
  totalChunks: number
  chunks: Map<number, Buffer>
  totalBytes: number
  createdAt: number
  lastUpdated: number
}

class ChunkUploadStore {
  private sessions = new Map<string, ChunkSession>()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Run cleanup every 10 minutes to remove abandoned upload sessions older than 30 minutes
    if (typeof setInterval !== "undefined") {
      this.cleanupInterval = setInterval(() => this.cleanup(), 10 * 60 * 1000)
      if (this.cleanupInterval.unref) {
        this.cleanupInterval.unref()
      }
    }
  }

  public getSession(uploadId: string): ChunkSession | undefined {
    return this.sessions.get(uploadId)
  }

  public getOrCreateSession(
    uploadId: string,
    fileName: string,
    eventId: string,
    totalChunks: number,
    uploaderId?: string
  ): ChunkSession {
    let session = this.sessions.get(uploadId)
    if (!session) {
      session = {
        uploadId,
        fileName,
        eventId,
        uploaderId,
        totalChunks,
        chunks: new Map<number, Buffer>(),
        totalBytes: 0,
        createdAt: Date.now(),
        lastUpdated: Date.now(),
      }
      this.sessions.set(uploadId, session)
    }
    return session
  }

  public addChunk(uploadId: string, chunkIndex: number, chunkBuffer: Buffer): {
    session: ChunkSession
    isComplete: boolean
  } {
    const session = this.sessions.get(uploadId)
    if (!session) {
      throw new Error(`Upload session ${uploadId} not found`)
    }

    if (!session.chunks.has(chunkIndex)) {
      session.chunks.set(chunkIndex, chunkBuffer)
      session.totalBytes += chunkBuffer.length
    }
    session.lastUpdated = Date.now()

    const isComplete = session.chunks.size === session.totalChunks
    return { session, isComplete }
  }

  public assembleFile(uploadId: string): Buffer {
    const session = this.sessions.get(uploadId)
    if (!session) {
      throw new Error(`Upload session ${uploadId} not found`)
    }

    if (session.chunks.size !== session.totalChunks) {
      throw new Error(
        `Cannot assemble file: received ${session.chunks.size}/${session.totalChunks} chunks`
      )
    }

    // Sort chunk indices from 0 to totalChunks - 1
    const orderedBuffers: Buffer[] = []
    for (let i = 0; i < session.totalChunks; i++) {
      const chunk = session.chunks.get(i)
      if (!chunk) {
        throw new Error(`Missing chunk index ${i} during assembly`)
      }
      orderedBuffers.push(chunk)
    }

    const assembled = Buffer.concat(orderedBuffers)
    return assembled
  }

  public deleteSession(uploadId: string) {
    this.sessions.delete(uploadId)
  }

  public getUploadedChunkIndices(uploadId: string): number[] {
    const session = this.sessions.get(uploadId)
    if (!session) return []
    return Array.from(session.chunks.keys()).sort((a, b) => a - b)
  }

  private cleanup() {
    const now = Date.now()
    const MAX_AGE = 30 * 60 * 1000 // 30 minutes
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastUpdated > MAX_AGE) {
        this.sessions.delete(id)
      }
    }
  }
}

// Global Singleton to survive hot reloads
const globalForChunkStore = globalThis as unknown as { chunkStore?: ChunkUploadStore }
export const chunkStore = globalForChunkStore.chunkStore ?? new ChunkUploadStore()
if (process.env.NODE_ENV !== "production") globalForChunkStore.chunkStore = chunkStore
