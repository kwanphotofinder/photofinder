import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getUserFromRequest } from "@/lib/auth"
import { deleteFromCloudinary } from "@/lib/cloudinary"
import { recordAuditLog } from "@/lib/audit-logger"

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.role !== "PHOTOGRAPHER" && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const { photoIds } = body

    if (!Array.isArray(photoIds) || photoIds.length === 0) {
      return NextResponse.json(
        { error: "photoIds array is required and must not be empty" },
        { status: 400 }
      )
    }

    // Limit bulk delete to 100 photos at a time
    if (photoIds.length > 100) {
      return NextResponse.json(
        { error: "Cannot delete more than 100 photos at once" },
        { status: 400 }
      )
    }

    // Find the target photos
    const photos = await prisma.photo.findMany({
      where: { id: { in: photoIds } },
      select: { id: true, storageUrl: true, uploaderId: true },
    })

    if (photos.length === 0) {
      return NextResponse.json({ message: "No matching photos found", deletedCount: 0 })
    }

    // Authorization: ADMIN/SUPER_ADMIN can delete all; PHOTOGRAPHER can only delete photos they uploaded
    const authorizedPhotos =
      user.role === "ADMIN" || user.role === "SUPER_ADMIN"
        ? photos
        : photos.filter((p) => p.uploaderId === user.sub)

    if (authorizedPhotos.length === 0) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to delete these photos" },
        { status: 403 }
      )
    }

    const authorizedIds = authorizedPhotos.map((p) => p.id)

    // 1. Delete from PostgreSQL (Cascade deletes all faces, saved records, and abuse reports)
    await prisma.photo.deleteMany({
      where: { id: { in: authorizedIds } },
    })

    // 2. Concurrently delete original files from Cloudinary
    await Promise.allSettled(
      authorizedPhotos
        .filter((p) => p.storageUrl && p.storageUrl.includes("cloudinary"))
        .map((p) => deleteFromCloudinary(p.storageUrl))
    )

    // 3. Audit log
    await recordAuditLog({
      actorId: user.sub,
      actorEmail: user.email || "unknown_user",
      actorRole: user.role,
      action: "BULK_DELETE_PHOTOS",
      category: "CONTENT",
      targetType: "PHOTO_BATCH",
      targetId: authorizedIds[0],
      targetLabel: `Bulk Delete (${authorizedIds.length} photos)`,
      details: `Bulk deleted ${authorizedIds.length} photo(s) and their associated facial vectors.`,
      ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
    })

    return NextResponse.json({
      success: true,
      deletedCount: authorizedIds.length,
      deletedIds: authorizedIds,
      message: `Successfully deleted ${authorizedIds.length} photo(s)`,
    })
  } catch (error) {
    console.error("POST /api/photos/bulk-delete error:", error)
    return NextResponse.json({ error: "Failed to bulk delete photos" }, { status: 500 })
  }
}
