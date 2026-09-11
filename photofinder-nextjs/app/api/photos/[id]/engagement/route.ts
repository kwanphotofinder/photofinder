import { NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { recordPhotoEngagement } from "@/lib/photo-engagement"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const p = await params
    const body = await req.json().catch(() => ({})) as { action?: string }
    const action = body.action

    if (action !== "VIEW" && action !== "DOWNLOAD" && action !== "SHARE") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const user = await getUserFromRequest(req)
    const result = await recordPhotoEngagement({
      photoId: p.id,
      action,
      viewerId: user?.sub ?? null,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("POST /api/photos/[id]/engagement error:", error)
    return NextResponse.json({ error: "Failed to record engagement" }, { status: 500 })
  }
}
