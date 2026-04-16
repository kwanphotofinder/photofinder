import { NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { getPhotographerAnalytics } from "@/lib/photo-engagement"

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.role !== "PHOTOGRAPHER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const data = await getPhotographerAnalytics(user.sub)
    return NextResponse.json(data)
  } catch (error) {
    console.error("GET /api/photographer/analytics error:", error)
    return NextResponse.json({ error: "Failed to fetch photographer analytics" }, { status: 500 })
  }
}
