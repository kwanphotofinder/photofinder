import { NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { recordPhotoEngagement } from "@/lib/photo-engagement"
import { withLogTap } from "@/lib/log-tap"

export const POST = withLogTap("/api/photos/[id]/engagement", async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const p = await params
  const body = (await req.json().catch(() => ({}))) as { action?: string }
  const action = body.action

  if (action !== "VIEW" && action !== "DOWNLOAD" && action !== "SHARE") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  const user = await getUserFromRequest(req)
  const clientViewerId = req.headers.get("x-viewer-id") || null
  const viewerId = user?.sub || clientViewerId

  const result = await recordPhotoEngagement({
    photoId: p.id,
    action,
    viewerId,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 })
  }

  return NextResponse.json({ success: true })
})
