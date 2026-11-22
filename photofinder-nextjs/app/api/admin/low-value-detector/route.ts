import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getUserFromRequest } from "@/lib/auth"
import { deleteFromStorage } from "@/lib/storage"
import { recordAuditLog } from "@/lib/audit-logger"

async function requireSuperAdmin(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user || user.role !== "SUPER_ADMIN") {
    return null
  }
  return user
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireSuperAdmin(req)
    if (!user) {
      return NextResponse.json(
        { error: "Forbidden: Super Admin access required" },
        { status: 403 }
      )
    }

    const reason = req.nextUrl.searchParams.get("reason") || "ALL"

    // Base conditions
    const noFacesCondition = {
      processingStatus: "COMPLETED" as const,
      faces: { none: {} },
    }
    const failedCondition = {
      processingStatus: "FAILED" as const,
    }

    // Counts
    const [noFacesCount, failedCount] = await Promise.all([
      prisma.photo.count({ where: noFacesCondition }),
      prisma.photo.count({ where: failedCondition }),
    ])
    const totalCount = noFacesCount + failedCount
    // Estimated average DSLR / high-res event photo size = 2.5 MB
    const estimatedStorageMb = (totalCount * 2.5).toFixed(1)

    // Build filter based on query
    let whereClause: any
    if (reason === "NO_FACES") {
      whereClause = noFacesCondition
    } else if (reason === "FAILED") {
      whereClause = failedCondition
    } else {
      whereClause = {
        OR: [noFacesCondition, failedCondition],
      }
    }

    const photos = await prisma.photo.findMany({
      where: whereClause,
      include: {
        event: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 500,
    })

    const items = photos.map((photo) => {
      const isFailed = photo.processingStatus === "FAILED"
      return {
        id: photo.id,
        eventId: photo.eventId,
        eventName: photo.event?.name || "Unknown Event",
        storageUrl: photo.storageUrl,
        thumbnailUrl: photo.thumbnailUrl,
        processingStatus: photo.processingStatus,
        width: photo.width,
        height: photo.height,
        mimeType: photo.mimeType,
        createdAt: photo.createdAt,
        reason: isFailed ? ("FAILED" as const) : ("NO_FACES" as const),
        reasonLabel: isFailed ? "Processing Failed" : "0 Detected Faces",
      }
    })

    return NextResponse.json({
      summary: {
        totalCount,
        noFacesCount,
        failedCount,
        estimatedStorageMb,
      },
      items,
    })
  } catch (error) {
    console.error("GET /api/admin/low-value-detector error:", error)
    return NextResponse.json(
      { error: "Failed to scan low-value photos" },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireSuperAdmin(req)
    if (!user) {
      return NextResponse.json(
        { error: "Forbidden: Super Admin access required" },
        { status: 403 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const { photoIds, reasonFilter } = body

    let targetPhotos: Array<{ id: string; storageUrl: string; thumbnailUrl: string | null }> = []

    if (Array.isArray(photoIds) && photoIds.length > 0) {
      targetPhotos = await prisma.photo.findMany({
        where: { id: { in: photoIds } },
        select: { id: true, storageUrl: true, thumbnailUrl: true },
      })
    } else if (reasonFilter) {
      const whereClause: any =
        reasonFilter === "NO_FACES"
          ? { processingStatus: "COMPLETED", faces: { none: {} } }
          : reasonFilter === "FAILED"
          ? { processingStatus: "FAILED" }
          : {
              OR: [
                { processingStatus: "COMPLETED", faces: { none: {} } },
                { processingStatus: "FAILED" },
              ],
            }

      targetPhotos = await prisma.photo.findMany({
        where: whereClause,
        select: { id: true, storageUrl: true, thumbnailUrl: true },
        take: 1000,
      })
    } else {
      return NextResponse.json(
        { error: "photoIds array or reasonFilter is required" },
        { status: 400 }
      )
    }

    if (targetPhotos.length === 0) {
      return NextResponse.json({
        status: "success",
        deletedCount: 0,
        message: "No matching low-value photos found",
      })
    }

    const targetIds = targetPhotos.map((p) => p.id)

    // 1. Delete records from database (Cascades to faces, saved_photos, abuse_reports, removal_requests)
    await prisma.photo.deleteMany({
      where: { id: { in: targetIds } },
    })

    // 2. Concurrently delete objects from MinIO storage
    const urlsToDelete: string[] = []
    for (const p of targetPhotos) {
      if (p.storageUrl) urlsToDelete.push(p.storageUrl)
      if (p.thumbnailUrl && p.thumbnailUrl !== p.storageUrl) urlsToDelete.push(p.thumbnailUrl)
    }
    await Promise.allSettled(urlsToDelete.map((url) => deleteFromStorage(url)))

    // 3. Record Audit Log for Super Admin traceability
    await recordAuditLog({
      actorId: user.sub,
      actorEmail: user.email || "unknown_user",
      actorRole: user.role,
      action: "PURGE_LOW_VALUE_PHOTOS",
      category: "CONTENT",
      targetType: "PHOTO_BATCH",
      targetId: targetIds[0],
      targetLabel: `Purged ${targetIds.length} low-value photo(s) (${reasonFilter || "selected"})`,
      details: `Super Admin purged ${targetIds.length} low-value photo(s) (0 faces / failed) to reclaim storage.`,
      ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
    })

    return NextResponse.json({
      status: "success",
      deletedCount: targetIds.length,
      message: `Successfully purged ${targetIds.length} low-value photo(s)`,
    })
  } catch (error) {
    console.error("DELETE /api/admin/low-value-detector error:", error)
    return NextResponse.json(
      { error: "Failed to purge low-value photos" },
      { status: 500 }
    )
  }
}
