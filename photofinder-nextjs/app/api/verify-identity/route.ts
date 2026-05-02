import { NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { uploadToCloudinary, deleteFromCloudinary } from "@/lib/cloudinary"

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000"


export async function POST(req: NextRequest) {
  try {
    const { frontImage, tiltImage, challenge } = await req.json()
    
    // 1. Auth check using existing auth helper
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    
    const userId = user.sub

    // 2. Prepare files for AI Service
    const frontBlob = base64ToBlob(frontImage)
    const tiltBlob = base64ToBlob(tiltImage)

    // 3. Check Liveness (Head Turn)
    const livenessFormData = new FormData()
    livenessFormData.append("file", tiltBlob, "tilt.jpg")
    
    const livenessRes = await fetch(`${AI_SERVICE_URL}/liveness`, {
      method: "POST",
      body: livenessFormData,
    })
    
    const livenessData = await livenessRes.json()
    
    if (!livenessData || livenessData.length === 0) {
      return NextResponse.json({ success: false, error: "No face detected in tilted photo." }, { status: 400 })
    }

    // Verify the turn direction
    const landmarks = livenessData[0].landmarks
    const isLivenessValid = verifyTurn(landmarks, challenge)

    if (!isLivenessValid) {
      return NextResponse.json({ success: false, error: `Liveness check failed. Please turn your head to the ${challenge}.` }, { status: 400 })
    }

    // 4. Check Identity Match (Front vs Tilt)
    const compareFormData = new FormData()
    compareFormData.append("file1", frontBlob, "front.jpg")
    compareFormData.append("file2", tiltBlob, "tilt.jpg")
    
    const compareRes = await fetch(`${AI_SERVICE_URL}/compare`, {
      method: "POST",
      body: compareFormData,
    })
    
    const compareData = await compareRes.json()

    if (!compareData.match) {
      return NextResponse.json({ success: false, error: "Identity mismatch. Please ensure both photos are of the same person." }, { status: 400 })
    }

    // 5. Cleanup old image if it exists to avoid duplicates in Cloudinary
    const existingFace = await prisma.userFace.findUnique({ where: { userId } })
    if (existingFace?.imageUrl) {
      console.log(`[IdentityGuard] Deleting old selfie: ${existingFace.imageUrl}`)
      await deleteFromCloudinary(existingFace.imageUrl)
    }

    // 6. Success! Upload Front image to Cloudinary using existing helper
    const storageUrl = await uploadToCloudinary(
      `user_${userId}_reference.jpg`,
      "image/jpeg",
      Buffer.from(await frontBlob.arrayBuffer())
    )

    // 6. Extract embedding for the final reference
    const extractFormData = new FormData()
    extractFormData.append("file", frontBlob, "front.jpg")
    const extractRes = await fetch(`${AI_SERVICE_URL}/extract`, {
      method: "POST",
      body: extractFormData,
    })
    const extractData = await extractRes.json()
    const embedding = extractData[0]?.embedding

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

// Helper: Verify head turn direction based on landmarks
function verifyTurn(landmarks: any[], challenge: string) {
  // Simple heuristic using nose vs cheek landmarks
  // In a 468 landmark model: 1 is nose, 234 is left cheek, 454 is right cheek
  const nose = landmarks[1]
  const leftCheek = landmarks[234]
  const rightCheek = landmarks[454]
  
  const faceWidth = Math.abs(rightCheek.x - leftCheek.x)
  const noseRel = (nose.x - leftCheek.x) / faceWidth
  
  if (challenge === "left") return noseRel < 0.35
  if (challenge === "right") return noseRel > 0.65
  return false
}

