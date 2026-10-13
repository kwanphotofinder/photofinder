import { NextRequest, NextResponse } from "next/server"
import { getPhotoEngagementSummaries } from "@/lib/photo-engagement"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const summaries = await getPhotoEngagementSummaries([id])
    const stats = summaries.get(id) ?? { views: 0, shares: 0, likes: 0, downloads: 0 }
    return NextResponse.json(stats)
  } catch (error) {
    console.error("GET /api/photos/[id]/stats error:", error)
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
  }
}
