import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getUserFromRequest } from "@/lib/auth"
import { deleteFromCloudinary } from "@/lib/cloudinary"

export async function POST(request: NextRequest) {
  try {
    const authUser = await getUserFromRequest(request)
    if (!authUser?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser.sub },
      include: {
        referenceFace: {
          select: {
            imageUrl: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (user.referenceFace?.imageUrl) {
      await deleteFromCloudinary(user.referenceFace.imageUrl)
    }

    const result = await prisma.$transaction(async (tx) => {
      const savedPhotos = await tx.savedPhoto.deleteMany({ where: { userId: authUser.sub } })
      const removalRequests = await tx.removalRequest.deleteMany({ where: { userId: authUser.sub } })
      const abuseReports = await tx.abuseReport.deleteMany({ where: { reporterId: authUser.sub } })
      const deliveries = await tx.delivery.deleteMany({ where: { userId: authUser.sub } })
      const referenceFace = await tx.userFace.deleteMany({ where: { userId: authUser.sub } })

      await tx.user.update({
        where: { id: authUser.sub },
        data: {
          pdpaConsent: false,
          avatarUrl: null,
          name: null,
        },
      })

      return {
        savedPhotosDeleted: savedPhotos.count,
        removalRequestsDeleted: removalRequests.count,
        abuseReportsDeleted: abuseReports.count,
        deliveriesDeleted: deliveries.count,
        referenceFacesDeleted: referenceFace.count,
      }
    })

    return NextResponse.json({
      status: "completed",
      message: "Personal data deletion completed",
      deletedAt: new Date().toISOString(),
      details: result,
    })
  } catch (error) {
    console.error("POST /api/me/privacy/full-delete error:", error)
    return NextResponse.json({
      status: "failed",
      error: "Failed to complete personal data deletion",
    }, { status: 500 })
  }
}
