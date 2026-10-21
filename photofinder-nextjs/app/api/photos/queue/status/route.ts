import { NextRequest, NextResponse } from "next/server"
import { aiQueue } from "@/lib/ai-queue"
import { getUserFromRequest } from "@/lib/auth"

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const stats = await aiQueue.getStats()
    return NextResponse.json(stats)
  } catch (err: any) {
    console.error("[API Queue Status] Error:", err)
    return NextResponse.json({ error: "Failed to fetch queue status" }, { status: 500 })
  }
}
