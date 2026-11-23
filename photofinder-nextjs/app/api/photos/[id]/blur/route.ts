import { NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import prisma from "@/lib/prisma"
import {
  getObjectBuffer,
  putObject,
  deleteFromStorage,
  keyFromUrl,
  urlForKey,
} from "@/lib/storage"

export const runtime = "nodejs"

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000"

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: photoId } = await context.params
    const { bboxes } = await req.json() // Expecting "x,y,w,h" string

    console.log(`[BLUR] === Starting blur for photo ${photoId} ===`)
    console.log(`[BLUR] Received bboxes: "${bboxes}" (type: ${typeof bboxes})`)

    // 1. Auth check using standard helper
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // 2. Fetch photo from DB with its active faces
    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
      include: { faces: true },
    })
    if (!photo) return NextResponse.json({ error: "Photo not found" }, { status: 404 })

    // If the photo only has 1 face (or 0 faces), blurring is useless — delete photo completely to save storage
    if (!photo.faces || photo.faces.length <= 1) {
      console.log(`[BLUR] Photo ${photoId} has ${photo.faces?.length || 0} faces. Deleting photo completely instead of blurring.`)
      if (photo.storageUrl) {
        await deleteFromStorage(photo.storageUrl)
      }
      await prisma.photo.delete({ where: { id: photoId } })
      return NextResponse.json({ success: true, deleted: true, message: "Solo photo was deleted to save storage." })
    }

    console.log(`[BLUR] Photo storageUrl: ${photo.storageUrl}`)
    console.log(`[BLUR] Photo dimensions in DB: ${photo.width}x${photo.height}`)

    const objectKey = keyFromUrl(photo.storageUrl)
    if (!objectKey) throw new Error("Could not resolve storage key from photo URL")

    // 3. Download original image from storage
    const originalBuffer = await getObjectBuffer(objectKey)
    console.log(`[BLUR] Downloaded image: ${originalBuffer.byteLength} bytes`)

    // 4. Call AI Service to Blur
    const formData = new FormData()
    formData.append("file", new Blob([new Uint8Array(originalBuffer)], { type: "image/webp" }), "image.webp")
    formData.append("bboxes", bboxes)

    console.log(`[BLUR] Sending to AI service: ${AI_SERVICE_URL}/blur`)
    const blurRes = await fetch(`${AI_SERVICE_URL}/blur`, {
      method: "POST",
      body: formData,
    })

    console.log(`[BLUR] AI service response: ${blurRes.status} ${blurRes.statusText}`)
    if (!blurRes.ok) {
      const errText = await blurRes.text()
      console.error(`[BLUR] AI error body: ${errText}`)
      throw new Error("AI Service failed to blur image")
    }
    const blurredImageBuffer = await blurRes.arrayBuffer()
    console.log(`[BLUR] Received blurred image: ${blurredImageBuffer.byteLength} bytes`)

    // 5. Overwrite the object at the same key with the blurred version
    await putObject(objectKey, Buffer.from(blurredImageBuffer), "image/webp")

    // 6. Delete the blurred face embedding from the faces table so it no longer matches in search
    if (bboxes) {
      const coords = bboxes.split(",").map((n: string) => parseFloat(n.trim()))
      if (coords.length === 4 && !coords.some(isNaN)) {
        const [bx, by] = coords
        // Delete face matching close coordinates (+- 30px tolerance)
        const matchingFace = photo.faces.find(f =>
          f.x !== null && f.y !== null &&
          Math.abs((f.x ?? 0) - bx) < 30 &&
          Math.abs((f.y ?? 0) - by) < 30
        )
        if (matchingFace) {
          await prisma.face.delete({ where: { id: matchingFace.id } }).catch(() => {})
        }
      }
    }

    // Update DB with a cache-busting URL (same key, new ?v=) so browsers refetch the blurred image
    const newUrl = `${urlForKey(objectKey)}?v=${Date.now()}`
    await prisma.photo.update({
      where: { id: photoId },
      data: { storageUrl: newUrl },
    })

    const { recordAuditLog } = await import("@/lib/audit-logger")
    await recordAuditLog({
      actorId: user.sub,
      actorEmail: user.email || "unknown_admin",
      actorRole: user.role,
      action: "BLUR_PHOTO_FACE",
      category: "CONTENT",
      targetType: "PHOTO",
      targetId: photoId,
      targetLabel: `Photo #${photoId.slice(0, 8)}`,
      details: `Applied facial privacy blur to face coordinates [${bboxes}].`,
      ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
    })

    return NextResponse.json({ success: true, url: newUrl, remainingFaces: photo.faces.length - 1 })

  } catch (error: any) {
    console.error("Blur error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
