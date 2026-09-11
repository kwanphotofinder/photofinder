import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getUserFromRequest } from "@/lib/auth"

export async function GET(request: NextRequest) {
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
            id: true,
            imageUrl: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        savedPhotos: {
          include: {
            photo: {
              select: {
                id: true,
                storageUrl: true,
                createdAt: true,
                event: {
                  select: {
                    id: true,
                    name: true,
                    date: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        removalRequests: {
          select: {
            id: true,
            photoId: true,
            requestType: true,
            reason: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        deliveries: {
          select: {
            id: true,
            eventId: true,
            status: true,
            sentAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
        pdpaConsent: user.pdpaConsent,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      referenceFace: user.referenceFace,
      savedPhotos: user.savedPhotos.map((saved) => ({
        id: saved.id,
        savedAt: saved.createdAt,
        photo: saved.photo,
      })),
      removalRequests: user.removalRequests,
      deliveries: user.deliveries,
      summary: {
        savedPhotosCount: user.savedPhotos.length,
        removalRequestsCount: user.removalRequests.length,
        deliveriesCount: user.deliveries.length,
        hasReferenceFace: !!user.referenceFace,
      },
    }

    return NextResponse.json({ status: "success", data: exportPayload })
  } catch (error) {
    console.error("GET /api/me/privacy/export error:", error)
    return NextResponse.json({ error: "Failed to export privacy data" }, { status: 500 })
  }
}
