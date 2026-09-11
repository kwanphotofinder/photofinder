import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getUserFromRequest } from "@/lib/auth"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const p = await params;
    const { optOutType, reason } = await request.json()

    if (!p.id || !optOutType) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: p.id } })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Update consent in the database
    await prisma.user.update({
      where: { id: p.id },
      data: { pdpaConsent: false },
    })

    // If the user wants all their photos deleted (global opt-out)
    if (optOutType === 'global' || optOutType === 'photos') {
      // Delete all faces related to this user's stored photos
      // (We don't track which face belongs to which user so we log for manual review)
      console.log(`Opt-out request (${optOutType}) for user ${p.id}: ${reason || 'no reason given'}. Manual face removal may be required.`)
    }

    return NextResponse.json({
      status: "success",
      userId: p.id,
      optOutType,
      effectiveDate: new Date().toISOString(),
      message: "Your opt-out has been recorded. PDPA consent has been withdrawn.",
    })
  } catch (error) {
    console.error("POST /api/persons/[id]/opt-out error:", error)
    return NextResponse.json({ error: "Opt-out failed" }, { status: 500 })
  }
}
