import { NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { uploadToCloudinary, deleteFromCloudinary } from "@/lib/cloudinary"

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000"


export async function POST(req: NextRequest) {
  try {
    const { anchorImage, selfieImage } = await req.json()
    
    // 1. Auth check using existing auth helper
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    
    const userId = user.sub

    // 2. Prepare files for AI Service
    const anchorBlob = base64ToBlob(anchorImage)
    const selfieBlob = base64ToBlob(selfieImage)

    // 3. Check Identity Match (Anchor vs Selfie)
    const compareFormData = new FormData()
    compareFormData.append("file1", anchorBlob, "anchor.jpg")
    compareFormData.append("file2", selfieBlob, "selfie.jpg")
    
    const compareRes = await fetch(`${AI_SERVICE_URL}/compare`, {
      method: "POST",
      body: compareFormData,
    })
    
    const compareData = await compareRes.json()

    if (!compareData.match) {
      return NextResponse.json({ success: false, error: "Identity mismatch. Please ensure you are the same person who passed the live test." }, { status: 400 })
    }

    // 4. Cleanup old image if it exists to avoid duplicates in Cloudinary
    const existingFace = await prisma.userFace.findUnique({ where: { userId } })
    if (existingFace?.imageUrl) {
      console.log(`[IdentityGuard] Deleting old selfie: ${existingFace.imageUrl}`)
      await deleteFromCloudinary(existingFace.imageUrl)
    }

    // 5. Success! Upload Selfie image to Cloudinary using existing helper
    const storageUrl = await uploadToCloudinary(
      `user_${userId}_reference.jpg`,
      "image/jpeg",
      Buffer.from(await selfieBlob.arrayBuffer())
    )

    // 6. Extract embedding for the final reference
    const extractFormData = new FormData()
    extractFormData.append("file", selfieBlob, "selfie.jpg")
    const extractRes = await fetch(`${AI_SERVICE_URL}/extract`, {
      method: "POST",
      body: extractFormData,
    })
    const extractData = await extractRes.json()
    const embedding = extractData[0]?.embedding

    if (!embedding) {
      return NextResponse.json({ success: false, error: "Failed to extract face features from the selfie." }, { status: 400 })
    }

    // Update Database using raw query (pgvector)
    const vectorString = `[${embedding.join(",")}]`
    const nextId = existingFace?.id || crypto.randomUUID()
    await prisma.$executeRawUnsafe(
      `INSERT INTO "user_faces" ("id", "userId", "imageUrl", "embedding", "updatedAt")
       VALUES ($1, $2, $3, $4::vector, NOW())
       ON CONFLICT ("userId")
       DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl", "embedding" = EXCLUDED."embedding", "updatedAt" = NOW()`,
      nextId, userId, storageUrl, vectorString
    )

    return NextResponse.json({ success: true, imageUrl: storageUrl })

  } catch (error: any) {
    console.error("Verification error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

// Helper: Convert base64 to Blob
function base64ToBlob(base64: string) {
  const byteString = atob(base64.split(",")[1])
  const mimeString = base64.split(",")[0].split(":")[1].split(";")[0]
  const ab = new ArrayBuffer(byteString.length)
  const ia = new Uint8Array(ab)
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i)
  }
  return new Blob([ab], { type: mimeString })
}

