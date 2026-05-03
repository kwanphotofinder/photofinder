import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import jwt from "jsonwebtoken"
import prisma from "@/lib/prisma"
import { v2 as cloudinary } from "cloudinary"

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_URL?.split("@")[1],
  api_key: process.env.CLOUDINARY_URL?.split("//")[1].split(":")[0],
  api_secret: process.env.CLOUDINARY_URL?.split(":")[2].split("@")[0],
})

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: photoId } = await context.params
    const { bboxes } = await req.json() // Expecting "x,y,w,h" string

    // 1. Auth check
    const cookieStore = await cookies()
    const token = cookieStore.get("auth_token")?.value
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { role: string }
    if (decoded.role !== "ADMIN" && decoded.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // 2. Fetch photo from DB
    const photo = await prisma.photo.findUnique({ where: { id: photoId } })
    if (!photo) return NextResponse.json({ error: "Photo not found" }, { status: 404 })

    // 3. Download image from Cloudinary
    const imageRes = await fetch(photo.storageUrl)
    const imageBlob = await imageRes.blob()

    // 4. Call AI Service to Blur
    const formData = new FormData()
    formData.append("file", imageBlob, "image.jpg")
    formData.append("bboxes", bboxes)

    const blurRes = await fetch(`${AI_SERVICE_URL}/blur`, {
      method: "POST",
      body: formData,
    })

    if (!blurRes.ok) throw new Error("AI Service failed to blur image")
    const blurredImageBuffer = await blurRes.arrayBuffer()

    // 5. Upload blurred image back to Cloudinary (Overwrite)
    const publicId = photo.storageUrl.split("/").pop()?.split(".")[0]
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream({
        public_id: publicId,
        overwrite: true,
        resource_type: "image",
      }, (error, result) => {
        if (error) reject(error)
        else resolve(result)
      }).end(Buffer.from(blurredImageBuffer))
    }) as any

    return NextResponse.json({ success: true, url: uploadResult.secure_url })

  } catch (error: any) {
    console.error("Blur error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
