import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const [
      totalEvents,
      totalPhotos,
      totalUsers,
      totalRemovalRequests,
      totalDeliveries,
      totalFaces,
    ] = await Promise.all([
      prisma.event.count(),
      prisma.photo.count(),
      prisma.user.count(),
      prisma.removalRequest.count(),
      prisma.delivery.count(),
      prisma.face.count(),
    ])

    const consentUsers = await prisma.user.count({ where: { pdpaConsent: true } })
    const averageOptInRate = totalUsers > 0
      ? Math.round((consentUsers / totalUsers) * 100 * 10) / 10
      : 0

    // Top events by photo count
    const topEvents = await prisma.event.findMany({
      include: { _count: { select: { photos: true } } },
      orderBy: { photos: { _count: 'desc' } },
      take: 5,
    })

    return NextResponse.json({
      totalEvents,
      totalPhotos,
      totalUsers,
      totalFaces,
      averageOptInRate,
      engagementStats: {
        removalRequests: totalRemovalRequests,
        deliveries: totalDeliveries,
        facesIndexed: totalFaces,
      },
      topEvents: topEvents.map(e => ({
        id: e.id,
        name: e.name,
        photoCount: e._count.photos,
        date: e.date,
      })),
    })
  } catch (error) {
    console.error("GET /api/analytics error:", error)
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 })
  }
}
