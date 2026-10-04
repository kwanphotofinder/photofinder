import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getUserFromRequest } from "@/lib/auth"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const photo = await prisma.photo.findUnique({
      where: { id },
      select: {
        storageUrl: true,
        mimeType: true,
        createdAt: true,
        event: { select: { name: true, date: true, status: true } },
      },
    })

    if (!photo) return NextResponse.json({ error: "Photo not found" }, { status: 404 })
    if (photo.event.status !== "PUBLISHED" && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Photo is not available" }, { status: 403 })
    }

    const upstream = await fetch(photo.storageUrl)
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: "Unable to fetch photo" }, { status: 502 })
    }

    const eventName = photo.event.name.replace(/[\\/:*?"<>|\r\n]+/g, "_").trim() || "photo"
    const date = new Date(photo.event.date || photo.createdAt).toISOString().slice(0, 10)
    const contentType = upstream.headers.get("content-type") || photo.mimeType || "image/jpeg"
    const extension = contentType.split("/")[1]?.replace("jpeg", "jpg") || "jpg"
    const filename = `${eventName}_${date}.${extension}`

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": upstream.headers.get("content-length") || "",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch (error) {
    console.error("GET /api/photos/[id]/download error:", error)
    return NextResponse.json({ error: "Failed to download photo" }, { status: 500 })
  }
}