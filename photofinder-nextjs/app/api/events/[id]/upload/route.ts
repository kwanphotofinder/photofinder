import { type NextRequest, NextResponse } from "next/server"
import { uploadToCloudinary } from "@/lib/cloudinary"
import { extractFaces } from "@/lib/ai"
import { getUserFromRequest } from "@/lib/auth"
import prisma from "@/lib/prisma"
import sharp from "sharp"

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
    const uploaderId = user?.sub || undefined;

    const formData = await request.formData()
    const files = formData.getAll("files") as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 })
    }

    // Validate file types
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        return NextResponse.json({ error: "Invalid file type. Only images are allowed." }, { status: 400 })
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

      // 1. Upload to Cloudinary using event-specific folder
      const storageUrl = await uploadToCloudinary(file.name, file.type, fileBuffer, eventId)

      // 2. Extract dimensions
      let width: number | null = null
      let height: number | null = null
      try {
        const metadata = await sharp(fileBuffer).metadata()
        width = metadata.width || null
        height = metadata.height || null
      } catch {}

      // 3. Create Photo Record
      const photo = await prisma.photo.create({
        data: {
          eventId,
          uploaderId: uploaderId || null,
          storageUrl: storageUrl || file.name,
          mimeType: file.type,
          processingStatus: "PROCESSING",
          width,
          height,
        },
      })

      try {
        // 4. Extract face embeddings and store in pgvector
        const faces = await extractFaces(fileBuffer, file.name)

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
