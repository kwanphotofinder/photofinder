import { NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { deleteFromCloudinary } from "@/lib/cloudinary"


export async function POST(req: NextRequest) {
  try {
    // 1. Auth check - Only ADMIN can run this
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    
    // We check the role from the decoded user object
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // 2. Find all user faces
    const userFaces = await prisma.userFace.findMany({
      select: { userId: true, imageUrl: true }
    })

    console.log(`Found ${userFaces.length} selfies to clean up.`)

    let deletedCount = 0
    for (const face of userFaces) {
      if (face.imageUrl) {
        try {
          await deleteFromCloudinary(face.imageUrl)
          deletedCount++
        } catch (err) {
          console.error(`Failed to delete from Cloudinary: ${face.imageUrl}`)
        }
      }
    }

    // 3. Clear from Database
    const dbResult = await prisma.userFace.deleteMany({})

    return NextResponse.json({ 
      success: true, 
      message: `Clean-up complete. ${deletedCount} images removed from Cloudinary, ${dbResult.count} records removed from DB.` 
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
