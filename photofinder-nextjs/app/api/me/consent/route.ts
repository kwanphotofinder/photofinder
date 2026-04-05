import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getUserFromRequest } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const authUser = await getUserFromRequest(request)
    if (!authUser?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { accepted } = await request.json()
    if (typeof accepted !== "boolean") {
      return NextResponse.json({ error: "accepted must be a boolean" }, { status: 400 })
    }

    const updatedUser = await prisma.user.update({
      where: { id: authUser.sub },
      data: { pdpaConsent: accepted },
      select: { pdpaConsent: true },
    })

    return NextResponse.json({
      status: "success",
      pdpaConsent: updatedUser.pdpaConsent,
    })
  } catch (error) {
    console.error("POST /api/me/consent error:", error)
    return NextResponse.json({ error: "Failed to update consent" }, { status: 500 })
  }
}
