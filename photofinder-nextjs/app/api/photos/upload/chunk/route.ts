import { NextRequest, NextResponse } from "next/server"
import { chunkStore } from "@/lib/chunk-store"
import { getUserFromRequest } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { optimizeForStorage } from "@/lib/image"
import { uploadToCloudinary } from "@/lib/cloudinary"
import { aiQueue } from "@/lib/ai-queue"

export const maxDuration = 180

// GET: Query status of an upload session to resume missing chunks
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const uploadId = searchParams.get("uploadId")

    if (!uploadId) {
      return NextResponse.json({ error: "uploadId is required" }, { status: 400 })
    }

    const session = chunkStore.getSession(uploadId)
    if (!session) {
      return NextResponse.json({ exists: false, uploadedChunks: [] })
    }

    const uploadedChunks = chunkStore.getUploadedChunkIndices(uploadId)
    return NextResponse.json({
      exists: true,
      uploadId,
      fileName: session.fileName,
      totalChunks: session.totalChunks,
      uploadedChunks,
      uploadedCount: uploadedChunks.length,
    })
  } catch (error) {
    console.error("[Chunk Upload GET] Error:", error)
    return NextResponse.json({ error: "Failed to query chunk status" }, { status: 500 })
  }
}

// POST: Receive a chunk and assemble upon completion
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (user.role !== "PHOTOGRAPHER" && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const formData = await req.formData()
    const uploadId = formData.get("uploadId") as string | null
    const chunkIndexStr = formData.get("chunkIndex") as string | null
    const totalChunksStr = formData.get("totalChunks") as string | null
    const fileName = formData.get("fileName") as string | null
    const eventId = formData.get("eventId") as string | null
    const chunkFile = formData.get("chunk") as File | null

    if (!uploadId || chunkIndexStr === null || !totalChunksStr || !fileName || !eventId || !chunkFile) {
      return NextResponse.json({ error: "Missing required chunk upload fields" }, { status: 400 })
    }

    const chunkIndex = parseInt(chunkIndexStr, 10)
    const totalChunks = parseInt(totalChunksStr, 10)

    if (isNaN(chunkIndex) || isNaN(totalChunks) || chunkIndex < 0 || chunkIndex >= totalChunks) {
      return NextResponse.json({ error: "Invalid chunkIndex or totalChunks" }, { status: 400 })
    }

    // Read chunk buffer
    const chunkArrayBuf = await chunkFile.arrayBuffer()
    const chunkBuffer = Buffer.from(chunkArrayBuf)

    // Store in ChunkUploadStore
    chunkStore.getOrCreateSession(uploadId, fileName, eventId, totalChunks, user.sub)
    const { session, isComplete } = chunkStore.addChunk(uploadId, chunkIndex, chunkBuffer)

    // If not all chunks have arrived yet, acknowledge this chunk
    if (!isComplete) {
      return NextResponse.json({
        status: "chunk_received",
        uploadId,
        chunkIndex,
        uploadedCount: session.chunks.size,
        totalChunks,
      })
    }

    // All chunks received! Assemble full file
    console.log(`[Chunk Upload] All ${totalChunks} chunks received for ${fileName}. Assembling...`)
    const fullBuffer = chunkStore.assembleFile(uploadId)

    // 1. Optimize image for storage (resize to 2048px + WebP quality 85)
    const optimized = await optimizeForStorage(fullBuffer)

    // 2. Duplicate Detection
    const baseName = fileName.split(".")[0].replace(/[^a-zA-Z0-9_-]/g, "_")
    const existingPhoto = await prisma.photo.findFirst({
      where: {
        eventId,
        width: optimized.width,
        height: optimized.height,
        storageUrl: { contains: `/${baseName}_` },
      },
    })

    if (existingPhoto) {
      chunkStore.deleteSession(uploadId)
      return NextResponse.json(
        {
          photoId: existingPhoto.id,
          storageUrl: existingPhoto.storageUrl,
          status: "skipped",
          message: `Photo ${fileName} already exists in this event`,
        },
        { status: 200 }
      )
    }

    // 3. Upload to Cloudinary
    const storageUrl = await uploadToCloudinary(fileName, "image/webp", optimized.buffer, eventId)

    // 4. Create Photo Record in Prisma with PENDING status
    const photo = await prisma.photo.create({
      data: {
        eventId,
        uploaderId: user.sub,
        storageUrl,
        mimeType: "image/webp",
        processingStatus: "PENDING",
        width: optimized.width,
        height: optimized.height,
      },
    })

    // 5. Enqueue into background AI Processing Queue (LOW priority for batch uploads)
    await aiQueue.enqueue({
      photoId: photo.id,
      storageUrl,
      imageBuffer: optimized.buffer,
      fileName,
    }, "LOW")

    // 6. Clean up chunk session
    chunkStore.deleteSession(uploadId)

    return NextResponse.json(
      {
        status: "completed",
        photoId: photo.id,
        storageUrl,
        message: "File fully assembled, stored, and enqueued for AI processing",
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error("[Chunk Upload POST] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to process chunk upload" },
      { status: 500 }
    )
  }
}
