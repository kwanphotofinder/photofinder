import { type NextRequest, NextResponse } from "next/server"
import { uploadToCloudinary } from "@/lib/cloudinary"
import { getUserFromRequest } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { optimizeForStorage } from "@/lib/image"
import { aiQueue } from "@/lib/ai-queue"

// POST /api/events/:id/upload - Upload multiple photos to an event
// This mirrors the photographer upload flow which sends files per event

// Allow Vercel Hobby tier to wait up to 60 seconds for Hugging Face AI to wake up
export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const p = await params;
    const eventId = p.id;

    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'PHOTOGRAPHER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const uploaderId = user.sub;

    const formData = await request.formData()
    const files = formData.getAll("files") as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 })
    }

    // Validate file types and size
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        return NextResponse.json({ error: "Invalid file type. Only images are allowed." }, { status: 400 })
      }
      if (file.size > 25 * 1024 * 1024) {
        return NextResponse.json({ error: "One or more files exceed the 25MB size limit." }, { status: 413 })
      }
    }
    // Verify the event exists
    const event = await prisma.event.findUnique({ where: { id: eventId } })
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Fetch existing photos in this event to prevent duplicate uploads
    const existingPhotos = await prisma.photo.findMany({
      where: { eventId },
      select: { id: true, storageUrl: true, width: true, height: true }
    })

    const results = []

    for (const file of files) {
      const fileBuffer = Buffer.from(await file.arrayBuffer())

      // 1. Optimize image for storage (resize to 2048px + WebP quality 85)
      const optimized = await optimizeForStorage(fileBuffer)

      // 2. Duplicate Detection: Check if a photo with matching dimensions & base name exists in this event
      const baseName = file.name.split('.')[0].replace(/[^a-zA-Z0-9_-]/g, '_')
      const isDuplicate = existingPhotos.some(
        p => p.width === optimized.width && p.height === optimized.height && p.storageUrl && p.storageUrl.includes(`/${baseName}_`)
      )

      if (isDuplicate) {
        results.push({
          filename: file.name,
          facesDetected: 0,
          status: "skipped",
          message: `Skipped duplicate photo (${file.name}) already in album`
        })
        continue
      }

      // 3. Upload OPTIMIZED version to Cloudinary (saves ~70-80% storage)
      const storageUrl = await uploadToCloudinary(file.name, 'image/webp', optimized.buffer, eventId)

      // 4. Create Photo Record with PENDING status
      const photo = await prisma.photo.create({
        data: {
          eventId,
          uploaderId: uploaderId || null,
          storageUrl: storageUrl || file.name,
          mimeType: 'image/webp',
          processingStatus: "PENDING",
          width: optimized.width,
          height: optimized.height,
        },
      })

      // 5. Enqueue into background AI Processing Queue (non-blocking)
      await aiQueue.enqueue({
        photoId: photo.id,
        storageUrl: storageUrl || file.name,
        imageBuffer: optimized.buffer,
        fileName: file.name,
      })

      results.push({ photoId: photo.id, filename: file.name, status: "queued" })
    }

    return NextResponse.json({
      eventId,
      uploaded: results.length,
      results,
    }, { status: 201 })

  } catch (error) {
    console.error("POST /api/events/[id]/upload error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
