import { NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { v2 as cloudinary } from "cloudinary"

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_URL?.split("@")[1],
  api_key: process.env.CLOUDINARY_URL?.split("//")[1].split(":")[0],
  api_secret: process.env.CLOUDINARY_URL?.split(":")[2].split("@")[0],
})

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

    // 2. Fetch photo from DB
    const photo = await prisma.photo.findUnique({ where: { id: photoId } })
    if (!photo) return NextResponse.json({ error: "Photo not found" }, { status: 404 })

    console.log(`[BLUR] Photo storageUrl: ${photo.storageUrl}`)
    console.log(`[BLUR] Photo dimensions in DB: ${photo.width}x${photo.height}`)

    // 3. Download image from Cloudinary
    const imageRes = await fetch(photo.storageUrl)
    const imageBlob = await imageRes.blob()
    console.log(`[BLUR] Downloaded image blob: ${imageBlob.size} bytes, type: ${imageBlob.type}`)

    // 4. Call AI Service to Blur
    const formData = new FormData()
    formData.append("file", imageBlob, "image.jpg")
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

    // 5. Upload blurred image back to Cloudinary (Overwrite)
    // Correctly extract the full public_id (including folders)
    const urlParts = photo.storageUrl.split('/upload/')
    if (urlParts.length !== 2) throw new Error("Invalid Cloudinary URL")
    
    let endPath = decodeURIComponent(urlParts[1])
    if (endPath.match(/^v\d+\//)) {
      endPath = endPath.replace(/^v\d+\//, '')
    }
    const lastDotIndex = endPath.lastIndexOf('.')
    const publicId = lastDotIndex !== -1 ? endPath.substring(0, lastDotIndex) : endPath

    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream({
        public_id: publicId,
        overwrite: true,
        invalidate: true,
        resource_type: "image",
      }, (error, result) => {
        if (error) reject(error)
        else resolve(result)
      }).end(Buffer.from(blurredImageBuffer))
    }) as any

    // Update DB with the new secure_url (which has a new version string, breaking browser cache)
    await prisma.photo.update({
      where: { id: photoId },
      data: { storageUrl: uploadResult.secure_url }
    })

    return NextResponse.json({ success: true, url: uploadResult.secure_url })

  } catch (error: any) {
    console.error("Blur error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
