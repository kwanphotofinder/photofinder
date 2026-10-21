import { NextRequest, NextResponse } from "next/server"
import { aiQueue } from "@/lib/ai-queue"
import { getUserFromRequest } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN" && user.role !== "PHOTOGRAPHER")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const failedPhotos = await prisma.photo.findMany({
      where: { processingStatus: "FAILED" },
      select: { id: true, storageUrl: true },
      take: 100,
    })

    if (failedPhotos.length === 0) {
      return NextResponse.json({ message: "No failed photos found", retried: 0 })
    }

    for (const p of failedPhotos) {
      await aiQueue.enqueue({
        photoId: p.id,
        storageUrl: p.storageUrl,
        retries: 0,
      })
    }

    return NextResponse.json({
      success: true,
      retried: failedPhotos.length,
      message: `Enqueued ${failedPhotos.length} failed photos for reprocessing`,
    })
  } catch (err: any) {
    console.error("[API Queue Retry] Error:", err)
    return NextResponse.json({ error: "Failed to retry queue jobs" }, { status: 500 })
  }
}
