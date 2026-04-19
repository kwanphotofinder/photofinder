import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getUserFromRequest } from "@/lib/auth"

// GET /api/me/line — check if LINE is linked
export async function GET(request: NextRequest) {
  try {
    const authUser = await getUserFromRequest(request)
    if (!authUser?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser.sub },
      select: { lineUserId: true },
    })

    return NextResponse.json({
      linked: !!user?.lineUserId,
    })
  } catch (error) {
    console.error("GET /api/me/line error:", error)
    return NextResponse.json({ error: "Failed to fetch LINE status" }, { status: 500 })
  }
}

// DELETE /api/me/line — unlink LINE account
export async function DELETE(request: NextRequest) {
  try {
    const authUser = await getUserFromRequest(request)
    if (!authUser?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await prisma.user.update({
      where: { id: authUser.sub },
      data: { lineUserId: null },
    })

    return NextResponse.json({ status: "success", linked: false })
  } catch (error) {
    console.error("DELETE /api/me/line error:", error)
    return NextResponse.json({ error: "Failed to unlink LINE" }, { status: 500 })
  }
}
