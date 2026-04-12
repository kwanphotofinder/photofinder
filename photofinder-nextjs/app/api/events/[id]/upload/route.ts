import { type NextRequest, NextResponse } from "next/server"
import { uploadToCloudinary, deleteFromCloudinary } from "@/lib/cloudinary"
import { extractFaces } from "@/lib/ai"
import { getUserFromRequest } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { optimizeForStorage } from "@/lib/image"

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
      if (file.size > 15 * 1024 * 1024) {
        return NextResponse.json({ error: "One or more files exceed the 15MB size limit." }, { status: 413 })
      }
    }
    // Verify the event exists
    const event = await prisma.event.findUnique({ where: { id: eventId } })
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    const results = []

    for (const file of files) {
      const fileBuffer = Buffer.from(await file.arrayBuffer())

      // 1. Optimize image for storage (resize to 2048px + WebP quality 85)
      const optimized = await optimizeForStorage(fileBuffer)

      // 2. Upload OPTIMIZED version to Cloudinary (saves ~70-80% storage)
      const storageUrl = await uploadToCloudinary(file.name, 'image/webp', optimized.buffer, eventId)

      // 3. Create Photo Record (dimensions from optimized version)
      const photo = await prisma.photo.create({
        data: {
          eventId,
          uploaderId: uploaderId || null,
          storageUrl: storageUrl || file.name,
          mimeType: 'image/webp',
          processingStatus: "PROCESSING",
          width: optimized.width,
          height: optimized.height,
        },
      })

      try {
        // 4. Extract face embeddings and store in pgvector
        const faces = await extractFaces(fileBuffer, file.name)

        if (!faces || faces.length === 0) {
          // No faces detected; clean up the blank photo and skip to save storage.
          if (storageUrl) await deleteFromCloudinary(storageUrl);
          await prisma.photo.delete({ where: { id: photo.id } });
          results.push({ photoId: photo.id, filename: file.name, facesDetected: 0, status: "failed", error: "Skipped: No faces found (discarded to save storage)" });
          continue;
        }

        for (const face of faces) {
          const vectorString = `[${face.embedding.join(",")}]`
          await prisma.$executeRawUnsafe(`
            INSERT INTO "faces" ("id", "photoId", "confidence", "x", "y", "w", "h", "embedding")
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7::vector)
          `,
            photo.id,
            face.det_score,
            face.bbox[0],
            face.bbox[1],
            face.bbox[2] - face.bbox[0],
            face.bbox[3] - face.bbox[1],
            vectorString
          )
        }

        await prisma.photo.update({
          where: { id: photo.id },
          data: { processingStatus: "COMPLETED" },
        })

        results.push({ photoId: photo.id, filename: file.name, facesDetected: faces.length, status: "success" })
      } catch (aiError) {
        console.warn(`AI processing failed for ${file.name}:`, aiError)
        await prisma.photo.update({
          where: { id: photo.id },
          data: { processingStatus: "FAILED" },
        })
        results.push({ photoId: photo.id, filename: file.name, facesDetected: 0, status: "ai_failed" })
      }
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
