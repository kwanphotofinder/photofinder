import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getUserFromRequest } from "@/lib/auth"
import { recordAuditLog } from "@/lib/audit-logger"

// Unified with the general settings page: stored as a whole percent (e.g. 60) under
// "face_match_threshold", which drives both the student photo search and notifications.
const SETTING_KEY = "face_match_threshold"
const DEFAULT_CONFIDENCE = 60

async function getConfidenceSetting() {
  const settings = await prisma.$queryRawUnsafe<Array<{ value: number | string }>>(
    `SELECT "value" FROM "system_settings" WHERE "key" = $1 LIMIT 1`,
    SETTING_KEY,
  )

  return settings.length > 0 ? Number(settings[0].value) : DEFAULT_CONFIDENCE
}

export async function GET(request: NextRequest) {
  try {
    const caller = await getUserFromRequest(request)
    if (!caller || caller.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Super Admin privileges required." }, { status: 403 })
    }

    return NextResponse.json({ percentage: Math.round(await getConfidenceSetting()) })
  } catch (error) {
    console.error("GET /api/admin/system-settings/confidence error:", error)
    return NextResponse.json({ error: "Failed to load confidence setting" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const caller = await getUserFromRequest(request)
    if (!caller || caller.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Super Admin privileges required." }, { status: 403 })
    }

    const body = await request.json()
    const percentage = Number(body.percentage)
    if (!Number.isInteger(percentage) || percentage < 1 || percentage > 100) {
      return NextResponse.json({ error: "Threshold must be a whole number between 1% and 100%." }, { status: 400 })
    }

    const previousConfidence = await getConfidenceSetting()
    await prisma.$executeRawUnsafe(
      `INSERT INTO "system_settings" ("key", "value")
       VALUES ($1, $2)
       ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = CURRENT_TIMESTAMP`,
      SETTING_KEY,
      percentage,
    )

    await recordAuditLog({
      actorId: caller.sub,
      actorEmail: caller.email,
      actorRole: caller.role,
      action: "BIOMETRIC_CONFIDENCE_UPDATE",
      category: "BIOMETRICS",
      targetType: "SYSTEM",
      targetLabel: "Face match threshold",
      details: `Changed face match threshold from ${Math.round(previousConfidence)}% to ${percentage}%.`,
    })

    return NextResponse.json({ percentage })
  } catch (error) {
    console.error("PATCH /api/admin/system-settings/confidence error:", error)
    return NextResponse.json({ error: "Failed to update confidence setting" }, { status: 500 })
  }
}
