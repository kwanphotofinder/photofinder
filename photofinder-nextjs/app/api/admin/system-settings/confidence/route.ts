import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getUserFromRequest } from "@/lib/auth"
import { recordAuditLog } from "@/lib/audit-logger"

const SETTING_KEY = "biometric_match_confidence"
const DEFAULT_CONFIDENCE = 0.5

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

    return NextResponse.json({ percentage: Math.round((await getConfidenceSetting()) * 100) })
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
      return NextResponse.json({ error: "Confidence must be a whole number between 1% and 100%." }, { status: 400 })
    }
    const confidence = percentage / 100

    const previousConfidence = await getConfidenceSetting()
    await prisma.$executeRawUnsafe(
      `INSERT INTO "system_settings" ("key", "value")
       VALUES ($1, $2)
       ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = CURRENT_TIMESTAMP`,
      SETTING_KEY,
      confidence,
    )

    await recordAuditLog({
      actorId: caller.sub,
      actorEmail: caller.email,
      actorRole: caller.role,
      action: "BIOMETRIC_CONFIDENCE_UPDATE",
      category: "BIOMETRICS",
      targetType: "SYSTEM",
      targetLabel: "Biometric match confidence",
      details: `Changed biometric match confidence from ${(previousConfidence * 100).toFixed(0)}% to ${(confidence * 100).toFixed(0)}%.`,
    })

    return NextResponse.json({ percentage })
  } catch (error) {
    console.error("PATCH /api/admin/system-settings/confidence error:", error)
    return NextResponse.json({ error: "Failed to update confidence setting" }, { status: 500 })
  }
}
